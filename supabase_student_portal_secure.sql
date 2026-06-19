create table if not exists student_consents (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid references users(id) on delete cascade,
  student_id uuid references students(id) on delete cascade,
  invite_id uuid references student_invites(id) on delete set null,
  consent_version text not null default '1.0',
  accepted boolean not null default true,
  accepted_at timestamptz default now(),
  created_at timestamptz default now()
);

create index if not exists student_consents_student_idx
on student_consents (student_id, accepted_at desc);

alter table student_consents enable row level security;

drop policy if exists "coach can read own student consents" on student_consents;

create policy "coach can read own student consents"
on student_consents for select
to authenticated
using (coach_id = auth.uid());

create or replace function get_student_portal(invite_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  active_invite student_invites%rowtype;
  result jsonb;
begin
  select *
  into active_invite
  from student_invites
  where code = invite_code
    and status = 'active'
    and expires_at > now()
  limit 1;

  if active_invite.id is null then
    raise exception 'Convite nao encontrado ou expirado';
  end if;

  if not exists (
    select 1
    from student_consents sc
    where sc.student_id = active_invite.student_id
      and sc.accepted = true
  ) then
    select jsonb_build_object(
      'invite', to_jsonb(active_invite),
      'student', jsonb_build_object(
        'id', s.id,
        'name', s.name,
        'goal', s.goal
      ),
      'coach_settings', (
        select to_jsonb(cs)
        from coach_settings cs
        where cs.coach_id = active_invite.coach_id
        limit 1
      ),
      'consent_accepted', false
    )
    into result
    from students s
    where s.id = active_invite.student_id;

    return result;
  end if;

  select jsonb_build_object(
    'invite', to_jsonb(active_invite),
    'consent_accepted', true,
    'student', to_jsonb(s),
    'coach_settings', (
      select to_jsonb(cs)
      from coach_settings cs
      where cs.coach_id = active_invite.coach_id
      limit 1
    ),
    'checkins', coalesce((
      select jsonb_agg(
        to_jsonb(c) || jsonb_build_object(
          'checkin_photos',
          coalesce((
            select jsonb_agg(to_jsonb(cp))
            from checkin_photos cp
            where cp.checkin_id = c.id
          ), '[]'::jsonb)
        )
        order by c.created_at desc
      )
      from checkins c
      where c.student_id = active_invite.student_id
    ), '[]'::jsonb),
    'workouts', coalesce((
      select jsonb_agg(
        to_jsonb(w) || jsonb_build_object(
          'workout_exercises',
          coalesce((
            select jsonb_agg(to_jsonb(we) order by we.order_index)
            from workout_exercises we
            where we.workout_id = w.id
          ), '[]'::jsonb)
        )
        order by w.created_at desc
      )
      from workouts w
      where w.student_id = active_invite.student_id
        and w.active = true
    ), '[]'::jsonb),
    'nutrition_plans', coalesce((
      select jsonb_agg(
        to_jsonb(np) || jsonb_build_object(
          'nutrition_meals',
          coalesce((
            select jsonb_agg(to_jsonb(nm) order by nm.order_index)
            from nutrition_meals nm
            where nm.nutrition_plan_id = np.id
          ), '[]'::jsonb)
        )
        order by np.created_at desc
      )
      from nutrition_plans np
      where np.student_id = active_invite.student_id
        and np.active = true
    ), '[]'::jsonb),
    'workout_logs', coalesce((
      select jsonb_agg(to_jsonb(wl) order by wl.completed_at desc)
      from workout_logs wl
      where wl.student_id = active_invite.student_id
    ), '[]'::jsonb),
    'messages', coalesce((
      select jsonb_agg(to_jsonb(m) order by m.created_at desc)
      from messages m
      where m.student_id = active_invite.student_id
    ), '[]'::jsonb),
    'appointments', coalesce((
      select jsonb_agg(to_jsonb(a) order by a.starts_at asc)
      from appointments a
      where a.student_id = active_invite.student_id
    ), '[]'::jsonb),
    'invoices', coalesce((
      select jsonb_agg(to_jsonb(i) order by i.due_date desc)
      from invoices i
      where i.student_id = active_invite.student_id
    ), '[]'::jsonb),
    'assessments', coalesce((
      select jsonb_agg(to_jsonb(ass) order by ass.assessed_at desc)
      from assessments ass
      where ass.student_id = active_invite.student_id
    ), '[]'::jsonb)
  )
  into result
  from students s
  where s.id = active_invite.student_id;

  return result;
end;
$$;

create or replace function accept_student_consent(
  invite_code text,
  consent_version_value text default '1.0'
)
returns student_consents
language plpgsql
security definer
set search_path = public
as $$
declare
  active_invite student_invites%rowtype;
  saved student_consents%rowtype;
begin
  select * into active_invite
  from student_invites
  where code = invite_code and status = 'active' and expires_at > now()
  limit 1;

  if active_invite.id is null then
    raise exception 'Convite nao encontrado ou expirado';
  end if;

  insert into student_consents (
    coach_id,
    student_id,
    invite_id,
    consent_version,
    accepted
  )
  values (
    active_invite.coach_id,
    active_invite.student_id,
    active_invite.id,
    consent_version_value,
    true
  )
  returning * into saved;

  return saved;
end;
$$;

create or replace function submit_student_checkin(
  invite_code text,
  checkin_type text,
  due_label text,
  checkin_state text,
  weight_value text,
  note_value text
)
returns checkins
language plpgsql
security definer
set search_path = public
as $$
declare
  active_invite student_invites%rowtype;
  saved checkins%rowtype;
begin
  select * into active_invite
  from student_invites
  where code = invite_code and status = 'active' and expires_at > now()
  limit 1;

  if active_invite.id is null then
    raise exception 'Convite nao encontrado ou expirado';
  end if;

  insert into checkins (student_id, type, due_label, state, weight, note)
  values (active_invite.student_id, checkin_type, due_label, checkin_state, weight_value, note_value)
  returning * into saved;

  return saved;
end;
$$;

create or replace function submit_student_message(invite_code text, message_body text)
returns messages
language plpgsql
security definer
set search_path = public
as $$
declare
  active_invite student_invites%rowtype;
  saved messages%rowtype;
begin
  select * into active_invite
  from student_invites
  where code = invite_code and status = 'active' and expires_at > now()
  limit 1;

  if active_invite.id is null then
    raise exception 'Convite nao encontrado ou expirado';
  end if;

  insert into messages (coach_id, student_id, sender, body, read)
  values (active_invite.coach_id, active_invite.student_id, 'student', message_body, false)
  returning * into saved;

  return saved;
end;
$$;

create or replace function attach_student_checkin_photo(
  invite_code text,
  selected_checkin_id uuid,
  photo_url text
)
returns checkin_photos
language plpgsql
security definer
set search_path = public
as $$
declare
  active_invite student_invites%rowtype;
  saved checkin_photos%rowtype;
begin
  select * into active_invite
  from student_invites
  where code = invite_code and status = 'active' and expires_at > now()
  limit 1;

  if active_invite.id is null then
    raise exception 'Convite nao encontrado ou expirado';
  end if;

  if not exists (
    select 1 from checkins
    where id = selected_checkin_id
      and student_id = active_invite.student_id
  ) then
    raise exception 'Check-in invalido para este aluno';
  end if;

  insert into checkin_photos (checkin_id, storage_url, label)
  values (selected_checkin_id, photo_url, 'Foto enviada pelo aluno')
  returning * into saved;

  return saved;
end;
$$;

create or replace function submit_student_workout_log(
  invite_code text,
  selected_workout_id uuid,
  workout_title text,
  effort_value text,
  notes_value text
)
returns workout_logs
language plpgsql
security definer
set search_path = public
as $$
declare
  active_invite student_invites%rowtype;
  saved workout_logs%rowtype;
begin
  select * into active_invite
  from student_invites
  where code = invite_code and status = 'active' and expires_at > now()
  limit 1;

  if active_invite.id is null then
    raise exception 'Convite nao encontrado ou expirado';
  end if;

  if selected_workout_id is not null and not exists (
    select 1 from workouts
    where id = selected_workout_id
      and student_id = active_invite.student_id
  ) then
    raise exception 'Treino invalido para este aluno';
  end if;

  insert into workout_logs (coach_id, student_id, workout_id, title, effort, notes)
  values (
    active_invite.coach_id,
    active_invite.student_id,
    selected_workout_id,
    workout_title,
    effort_value,
    notes_value
  )
  returning * into saved;

  return saved;
end;
$$;

grant execute on function get_student_portal(text) to anon, authenticated;
grant execute on function accept_student_consent(text, text) to anon, authenticated;
grant execute on function submit_student_checkin(text, text, text, text, text, text) to anon, authenticated;
grant execute on function submit_student_message(text, text) to anon, authenticated;
grant execute on function attach_student_checkin_photo(text, uuid, text) to anon, authenticated;
grant execute on function submit_student_workout_log(text, uuid, text, text, text) to anon, authenticated;

drop policy if exists "public can read active student invite by code" on student_invites;
drop policy if exists "student invite can read linked student" on students;
drop policy if exists "student invite can read linked checkins" on checkins;
drop policy if exists "student invite can create checkins" on checkins;
drop policy if exists "student invite can read linked checkin photos" on checkin_photos;
drop policy if exists "student invite can create checkin photos" on checkin_photos;
drop policy if exists "student invite can read workouts" on workouts;
drop policy if exists "student invite can read workout exercises" on workout_exercises;
drop policy if exists "student invite can read nutrition plans" on nutrition_plans;
drop policy if exists "student invite can read nutrition meals" on nutrition_meals;
drop policy if exists "student invite can read own workout logs" on workout_logs;
drop policy if exists "student invite can create workout logs" on workout_logs;
drop policy if exists "student invite can read own messages" on messages;
drop policy if exists "student invite can create own messages" on messages;
drop policy if exists "student invite can read own appointments" on appointments;
drop policy if exists "student invite can read own invoices" on invoices;
drop policy if exists "student invite can read own assessments" on assessments;
drop policy if exists "student invite can read coach settings" on coach_settings;

drop policy if exists "prototype checkin photos insert" on storage.objects;
drop policy if exists "prototype checkin photos update" on storage.objects;
drop policy if exists "prototype checkin photos delete" on storage.objects;
drop policy if exists "student invite can upload checkin photos" on storage.objects;
drop policy if exists "coach can upload checkin photos" on storage.objects;
drop policy if exists "coach can update checkin photos" on storage.objects;
drop policy if exists "coach can delete checkin photos" on storage.objects;

create policy "student invite can upload checkin photos"
on storage.objects for insert
to anon
with check (
  bucket_id = 'checkin-photos'
  and exists (
    select 1
    from student_invites
    where student_invites.code = split_part(storage.objects.name, '/', 1)
      and student_invites.status = 'active'
      and student_invites.expires_at > now()
  )
);

create policy "coach can upload checkin photos"
on storage.objects for insert
to authenticated
with check (bucket_id = 'checkin-photos');

create policy "coach can update checkin photos"
on storage.objects for update
to authenticated
using (bucket_id = 'checkin-photos')
with check (bucket_id = 'checkin-photos');

create policy "coach can delete checkin photos"
on storage.objects for delete
to authenticated
using (bucket_id = 'checkin-photos');

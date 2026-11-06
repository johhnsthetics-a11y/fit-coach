begin;

-- Avaliações são vinculadas ao log realmente concluído, sem criar uma nova sessão.
alter table public.workout_logs
  add column if not exists rating smallint,
  add column if not exists rated_at timestamptz;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'workout_logs_rating_range_check'
      and conrelid = 'public.workout_logs'::regclass
  ) then
    alter table public.workout_logs
      add constraint workout_logs_rating_range_check
      check (rating is null or rating between 1 and 5);
  end if;
end;
$$;

create or replace function public.rate_student_workout_log(
  invite_code text,
  selected_workout_log_id uuid,
  rating_value smallint
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_coach_id uuid;
  v_student_id uuid;
  v_log public.workout_logs%rowtype;
begin
  if selected_workout_log_id is null or rating_value is null or rating_value not between 1 and 5 then
    raise exception 'Selecione uma avaliação entre uma e cinco estrelas.' using errcode = '22023';
  end if;
  if not public.coachfit_student_financial_access_by_invite(invite_code) then
    raise exception 'Acesso financeiro pendente ou convite inválido.' using errcode = '42501';
  end if;

  select invites.coach_id, invites.student_id
    into v_coach_id, v_student_id
  from public.student_invites as invites
  where invites.code = trim(rate_student_workout_log.invite_code)
    and invites.status = 'active'
    and (invites.expires_at is null or invites.expires_at > now())
  order by invites.created_at desc
  limit 1;

  if v_student_id is null or not exists (
    select 1
    from public.students as students
    where students.id = v_student_id
      and students.coach_id = v_coach_id
  ) then
    raise exception 'Convite do aluno inválido ou expirado.' using errcode = '42501';
  end if;

  update public.workout_logs as logs
  set rating = rate_student_workout_log.rating_value,
      rated_at = now()
  where logs.id = rate_student_workout_log.selected_workout_log_id
    and logs.student_id = v_student_id
    and logs.coach_id = v_coach_id
    and position('[coachfitpro-completion:' in coalesce(logs.notes, '')) > 0
    and position('[coachfitpro-ended-early:' in coalesce(logs.notes, '')) = 0
  returning logs.* into v_log;

  if v_log.id is null then
    raise exception 'Treino concluído não encontrado para esta conta.' using errcode = '42501';
  end if;

  return to_jsonb(v_log);
end;
$$;
revoke all on function public.rate_student_workout_log(text, uuid, smallint) from public;
grant execute on function public.rate_student_workout_log(text, uuid, smallint) to anon, authenticated;

-- Registro do que o paciente/aluno consumiu: separado da dieta que o profissional prescreve.
create table if not exists public.student_meal_logs (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null,
  student_id uuid not null references public.students(id) on delete cascade,
  nutrition_plan_id uuid references public.nutrition_plans(id) on delete set null,
  meal_name text not null check (char_length(btrim(meal_name)) between 1 and 80),
  note text not null default '' check (char_length(note) <= 240),
  meal_date date not null default current_date,
  recorded_at timestamptz not null default now(),
  photo_path text not null unique,
  photo_mime text not null check (photo_mime in ('image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'image/avif')),
  photo_size_bytes integer not null check (photo_size_bytes between 1 and 10485760)
);

create index if not exists student_meal_logs_student_recorded_idx
  on public.student_meal_logs (student_id, recorded_at desc);
create index if not exists student_meal_logs_coach_recorded_idx
  on public.student_meal_logs (coach_id, recorded_at desc);

alter table public.student_meal_logs enable row level security;
drop policy if exists coach_student_meal_logs_select on public.student_meal_logs;
create policy coach_student_meal_logs_select
  on public.student_meal_logs for select
  to authenticated
  using (coach_id = (select auth.uid()));
revoke all on table public.student_meal_logs from anon, authenticated;
grant select on table public.student_meal_logs to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'meal-photos',
  'meal-photos',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'image/avif']::text[]
)
on conflict (id) do update
set name = excluded.name,
    public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

-- Meal photos require proof of the student's private invite; simply knowing
-- the object path must never authorize reads, uploads or deletion. The
-- meal-photo Edge Function validates the invite and billing status for EACH
-- request before using a service-role client to operate on this private bucket.
-- No direct anon/authenticated Storage policies are granted for this bucket.
drop policy if exists student_meal_photos_select_own on storage.objects;
drop policy if exists student_meal_photos_insert_own on storage.objects;
drop policy if exists student_meal_photos_delete_own on storage.objects;

create or replace function public.get_student_meal_logs(invite_code text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_coach_id uuid;
  v_student_id uuid;
  v_result jsonb;
begin
  if not public.coachfit_student_financial_access_by_invite(invite_code) then
    raise exception 'Acesso financeiro pendente ou convite inválido.' using errcode = '42501';
  end if;

  select invites.coach_id, invites.student_id
    into v_coach_id, v_student_id
  from public.student_invites as invites
  where invites.code = trim(get_student_meal_logs.invite_code)
    and invites.status = 'active'
    and (invites.expires_at is null or invites.expires_at > now())
  order by invites.created_at desc
  limit 1;

  if v_student_id is null or not exists (
    select 1
    from public.students as students
    where students.id = v_student_id
      and students.coach_id = v_coach_id
  ) then
    raise exception 'Convite do aluno inválido ou expirado.' using errcode = '42501';
  end if;

  select coalesce(jsonb_agg(to_jsonb(rows) order by rows.recorded_at desc), '[]'::jsonb)
    into v_result
  from (
    select meal_logs.*
    from public.student_meal_logs as meal_logs
    where meal_logs.student_id = v_student_id
      and meal_logs.coach_id = v_coach_id
    order by meal_logs.recorded_at desc
    limit 50
  ) as rows;

  return v_result;
end;
$$;
revoke all on function public.get_student_meal_logs(text) from public;
grant execute on function public.get_student_meal_logs(text) to anon, authenticated;

create or replace function public.create_student_meal_log(
  invite_code text,
  selected_nutrition_plan_id uuid,
  meal_name text,
  note_value text,
  photo_mime_value text,
  photo_size_bytes_value integer,
  photo_extension text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_coach_id uuid;
  v_student_id uuid;
  v_log_id uuid := gen_random_uuid();
  v_photo_path text;
  v_extension text := lower(btrim(coalesce(photo_extension, '')));
  v_photo_mime text := lower(btrim(coalesce(photo_mime_value, '')));
  v_log public.student_meal_logs%rowtype;
begin
  if not public.coachfit_student_financial_access_by_invite(invite_code) then
    raise exception 'Acesso financeiro pendente ou convite inválido.' using errcode = '42501';
  end if;
  if char_length(btrim(coalesce(meal_name, ''))) not between 1 and 80
    or char_length(coalesce(note_value, '')) > 240
    or photo_size_bytes_value is null
    or photo_size_bytes_value not between 1 and 10485760
    or v_photo_mime not in ('image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'image/avif')
    or v_extension not in ('jpg', 'jpeg', 'png', 'webp', 'heic', 'heif', 'avif')
    or not (
      (v_photo_mime = 'image/jpeg' and v_extension in ('jpg', 'jpeg'))
      or (v_photo_mime = 'image/png' and v_extension = 'png')
      or (v_photo_mime = 'image/webp' and v_extension = 'webp')
      or (v_photo_mime = 'image/heic' and v_extension = 'heic')
      or (v_photo_mime = 'image/heif' and v_extension = 'heif')
      or (v_photo_mime = 'image/avif' and v_extension = 'avif')
    ) then
    raise exception 'Dados da refeição ou da foto inválidos.' using errcode = '22023';
  end if;

  select invites.coach_id, invites.student_id
    into v_coach_id, v_student_id
  from public.student_invites as invites
  where invites.code = trim(create_student_meal_log.invite_code)
    and invites.status = 'active'
    and (invites.expires_at is null or invites.expires_at > now())
  order by invites.created_at desc
  limit 1;

  if v_student_id is null or not exists (
    select 1
    from public.students as students
    where students.id = v_student_id
      and students.coach_id = v_coach_id
  ) then
    raise exception 'Convite do aluno inválido ou expirado.' using errcode = '42501';
  end if;

  if selected_nutrition_plan_id is not null and not exists (
    select 1
    from public.nutrition_plans as plans
    where plans.id = selected_nutrition_plan_id
      and plans.student_id = v_student_id
      and plans.coach_id = v_coach_id
      and plans.active is true
  ) then
    raise exception 'Plano alimentar não pertence a esta conta.' using errcode = '42501';
  end if;

  v_photo_path := v_coach_id::text || '/' || v_student_id::text || '/' || v_log_id::text || '.' || v_extension;
  insert into public.student_meal_logs (
    id, coach_id, student_id, nutrition_plan_id, meal_name, note, meal_date,
    recorded_at, photo_path, photo_mime, photo_size_bytes
  ) values (
    v_log_id,
    v_coach_id,
    v_student_id,
    selected_nutrition_plan_id,
    btrim(meal_name),
    btrim(coalesce(note_value, '')),
    (now() at time zone 'America/Sao_Paulo')::date,
    now(),
    v_photo_path,
    v_photo_mime,
    photo_size_bytes_value
  ) returning * into v_log;

  return to_jsonb(v_log);
end;
$$;
revoke all on function public.create_student_meal_log(text, uuid, text, text, text, integer, text) from public;
grant execute on function public.create_student_meal_log(text, uuid, text, text, text, integer, text) to anon, authenticated;

create or replace function public.delete_student_meal_log(invite_code text, selected_meal_log_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_student_id uuid;
  v_coach_id uuid;
  v_photo_path text;
begin
  if not public.coachfit_student_financial_access_by_invite(invite_code) then
    raise exception 'Acesso financeiro pendente ou convite inválido.' using errcode = '42501';
  end if;

  select invites.coach_id, invites.student_id
    into v_coach_id, v_student_id
  from public.student_invites as invites
  where invites.code = trim(delete_student_meal_log.invite_code)
    and invites.status = 'active'
    and (invites.expires_at is null or invites.expires_at > now())
  order by invites.created_at desc
  limit 1;

  if v_student_id is null or not exists (
    select 1 from public.students as students
    where students.id = v_student_id and students.coach_id = v_coach_id
  ) then
    raise exception 'Convite do aluno inválido ou expirado.' using errcode = '42501';
  end if;

  select meal_logs.photo_path
    into v_photo_path
  from public.student_meal_logs as meal_logs
  where meal_logs.id = delete_student_meal_log.selected_meal_log_id
    and meal_logs.student_id = v_student_id
    and meal_logs.coach_id = v_coach_id;

  if v_photo_path is null then
    return false;
  end if;
  if exists (
    select 1 from storage.objects as objects
    where objects.bucket_id = 'meal-photos'
      and objects.name = v_photo_path
  ) then
    raise exception 'Remova a foto privada antes de excluir o registro da refeição.' using errcode = '42501';
  end if;

  delete from public.student_meal_logs as meal_logs
  where meal_logs.id = delete_student_meal_log.selected_meal_log_id
    and meal_logs.student_id = v_student_id
    and meal_logs.coach_id = v_coach_id;

  return found;
end;
$$;
revoke all on function public.delete_student_meal_log(text, uuid) from public;
grant execute on function public.delete_student_meal_log(text, uuid) to anon, authenticated;

-- Permite que a exclusão de conta também remova as fotos privadas deste novo recurso.
create or replace function public.coachfit_account_storage_references()
returns table (bucket_id text, storage_value text)
language sql
stable
security definer
set search_path = ''
as $$
  select objects.bucket_id::text, objects.name::text
  from storage.objects as objects
  where objects.owner_id::text = auth.uid()::text

  union

  select 'profile-avatars'::text, settings.profile_avatar_path::text
  from public.coach_settings as settings
  where settings.coach_id = auth.uid()
    and nullif(btrim(settings.profile_avatar_path), '') is not null

  union

  select 'profile-avatars'::text, students.avatar_path::text
  from public.students as students
  where (students.coach_id = auth.uid() or students.auth_user_id = auth.uid())
    and nullif(btrim(students.avatar_path), '') is not null

  union

  select 'checkin-photos'::text, photos.storage_url::text
  from public.checkin_photos as photos
  join public.checkins as checkins on checkins.id = photos.checkin_id
  join public.students as students on students.id = checkins.student_id
  where (students.coach_id = auth.uid() or students.auth_user_id = auth.uid())
    and nullif(btrim(photos.storage_url), '') is not null

  union

  select 'meal-photos'::text, meal_logs.photo_path::text
  from public.student_meal_logs as meal_logs
  where (
      meal_logs.coach_id = auth.uid()
      or exists (
        select 1 from public.students as students
        where students.id = meal_logs.student_id
          and students.auth_user_id = auth.uid()
      )
    )
    and nullif(btrim(meal_logs.photo_path), '') is not null

  union

  select 'message-attachments'::text, messages.attachment_url::text
  from public.messages as messages
  where (
      messages.coach_id = auth.uid()
      or exists (
        select 1
        from public.students as students
        where students.id = messages.student_id
          and students.auth_user_id = auth.uid()
      )
    )
    and nullif(btrim(messages.attachment_url), '') is not null

  union

  select 'workout-videos'::text, exercises.video_url::text
  from public.workout_exercises as exercises
  join public.workouts as workouts on workouts.id = exercises.workout_id
  where workouts.coach_id = auth.uid()
    and nullif(btrim(exercises.video_url), '') is not null;
$$;
revoke all on function public.coachfit_account_storage_references() from public, anon, authenticated;
grant execute on function public.coachfit_account_storage_references() to authenticated;

commit;
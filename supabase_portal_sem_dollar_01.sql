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
language sql
security definer
set search_path = public
begin atomic
  with active_invite as (
    select si.*
    from student_invites si
    where si.code = invite_code
      and si.status = 'active'
      and si.expires_at > now()
    limit 1
  ),
  portal_base as (
    select
      ai.*,
      s as student_row,
      cs as settings_row,
      exists (
        select 1
        from student_consents sc
        where sc.student_id = ai.student_id
          and sc.accepted = true
      ) as consent_ok
    from active_invite ai
    join students s on s.id = ai.student_id
    left join coach_settings cs on cs.coach_id = ai.coach_id
  )
  select case
    when not pb.consent_ok then
      jsonb_build_object(
        'invite', to_jsonb(pb) - 'student_row' - 'settings_row' - 'consent_ok',
        'student', jsonb_build_object(
          'id', (pb.student_row).id,
          'name', (pb.student_row).name,
          'goal', (pb.student_row).goal
        ),
        'coach_settings', to_jsonb(pb.settings_row),
        'consent_accepted', false
      )
    else
      jsonb_build_object(
        'invite', to_jsonb(pb) - 'student_row' - 'settings_row' - 'consent_ok',
        'consent_accepted', true,
        'student', to_jsonb(pb.student_row),
        'coach_settings', to_jsonb(pb.settings_row),
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
          where c.student_id = pb.student_id
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
          where w.student_id = pb.student_id
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
          where np.student_id = pb.student_id
            and np.active = true
        ), '[]'::jsonb),
        'workout_logs', coalesce((
          select jsonb_agg(to_jsonb(wl) order by wl.completed_at desc)
          from workout_logs wl
          where wl.student_id = pb.student_id
        ), '[]'::jsonb),
        'messages', coalesce((
          select jsonb_agg(to_jsonb(m) order by m.created_at desc)
          from messages m
          where m.student_id = pb.student_id
        ), '[]'::jsonb),
        'appointments', coalesce((
          select jsonb_agg(to_jsonb(a) order by a.starts_at asc)
          from appointments a
          where a.student_id = pb.student_id
        ), '[]'::jsonb),
        'invoices', coalesce((
          select jsonb_agg(to_jsonb(i) order by i.due_date desc)
          from invoices i
          where i.student_id = pb.student_id
        ), '[]'::jsonb),
        'assessments', coalesce((
          select jsonb_agg(to_jsonb(ass) order by ass.assessed_at desc)
          from assessments ass
          where ass.student_id = pb.student_id
        ), '[]'::jsonb)
      )
  end
  from portal_base pb;
end;

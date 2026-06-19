create table if not exists coach_settings (
  coach_id uuid primary key references users(id) on delete cascade,
  brand_name text not null default 'FitCoach',
  public_name text,
  cref text,
  whatsapp text,
  support_email text,
  welcome_message text,
  timezone text not null default 'America/Sao_Paulo',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table coach_settings enable row level security;

drop policy if exists "coach can manage own settings" on coach_settings;
drop policy if exists "student invite can read coach settings" on coach_settings;

create policy "coach can manage own settings"
on coach_settings for all
to authenticated
using (coach_id = auth.uid())
with check (coach_id = auth.uid());

create policy "student invite can read coach settings"
on coach_settings for select
to anon, authenticated
using (
  exists (
    select 1
    from student_invites
    where student_invites.coach_id = coach_settings.coach_id
      and student_invites.status = 'active'
      and student_invites.expires_at > now()
  )
);

create table if not exists assessments (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid references users(id) on delete cascade,
  student_id uuid references students(id) on delete cascade,
  assessed_at date not null default current_date,
  weight_kg numeric(6,2),
  height_cm numeric(6,2),
  body_fat_percent numeric(5,2),
  waist_cm numeric(6,2),
  abdomen_cm numeric(6,2),
  hip_cm numeric(6,2),
  chest_cm numeric(6,2),
  arm_cm numeric(6,2),
  thigh_cm numeric(6,2),
  calf_cm numeric(6,2),
  resting_heart_rate integer,
  notes text,
  created_at timestamptz default now()
);

create index if not exists assessments_student_date_idx
on assessments (student_id, assessed_at desc);

alter table assessments enable row level security;

drop policy if exists "coach can manage own assessments" on assessments;
drop policy if exists "student invite can read own assessments" on assessments;

create policy "coach can manage own assessments"
on assessments for all
to authenticated
using (coach_id = auth.uid())
with check (coach_id = auth.uid());

create policy "student invite can read own assessments"
on assessments for select
to anon, authenticated
using (
  exists (
    select 1
    from student_invites
    where student_invites.student_id = assessments.student_id
      and student_invites.status = 'active'
      and student_invites.expires_at > now()
  )
);

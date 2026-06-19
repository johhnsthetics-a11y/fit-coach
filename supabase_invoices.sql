create table if not exists invoices (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid references users(id) on delete cascade,
  student_id uuid references students(id) on delete cascade,
  plan_name text not null,
  description text,
  amount_cents integer not null check (amount_cents >= 0),
  due_date date not null,
  status text not null default 'Pendente' check (status in ('Pendente', 'Pago', 'Atrasado', 'Cancelado')),
  payment_method text,
  paid_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists invoices_coach_due_date_idx
on invoices (coach_id, due_date);

create index if not exists invoices_student_idx
on invoices (student_id);

alter table invoices enable row level security;

drop policy if exists "coach can manage own invoices" on invoices;
drop policy if exists "student invite can read own invoices" on invoices;

create policy "coach can manage own invoices"
on invoices for all
to authenticated
using (coach_id = auth.uid())
with check (coach_id = auth.uid());

create policy "student invite can read own invoices"
on invoices for select
to anon, authenticated
using (
  exists (
    select 1
    from student_invites
    where student_invites.student_id = invoices.student_id
      and student_invites.status = 'active'
      and student_invites.expires_at > now()
  )
);

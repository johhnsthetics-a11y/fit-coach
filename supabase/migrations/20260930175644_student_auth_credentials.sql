begin;

alter table public.students
  add column if not exists auth_user_id uuid,
  add column if not exists must_change_password boolean not null default false,
  add column if not exists credentials_generated_at timestamptz;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'students_auth_user_id_fkey'
      and conrelid = 'public.students'::regclass
  ) then
    alter table public.students
      add constraint students_auth_user_id_fkey
      foreign key (auth_user_id) references auth.users(id) on delete set null;
  end if;
end
$$;

create unique index if not exists students_auth_user_id_unique
  on public.students (auth_user_id)
  where auth_user_id is not null;

create or replace function public.get_current_student_access()
returns table (
  student_id uuid,
  invite_code text,
  must_change_password boolean,
  email text,
  professional_type text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Autenticacao obrigatoria' using errcode = '42501';
  end if;

  return query
  select
    students.id,
    invite.code,
    students.must_change_password,
    students.email,
    case
      when lower(coalesce(professionals.role, '')) like '%nutri%' then 'nutritionist'
      else 'trainer'
    end
  from public.students as students
  join public.users as professionals
    on professionals.id = students.coach_id
  join lateral (
    select invites.code
    from public.student_invites as invites
    where invites.student_id = students.id
      and invites.coach_id = students.coach_id
      and invites.status = 'active'
      and (invites.expires_at is null or invites.expires_at > now())
    order by invites.created_at desc
    limit 1
  ) as invite on true
  where students.auth_user_id = auth.uid()
  limit 1;
end;
$$;

revoke all on function public.get_current_student_access() from public, anon;
grant execute on function public.get_current_student_access() to authenticated;

commit;

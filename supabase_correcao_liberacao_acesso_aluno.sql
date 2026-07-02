alter table public.students
  add column if not exists access_override_until timestamptz;

comment on column public.students.access_override_until is
  'Data limite para liberar temporariamente o acesso do aluno mesmo com pagamento pendente.';

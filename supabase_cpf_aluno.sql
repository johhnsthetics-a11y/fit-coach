alter table if exists public.students
  add column if not exists cpf text;

comment on column public.students.cpf is
  'CPF opcional informado no cadastro administrativo do aluno.';

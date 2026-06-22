alter table if exists public.students
  add column if not exists require_anamnesis boolean not null default true,
  add column if not exists cpf text;

comment on column public.students.require_anamnesis is
  'Define se o aluno deve preencher a anamnese antes de acessar o portal.';

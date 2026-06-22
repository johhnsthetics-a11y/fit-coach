alter table if exists public.students
  add column if not exists require_anamnesis boolean not null default true;

comment on column public.students.require_anamnesis is
  'Define se o aluno deve preencher a anamnese antes de acessar o portal.';

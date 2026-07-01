alter table public.students
  add column if not exists access_override_until timestamptz,
  add column if not exists load_notes text;

alter table public.coach_settings
  add column if not exists pix_key text;

comment on column public.students.access_override_until is
  'Data limite para liberar temporariamente o aluno mesmo com pagamento pendente.';

comment on column public.students.load_notes is
  'Notas internas do coach sobre carga, execucao e progressao do aluno.';

comment on column public.coach_settings.pix_key is
  'Chave Pix exibida nas cobrancas e no portal do aluno.';

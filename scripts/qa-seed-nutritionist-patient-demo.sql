-- Coach Fit Pro: fixture de teste intencional, NUNCA executar como migração.
-- PRÉ-REQUISITO: criar os dois usuários em Supabase > Authentication > Users
-- pelo sistema Auth oficial, com email confirmado:
-- nutricionista.teste.cfp.20261103@example.com
-- aluno.teste.cfp.20261103@example.com
-- Este arquivo NUNCA cria usuários em auth nem define senhas.
-- Acesso demonstrativo por 30 dias, sem cobrança ou recibo de compra da Apple.

do $qa$
declare
  v_nutri uuid;
  v_aluno_auth uuid;
  v_aluno uuid;
  v_dieta uuid;
  v_nutri_email constant text := 'nutricionista.teste.cfp.20261103@example.com';
  v_aluno_email constant text := 'aluno.teste.cfp.20261103@example.com';
begin
  select id into v_nutri from auth.users
    where lower(email) = v_nutri_email and email_confirmed_at is not null;
  select id into v_aluno_auth from auth.users
    where lower(email) = v_aluno_email and email_confirmed_at is not null;
  if v_nutri is null or v_aluno_auth is null or v_nutri = v_aluno_auth then
    raise exception 'Crie e confirme as duas contas no Authentication > Users antes de executar.';
  end if;
  if exists (
    select 1 from public.students
    where auth_user_id = v_aluno_auth and coach_id is distinct from v_nutri
  ) then
    raise exception 'O usuário de teste já está vinculado a outro profissional.';
  end if;

  insert into public.users(id,name,email,role)
    values(v_nutri,'Nutricionista de Teste CFP',v_nutri_email,'Nutricionista')
    on conflict (id) do nothing;
  if not exists (select 1 from public.users where id=v_nutri and role='Nutricionista') then
    raise exception 'O papel de nutricionista não está correto; não alterar dados existentes.';
  end if;
  insert into public.coach_settings(coach_id,brand_name,public_name,welcome_message)
    values(v_nutri,'Coach Fit Pro – Demonstração','Nutricionista de Teste CFP',
      'Ambiente demonstrativo com dados 100% fictícios.')
    on conflict (coach_id) do nothing;

  -- A conta demo é liberada por prazo limitado para QA, sem registrar
  -- pagamentos da Apple, transações, comissões ou assinaturas reais.
  update public.coach_subscriptions
    set status='active',provider='qa_fixture',paid_at=null,
      current_period_started_at=now(),
      current_period_ends_at=now() + interval '30 days',
      first_billing_at=now() + interval '30 days',
      next_billing_at=now() + interval '30 days',
      provider_customer_id=null,provider_subscription_id=null,provider_order_id=null,
      updated_at=now()
    where coach_id=v_nutri;
  if not found then
    raise exception 'Registro inicial de assinatura profissional não encontrado.';
  end if;

  select id into v_aluno from public.students where auth_user_id=v_aluno_auth limit 1;
  if v_aluno is null then
    insert into public.students (
      coach_id,auth_user_id,name,email,goal,phase,status,
      require_anamnesis,must_change_password,
      payment,app_payment_status,access_override_until
    ) values (
      v_nutri,v_aluno_auth,'Paciente de Teste CFP',v_aluno_email,
      'Teste funcional da dieta fictícia','Demonstração','Em dia',
      false,false,'Pendente','pending',now() + interval '30 days'
    ) returning id into v_aluno;
  else
    update public.students set
      require_anamnesis=false,
      must_change_password=false,
      access_override_until=now() + interval '30 days'
    where id=v_aluno and coach_id=v_nutri;
  end if;

  if not exists (
    select 1 from public.student_invites
    where coach_id=v_nutri and student_id=v_aluno
      and status='active' and (expires_at is null or expires_at>now())
  ) then
    insert into public.student_invites(coach_id,student_id,code,status,expires_at)
    values(v_nutri,v_aluno,encode(gen_random_bytes(24),'hex'),'active',now() + interval '30 days');
  end if;

  select id into v_dieta from public.nutrition_plans
   where coach_id=v_nutri and student_id=v_aluno
    and title='Dieta fictícia – Demonstração do aplicativo'
   limit 1;
  if v_dieta is null then
    insert into public.nutrition_plans(coach_id,student_id,title,calories,protein,notes,active)
    values(
      v_nutri,v_aluno,'Dieta fictícia – Demonstração do aplicativo',
      '2100 kcal','135 g',
      'Plano ilustrativo para testes. Não constitui prescrição nutricional individualizada.',true
    ) returning id into v_dieta;
  end if;
  if not exists (select 1 from public.nutrition_meals where nutrition_plan_id=v_dieta) then
    insert into public.nutrition_meals(nutrition_plan_id,name,foods,macros,time_label,order_index)
    values
     (v_dieta,'Café da manhã','2 ovos mexidos; 2 fatias de pão integral; 1 banana; café sem açúcar','Exemplo: 430 kcal | P 22 g | C 48 g | G 16 g','07:30',0),
     (v_dieta,'Lanche da manhã','1 iogurte natural (170 g); 1 maçã','Exemplo: 200 kcal | P 9 g | C 31 g | G 5 g','10:00',1),
     (v_dieta,'Almoço','150 g de arroz; 100 g de feijão; 130 g de frango grelhado; salada e legumes','Exemplo: 620 kcal | P 47 g | C 68 g | G 15 g','12:30',2),
     (v_dieta,'Lanche da tarde','1 sanduíche integral com ricota; 1 fruta','Exemplo: 300 kcal | P 17 g | C 40 g | G 8 g','16:00',3),
     (v_dieta,'Jantar','150 g de batata-doce; 130 g de peixe assado; legumes cozidos; azeite','Exemplo: 460 kcal | P 36 g | C 40 g | G 14 g','19:30',4),
     (v_dieta,'Ceia','1 copo de leite ou bebida vegetal; 1 porção de fruta','Exemplo: 90 kcal | P 4 g | C 13 g | G 2 g','21:30',5);
  end if;
end;
$qa$;

-- Verificações de leitura, sem retornar identificadores de login ou senhas:
select
  (select count(*) from public.users where email='nutricionista.teste.cfp.20261103@example.com' and role='Nutricionista') as nutricionista,
  (select count(*) from public.students where email='aluno.teste.cfp.20261103@example.com' and auth_user_id is not null) as aluno_vinculado,
  (select count(*) from public.nutrition_meals m join public.nutrition_plans p on p.id=m.nutrition_plan_id
    join public.students s on s.id=p.student_id
    where s.email='aluno.teste.cfp.20261103@example.com') as refeicoes_ficticias;

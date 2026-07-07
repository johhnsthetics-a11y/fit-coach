create table if not exists public.app_admin_settings (
  key text primary key default 'global',
  settings jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.app_admin_settings enable row level security;

drop policy if exists "app_admin_settings_public_read" on public.app_admin_settings;
create policy "app_admin_settings_public_read"
on public.app_admin_settings
for select
using (true);

drop policy if exists "app_admin_settings_admin_insert" on public.app_admin_settings;
create policy "app_admin_settings_admin_insert"
on public.app_admin_settings
for insert
with check (
  lower(coalesce(auth.jwt() ->> 'email', '')) in (
    'admin@coachfitpro.com.br',
    'sac@coachfitpro.com.br'
  )
);

drop policy if exists "app_admin_settings_admin_update" on public.app_admin_settings;
create policy "app_admin_settings_admin_update"
on public.app_admin_settings
for update
using (
  lower(coalesce(auth.jwt() ->> 'email', '')) in (
    'admin@coachfitpro.com.br',
    'sac@coachfitpro.com.br'
  )
)
with check (
  lower(coalesce(auth.jwt() ->> 'email', '')) in (
    'admin@coachfitpro.com.br',
    'sac@coachfitpro.com.br'
  )
);

insert into public.app_admin_settings (key, settings)
values (
  'global',
  jsonb_build_object(
    'salesHeadline', 'A forma mais profissional de entregar consultoria fitness online.',
    'salesSubheadline', 'Centralize alunos, treinos, dieta, evolução, cobranças e chat em um painel moderno. Menos WhatsApp perdido, menos planilha solta e mais percepção de valor para vender acompanhamento recorrente.',
    'salesCta', 'Escolher meu plano',
    'announcement', 'Planos mensal, semestral e anual com pagamento integrado pela Cartpanda. Sem taxa por aluno.',
    'logoUrl', '',
    'salesTrustText', 'Pagamento pela Cartpanda, acesso liberado automaticamente e sem taxa por aluno cadastrado.',
    'primaryColor', '#00c7a8',
    'accentColor', '#3b82f6',
    'featureFlags', jsonb_build_object(
      'studentXp', true,
      'financialDashboard', true,
      'salesSimulator', true,
      'waterGoal', true
    ),
    'checkoutPlans', jsonb_build_array(
      jsonb_build_object(
        'id', 'mensal',
        'name', 'Mensal',
        'cycle', 'cobrança mensal',
        'badge', 'Mais flexível',
        'price', 'R$ 49,90',
        'suffix', '/mês',
        'oldPrice', '',
        'total', 'Total em 12 meses: R$ 598,80',
        'economy', 'Pague mês a mês',
        'checkoutUrl', 'https://pagamento.coachfitpro.com.br/checkout/211362994:1?subscription=4475',
        'description', 'Ideal para começar agora, validar o Coach Fit Pro na rotina e manter liberdade mês a mês.',
        'bestFor', 'Coach que quer iniciar sem compromisso longo e validar a experiência com os primeiros alunos.',
        'operatingPromise', 'Implante em etapas, cadastre alunos ativos e acompanhe o ganho de organização desde a primeira semana.',
        'highlights', jsonb_build_array('Acesso completo ao painel', 'Portal do aluno liberado', 'Sem taxa por aluno', 'Liberação automática após pagamento'),
        'activationPlan', jsonb_build_array('Criar conta e ativar o ciclo mensal', 'Cadastrar planos próprios e alunos atuais', 'Enviar convites e acompanhar a rotina pelo painel'),
        'decisionPoints', jsonb_build_array('mais flexibilidade', 'melhor para teste operacional', 'renovação mês a mês')
      ),
      jsonb_build_object(
        'id', 'semestral',
        'name', 'Semestral',
        'cycle', 'ciclo de 6 meses',
        'badge', 'Mais escolhido',
        'price', 'R$ 239,40',
        'suffix', '/semestre',
        'oldPrice', 'R$ 299,40',
        'total', 'Equivale a R$ 39,90/mês',
        'economy', 'Economize R$ 60,00',
        'checkoutUrl', 'https://pagamento.coachfitpro.com.br/checkout/211373219:1?subscription=4479',
        'description', 'Para coaches que querem estabilidade, previsibilidade e tempo suficiente para profissionalizar a carteira.',
        'bestFor', 'Coach que já tem carteira ativa e quer estruturar a operação sem ficar repensando assinatura todo mês.',
        'operatingPromise', 'Seis meses dão tempo para padronizar atendimento, reduzir retrabalho e aumentar percepção de valor.',
        'highlights', jsonb_build_array('Acesso completo ao painel', 'Menos renovações no ano', 'Rotina financeira previsível', 'Boa opção para equipes em crescimento'),
        'activationPlan', jsonb_build_array('Ativar o semestre com economia', 'Organizar alunos por planos e vencimentos', 'Criar rotina de treinos, dieta, check-ins e cobrança'),
        'decisionPoints', jsonb_build_array('equilíbrio ideal', 'economia sem travar por um ano', 'mais previsibilidade')
      ),
      jsonb_build_object(
        'id', 'anual',
        'name', 'Anual',
        'cycle', 'ciclo de 12 meses',
        'badge', 'Maior economia',
        'price', 'R$ 358,80',
        'suffix', '/ano',
        'oldPrice', 'R$ 598,00',
        'total', 'Equivale a R$ 29,90/mês',
        'economy', 'Economize R$ 239,20',
        'checkoutUrl', 'https://pagamento.coachfitpro.com.br/checkout/211363657:1?subscription=4476',
        'description', 'Para quem decidiu colocar o Coach Fit Pro como estrutura principal da operação.',
        'bestFor', 'Coach que quer operar o ano inteiro com menor custo mensal e foco em escala, retenção e rotina de equipe.',
        'operatingPromise', 'O ciclo anual transforma o app em infraestrutura fixa da operação, com menor custo equivalente por mês.',
        'highlights', jsonb_build_array('Acesso completo por 12 meses', 'Planejamento de longo prazo', 'Foco em escala e retenção', 'Melhor para operações maduras'),
        'activationPlan', jsonb_build_array('Ativar o ano com maior economia', 'Migrar a carteira em ondas semanais', 'Usar financeiro, ranking e indicadores para gestão contínua'),
        'decisionPoints', jsonb_build_array('maior economia', 'menor custo mensal', 'estrutura para longo prazo')
      )
    )
  )
)
on conflict (key) do update
set
  settings = excluded.settings || public.app_admin_settings.settings,
  updated_at = now();

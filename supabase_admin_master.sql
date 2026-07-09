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
  lower(coalesce(auth.jwt() ->> 'email', '')) = 'sac@coachfitpro.com.br'
);

drop policy if exists "app_admin_settings_admin_update" on public.app_admin_settings;
create policy "app_admin_settings_admin_update"
on public.app_admin_settings
for update
using (
  lower(coalesce(auth.jwt() ->> 'email', '')) = 'sac@coachfitpro.com.br'
)
with check (
  lower(coalesce(auth.jwt() ->> 'email', '')) = 'sac@coachfitpro.com.br'
);

insert into public.app_admin_settings (key, settings)
values (
  'global',
  jsonb_build_object(
    'salesHeadline', 'A forma mais simples de organizar sua consultoria online.',
    'salesSubheadline', 'Gerencie alunos, treino, dieta, cobrança recorrente e evolução em uma plataforma com experiência de app. Menos caos, mais previsibilidade e uma entrega que parece premium desde o primeiro acesso.',
    'salesCta', 'Começar agora',
    'announcement', 'Sem planilha solta. Sem cobrança perdida. Sem aluno perguntando onde está o treino.',
    'logoUrl', '',
    'salesTrustText', 'Pagamento pela Cartpanda, acesso liberado automaticamente e sem taxa por aluno cadastrado.',
    'primaryColor', '#00c7a8',
    'accentColor', '#3b82f6',
    'appBackgroundColor', '#000000',
    'salesBackgroundColor', '#00150f',
    'salesSurfaceColor', '#07110f',
    'salesTextColor', '#f8fafc',
    'ctaColor', '#00d2b2',
    'ctaTextColor', '#020617',
    'headerBackgroundColor', 'rgba(0, 0, 0, 0.68)',
    'publishedAt', now()::text,
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
        'badge', 'Primeiro mês R$ 9,90',
        'price', 'R$ 9,90',
        'suffix', 'no 1º mês',
        'oldPrice', 'R$ 49,90',
        'total', 'Depois R$ 49,90/mês',
        'economy', 'Economize R$ 40,00 na ativação',
        'checkoutUrl', 'https://pagamento.coachfitpro.com.br/checkout/211362994:1?subscription=4475',
        'description', 'Comece pagando pouco no primeiro mês, valide a operação com alunos reais e mantenha liberdade para continuar mês a mês.',
        'bestFor', 'Coach que quer entrar com baixo risco, testar a experiência premium com os primeiros alunos e validar o impacto antes de assumir um ciclo maior.',
        'operatingPromise', 'A oferta de entrada reduz a barreira para começar agora. Você ativa a estrutura, organiza os alunos atuais e decide a continuidade com dados reais da operação.',
        'highlights', jsonb_build_array('Primeiro mês por R$ 9,90', 'Depois R$ 49,90/mês', 'Acesso completo ao painel', 'Portal do aluno liberado', 'Sem taxa por aluno', 'Liberação automática após pagamento'),
        'activationPlan', jsonb_build_array('Ativar o primeiro mês promocional', 'Cadastrar planos próprios e alunos atuais', 'Enviar convites e acompanhar a rotina pelo painel'),
        'decisionPoints', jsonb_build_array('R$ 9,90 para começar', 'baixo risco de entrada', 'renovação mensal depois')
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
  settings = public.app_admin_settings.settings || jsonb_build_object(
    'checkoutPlans', excluded.settings -> 'checkoutPlans',
    'featureFlags', coalesce(public.app_admin_settings.settings -> 'featureFlags', '{}'::jsonb) || coalesce(excluded.settings -> 'featureFlags', '{}'::jsonb),
    'salesTrustText', excluded.settings ->> 'salesTrustText',
    'primaryColor', excluded.settings ->> 'primaryColor',
    'accentColor', excluded.settings ->> 'accentColor',
    'appBackgroundColor', excluded.settings ->> 'appBackgroundColor',
    'salesBackgroundColor', excluded.settings ->> 'salesBackgroundColor',
    'salesSurfaceColor', excluded.settings ->> 'salesSurfaceColor',
    'salesTextColor', excluded.settings ->> 'salesTextColor',
    'ctaColor', excluded.settings ->> 'ctaColor',
    'ctaTextColor', excluded.settings ->> 'ctaTextColor',
    'headerBackgroundColor', excluded.settings ->> 'headerBackgroundColor',
    'publishedAt', coalesce(public.app_admin_settings.settings ->> 'publishedAt', excluded.settings ->> 'publishedAt', now()::text)
  ),
  updated_at = now();

update public.app_admin_settings
set
  settings = settings || jsonb_build_object(
    'salesHeadline', 'A forma mais simples de organizar sua consultoria online.',
    'salesSubheadline', 'Gerencie alunos, treino, dieta, cobrança recorrente e evolução em uma plataforma com experiência de app. Menos caos, mais previsibilidade e uma entrega que parece premium desde o primeiro acesso.',
    'salesCta', 'Começar agora',
    'announcement', 'Sem planilha solta. Sem cobrança perdida. Sem aluno perguntando onde está o treino.'
  ),
  updated_at = now()
where key = 'global';

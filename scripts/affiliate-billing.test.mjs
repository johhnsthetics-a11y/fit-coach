import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFile } from 'node:fs/promises'

import { getAffiliateFinanceDefaultPeriod } from '../src/affiliateFinance.js'
import {
  getProfessionalBillingLabel,
  getStudentAppPaymentLabel,
  summarizeStudentInvoices,
} from '../src/studentBillingView.js'

const migrationUrl = new URL('../SUPABASE/migrations/20260924_affiliate_student_billing.sql', import.meta.url)

test('fatura do aluno usa status profissional e totais sincronizados', () => {
  assert.equal(getStudentAppPaymentLabel('active'), 'COACH FIT PRO ATIVO')
  assert.equal(getProfessionalBillingLabel('trainer'), 'Treinador')
  assert.equal(getProfessionalBillingLabel('nutritionist'), 'Nutricionista')
  assert.deepEqual(summarizeStudentInvoices([
    { status: 'Pago', amount: 150 },
    { status: 'Pendente', amount: 90 },
    { status: 'Atrasado', amount: 60 },
    { status: 'Cancelado', amount: 500 },
  ]), {
    paidTotal: 150,
    pendingTotal: 150,
    pendingCount: 2,
  })
})

test('comissoes adapta audiencia e valida o WhatsApp de resgate', async () => {
  const helpers = await import('../src/studentBillingView.js')

  assert.deepEqual(helpers.getCommissionAudience('trainer'), {
    singular: 'Aluno',
    plural: 'Alunos',
    singularLower: 'aluno',
    pluralLower: 'alunos',
  })
  assert.equal(helpers.getCommissionAudience('nutritionist').singular, 'Paciente')
  assert.equal(helpers.normalizeCommissionWhatsappUrl('https://wa.me/5511999999999'), 'https://wa.me/5511999999999')
  assert.equal(helpers.normalizeCommissionWhatsappUrl('https://api.whatsapp.com/send?phone=5511999999999'), 'https://api.whatsapp.com/send?phone=5511999999999')
  assert.equal(helpers.normalizeCommissionWhatsappUrl('https://example.com/resgate'), '')
  assert.equal(helpers.normalizeCommissionWhatsappUrl('javascript:alert(1)'), '')
})

test('comissoes usa um unico cabecalho, branding tematico, resgate e PDF', async () => {
  const app = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8')
  const css = await readFile(new URL('../src/index.css', import.meta.url), 'utf8')
  const start = app.indexOf('export function ProfessionalCommissionsPage')
  const end = app.indexOf('function AffiliateFinancePage', start)
  const page = app.slice(start, end)

  assert.ok(start > 0 && end > start)
  assert.doesNotMatch(page, /<h[1-6][^>]*>Comissões<\/h[1-6]>/)
  assert.match(page, /getCommissionAudience\(professionalType\)/)
  assert.match(page, /Resgatar/)
  assert.match(page, /commissionWhatsappUrl/)
  assert.match(page, /exportProfessionalCommissionsPdf/)
  assert.match(app, /exportAffiliateFinancePdf/)
  assert.match(app, /commissionWhatsappUrl:/)
  assert.match(css, /professional-commissions-page/)
  assert.match(css, /app-theme-light[\s\S]*professional-commissions-page/)
})

test('perfil e cadastro de afiliado ficam isolados pela conta autenticada', async () => {
  const api = await readFile(new URL('../src/supabaseApi.js', import.meta.url), 'utf8')
  const app = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8')

  assert.match(api, /export async function loadRemoteData\(currentUserId/)
  assert.match(api, /users\?select=\*&id=eq\.\$\{encodeURIComponent\(currentUserId\)\}/)
  assert.match(api, /export async function loadRemoteProfessionalProfileByEmail/)
  assert.match(api, /users\?select=id,name,email,role&email=eq\./)
  assert.match(app, /loadRemoteProfessionalProfileByEmail\(normalizedEmail\)/)
  assert.match(app, /professionalType: detectedProfile\?\.professionalType/)
  assert.match(app, /setAffiliates\(\(current\)/)
})

test('profissional consulta somente as proprias comissoes confirmadas', async () => {
  const sql = await readFile(new URL('../SUPABASE/migrations/20261001160000_professional_commission_report.sql', import.meta.url), 'utf8')
  const hardeningSql = await readFile(new URL('../SUPABASE/migrations/20261001163000_harden_professional_commission_report.sql', import.meta.url), 'utf8')
  const api = await readFile(new URL('../src/supabaseApi.js', import.meta.url), 'utf8')
  const app = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8')

  assert.match(sql, /create or replace function public\.get_my_commission_report/i)
  assert.match(sql, /current_user_id uuid := auth\.uid\(\)/i)
  assert.match(sql, /payments\.coach_id = current_user_id/i)
  assert.match(sql, /payments\.status = 'paid'/i)
  assert.match(sql, /affiliates\.active = true/i)
  assert.match(sql, /grant execute on function public\.get_my_commission_report\(date, date\) to authenticated/i)
  assert.match(hardeningSql, /alter function public\.get_my_commission_report\(date, date\) security invoker/i)
  assert.match(hardeningSql, /affiliate_student_payments\.coach_id = auth\.uid\(\)/i)
  assert.match(hardeningSql, /affiliate_professionals\.email = lower\(coalesce\(auth\.jwt\(\) ->> 'email', ''\)\)/i)
  assert.match(api, /loadRemoteProfessionalCommissionReport/)
  assert.match(api, /get_my_commission_report/)
  assert.match(app, /id: 'comissoes', label: 'Comissões'/)
  assert.match(app, /export function ProfessionalCommissionsPage\(\{[\s\S]*loadCommissionReport = loadRemoteProfessionalCommissionReport/)
  assert.match(app, /activeView === 'comissoes' && professionalAffiliate/)
  assert.doesNotMatch(app, /professionalAffiliate \? 'Afiliado'/)
  assert.doesNotMatch(app, /Seu vínculo de afiliado foi confirmado/)
})

test('financeiro abre nos ultimos 30 dias mesmo na virada do mes', () => {
  assert.deepEqual(
    getAffiliateFinanceDefaultPeriod(new Date(2026, 9, 1, 12, 0, 0)),
    { startDate: '2026-09-02', endDate: '2026-10-01' },
  )
})

test('relatorio financeiro interpreta os limites no fuso de Sao Paulo', async () => {
  const sql = await readFile(new URL('../SUPABASE/migrations/20261001133851_fix_affiliate_finance_timezone.sql', import.meta.url), 'utf8')

  assert.match(sql, /alter function public\.get_affiliate_finance_report\(date, date\)/i)
  assert.match(sql, /set timezone (?:to|=) 'America\/Sao_Paulo'/i)
})

test('afiliados ficam em tabela separada e protegida pelo Admin Master', async () => {
  const sql = await readFile(migrationUrl, 'utf8')

  assert.match(sql, /create table if not exists public\.affiliate_professionals/i)
  assert.match(sql, /alter table public\.affiliate_professionals enable row level security/i)
  assert.match(sql, /affiliate_professionals_master_select/i)
  assert.match(sql, /affiliate_professionals_master_insert/i)
  assert.match(sql, /affiliate_professionals_master_update/i)
  assert.match(sql, /affiliate_professionals_master_delete/i)
  assert.match(sql, /sac@coachfitpro\.com\.br/i)
  assert.doesNotMatch(sql, /insert into public\.admin_users/i)
})

test('somente profissionais afiliados exigem pagamento do app', async () => {
  const sql = await readFile(migrationUrl, 'utf8')

  assert.match(sql, /coachfit_professional_requires_app_payment/i)
  assert.match(sql, /affiliates\.email = lower\(btrim\(users\.email\)\)/i)
  assert.match(sql, /not public\.coachfit_professional_requires_app_payment\(invites\.coach_id\)/i)
  assert.match(sql, /students\.app_payment_status = 'active'/i)
  assert.match(sql, /students\.payment = 'Pago'/i)
})

test('checkout por convite só pode ser criado para profissional afiliado', async () => {
  const sql = await readFile(migrationUrl, 'utf8')

  assert.match(sql, /create or replace function public\.create_student_checkout_session_by_invite/i)
  assert.match(sql, /if not public\.coachfit_professional_requires_app_payment\(active_invite\.coach_id\) then/i)
  assert.match(sql, /Este profissional nao exige pagamento do aplicativo/i)
})

test('portal informa ao frontend se a cobrança do app é obrigatória', async () => {
  const sql = await readFile(migrationUrl, 'utf8')
  const api = await readFile(new URL('../src/supabaseApi.js', import.meta.url), 'utf8')

  assert.match(sql, /'app_payment_required', app_payment_required/i)
  assert.match(api, /appPaymentRequired:\s*payload\.app_payment_required === true/)
})

test('Cadastro de Afiliados gerencia afiliados por e-mail sem conceder privilégio administrativo', async () => {
  const app = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8')
  const api = await readFile(new URL('../src/supabaseApi.js', import.meta.url), 'utf8')

  assert.match(app, /Cadastro de Afiliados/)
  assert.doesNotMatch(app, /AdminAccordionSection title="Afiliados e acesso"/)
  assert.match(app, /E-mail do profissional afiliado/)
  assert.match(app, /Vincular profissional/)
  assert.match(app, /loadRemoteAffiliateProfessionals/)
  assert.match(app, /saveRemoteAffiliateProfessional/)
  assert.match(app, /deleteRemoteAffiliateProfessional/)
  assert.match(api, /affiliate_professionals\?select=\*/)
  assert.match(api, /affiliate_professionals\?on_conflict=email/)
  assert.match(api, /affiliate_professionals\?id=eq\./)
})


test('profissional afiliado recebe acesso profissional sem mensalidade', async () => {
  const sql = await readFile(new URL('../SUPABASE/migrations/20260924_affiliate_professional_access.sql', import.meta.url), 'utf8')
  const api = await readFile(new URL('../src/supabaseApi.js', import.meta.url), 'utf8')
  const app = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8')

  assert.match(sql, /coachfit_current_professional_is_affiliate/i)
  assert.match(sql, /auth\.uid\(\) is not null/i)
  assert.match(sql, /auth\.jwt\(\) ->> 'email'/i)
  assert.match(sql, /grant execute on function public\.coachfit_current_professional_is_affiliate\(\) to authenticated/i)
  assert.match(api, /loadRemoteCurrentProfessionalAffiliate/)
  assert.match(api, /professionalAffiliate/)
  assert.match(app, /professionalAccessActive = coachSubscriptionActive \|\| professionalAffiliate/)
  assert.match(app, /remoteData\.professionalAffiliate/)
  assert.match(app, /setActiveViewSafely\('visao'\)/)
  assert.match(app, /item\.id !== 'assinatura'/)
  assert.match(app, /funil normal de assinatura/)
})

test('profissional conectado recebe liberacao automatica quando o Admin o vincula como afiliado', async () => {
  const api = await readFile(new URL('../src/supabaseApi.js', import.meta.url), 'utf8')
  const app = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8')

  assert.match(api, /loadRemoteCurrentProfessionalAffiliate\(\)\.catch\(\(\) => false\)/)
  assert.match(api, /professionalAffiliate,\s*\n\s*}/)
  assert.match(app, /professionalAffiliate:\s*false/)
  assert.match(app, /loadRemoteCurrentProfessionalAffiliate,/)
  assert.match(app, /AFFILIATE_ACCESS_REFRESH_MS/)
  assert.match(app, /setInterval\(refreshProfessionalAffiliateAccess,\s*AFFILIATE_ACCESS_REFRESH_MS\)/)
  assert.match(app, /professionalAffiliate:\s*true/)
  assert.match(app, /Seu acesso profissional foi confirmado/)
  assert.doesNotMatch(app, /Seu vínculo de afiliado foi confirmado/)
})


test('dashboard de comissões usa somente mensalidades confirmadas', async () => {
  const sql = await readFile(new URL('../SUPABASE/migrations/20260924_affiliate_commission_dashboard.sql', import.meta.url), 'utf8')
  const api = await readFile(new URL('../src/supabaseApi.js', import.meta.url), 'utf8')
  const app = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8')

  assert.match(sql, /create table if not exists public\.affiliate_student_payments/i)
  assert.match(sql, /webhook_event_id text not null unique/i)
  assert.match(sql, /revenue_cents integer not null default 2500/i)
  assert.match(sql, /commission_rate numeric\(5,4\) not null default 0\.2500/i)
  assert.match(sql, /commission_cents integer not null default 625/i)
  assert.match(sql, /payments\.status = 'paid'/i)
  assert.match(sql, /get_affiliate_commission_dashboard/i)
  assert.match(sql, /Acesso exclusivo do Admin Master/i)
  assert.match(api, /loadRemoteAffiliateCommissionDashboard/)
  assert.match(api, /get_affiliate_commission_dashboard/)
  assert.match(app, /Financeiro de afiliados/)
  assert.match(app, /Receita e comissão sem misturar valores pendentes/)
  assert.match(app, /R\$ 25,00 de receita e R\$ 6,25 de comissão/)
  assert.match(app, /Exportar PDF/)
  assert.match(app, /Exportar CSV/)
  assert.match(app, /Exportar vendas/)
})

test('webhook cria lançamento idempotente e remove estorno da comissão', async () => {
  const webhook = await readFile(new URL('../supabase/functions/cartpanda-webhook/index.ts', import.meta.url), 'utf8')

  assert.match(webhook, /findActiveAffiliateForCoach/)
  assert.match(webhook, /recordAffiliateStudentPayment/)
  assert.match(webhook, /webhook_event_id: input\.eventId/)
  assert.match(webhook, /revenue_cents: 2500/)
  assert.match(webhook, /commission_cents: 625/)
  assert.match(webhook, /resolution=ignore-duplicates/)
  assert.match(webhook, /incomingStatus === 'refunded' \|\| incomingStatus === 'chargeback'/)
  assert.match(webhook, /transition\.apply/)
  assert.match(webhook, /reverseAffiliateStudentPayment/)
  assert.match(webhook, /reversal_event_id: input\.eventId/)
})


test('financeiro de afiliados fica em página separada com período livre e exportação', async () => {
  const sql = await readFile(new URL('../SUPABASE/migrations/20260924_affiliate_finance_report.sql', import.meta.url), 'utf8')
  const api = await readFile(new URL('../src/supabaseApi.js', import.meta.url), 'utf8')
  const app = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8')

  assert.match(sql, /get_affiliate_finance_report/i)
  assert.match(sql, /p_start_date date/i)
  assert.match(sql, /p_end_date date/i)
  assert.match(sql, /payments\.paid_at >= start_date::timestamptz/i)
  assert.match(sql, /payments\.paid_at < end_exclusive/i)
  assert.match(sql, /payments\.status = 'paid'/i)
  assert.match(sql, /studentName/i)
  assert.match(sql, /providerOrderId/i)
  assert.match(api, /loadRemoteAffiliateFinanceReport/)
  assert.match(api, /get_affiliate_finance_report/)
  assert.match(app, /admin-affiliate-finance/)
  assert.match(app, /Financeiro de afiliados/)
  assert.match(app, /Data inicial/)
  assert.match(app, /Data final/)
  assert.match(app, /Aplicar período/)
  assert.match(app, /Últimos 30 dias/)
  assert.match(app, /Últimos 90 dias/)
  assert.match(app, /Ano atual/)
  assert.match(app, /Exportar PDF/)
  assert.match(app, /Exportar CSV/)
  assert.match(app, /Exportar vendas/)
  assert.match(app, /text\/csv;charset=utf-8/)
  assert.match(app, /Gestão de Afiliados/)
  assert.match(app, /role="tablist"/)
  assert.match(app, /Financeiro de Afiliados/)
  assert.match(app, /Cadastro de Afiliados/)
  assert.match(app, /aria-selected=\{selected\}/)
  assert.match(app, /activeTab === 'finance'/)
  assert.match(app, /<AffiliateProfessionalsPanel \/>/)
  assert.doesNotMatch(app, /Financeiro separado do cadastro/)
})


test('Financeiro e Cadastro de Afiliados alternam como abas na mesma página', async () => {
  const app = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8')

  assert.match(app, /function AffiliateAdminPage\(\)/)
  assert.match(app, /const \[activeTab, setActiveTab\] = useState\('registration'\)/)
  assert.match(app, /label: 'Financeiro de Afiliados'/)
  assert.match(app, /label: 'Cadastro de Afiliados'/)
  assert.match(app, /role="tab"/)
  assert.match(app, /aria-controls=/)
  assert.match(app, /id="affiliate-panel-finance"/)
  assert.match(app, /id="affiliate-panel-registration"/)
  assert.match(app, /<AffiliateFinancePage \/>/)
  assert.match(app, /<AffiliateProfessionalsPanel \/>/)
  assert.doesNotMatch(app, /onOpenAffiliateFinance/)
})


test('Gestão de Afiliados usa layout SaaS claro, responsivo e acessível', async () => {
  const app = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8')

  assert.match(app, /max-w-\[1200px\]/)
  assert.match(app, /bg-\[#F8FAFA\]/)
  assert.match(app, /Admin Master/)
  assert.match(app, /Afiliados/)
  assert.match(app, /Gestão de Afiliados/)
  assert.match(app, /bg-\[#EAF7F4\]/)
  assert.match(app, /border-\[#E3E8E8\]/)
  assert.match(app, /focus-visible:ring-2/)
  assert.match(app, /min-h-11/)
})

test('Cadastro de Afiliados mantém validações inline e fluxo pré-cadastro', async () => {
  const app = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8')

  assert.match(app, /Informe um e-mail válido/)
  assert.match(app, /já está vinculado como afiliado/)
  assert.match(app, /ainda não foi encontrado com este e-mail/)
  assert.match(app, /Vínculo realizado com sucesso/)
  assert.match(app, /Vinculando\.\.\./)
  assert.match(app, /aria-invalid=/)
  assert.match(app, /Nenhum afiliado vinculado ainda/)
  assert.match(app, /Aguardando cadastro/)
})

test('Cadastro de Afiliados prepara tabela desktop e cards mobile sem alterar ações existentes', async () => {
  const app = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8')

  assert.match(app, /Nome do profissional/)
  assert.match(app, /Categoria/)
  assert.match(app, /Data do vínculo/)
  assert.match(app, /Status/)
  assert.match(app, /Visualizar detalhes/)
  assert.match(app, /Desativar afiliado/)
  assert.match(app, /Reativar afiliado/)
  assert.match(app, /Desvincular/)
  assert.match(app, /hidden overflow-visible md:block/)
  assert.match(app, /md:hidden/)
  assert.match(app, /Pendente/)
})


test('CTA de vínculo fica alinhado ao input e visualmente destacado', async () => {
  const app = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8')

  assert.match(app, /lg:col-start-1 lg:row-start-2/)
  assert.match(app, /lg:col-start-2 lg:row-start-2/)
  assert.match(app, /lg:col-start-1 lg:row-start-3/)
  assert.match(app, /bg-\[#0F766E\]/)
  assert.match(app, /font-bold text-white/)
  assert.match(app, /lg:min-w-\[205px\]/)
})


test('view legada CartPanda nao expoe eventos do webhook a clientes', async () => {
  const migration = await readFile(new URL('../SUPABASE/migrations/20260925_cartpanda_webhook_view_security.sql', import.meta.url), 'utf8')
  const setup = await readFile(new URL('../supabase_cartpanda_assinatura.sql', import.meta.url), 'utf8')

  assert.match(migration, /security_invoker\s*=\s*true/i)
  assert.match(migration, /revoke all on public\.cartpanda_webhook_events from anon, authenticated/i)
  assert.match(migration, /revoke all on public\.payment_webhook_events from anon, authenticated/i)
  assert.match(setup, /security_invoker\s*=\s*true/i)
  assert.match(setup, /revoke all on public\.cartpanda_webhook_events from anon, authenticated/i)
})

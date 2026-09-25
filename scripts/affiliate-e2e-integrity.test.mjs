import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const integrityUrl = new URL('../SUPABASE/migrations/20260925_affiliate_e2e_integrity.sql', import.meta.url)

test('checkout persiste atribuicao do afiliado no backend', async () => {
  const sql = await readFile(integrityUrl, 'utf8')

  assert.match(sql, /source_invite_id uuid/i)
  assert.match(sql, /affiliate_email_snapshot text/i)
  assert.match(sql, /professional_type_snapshot text/i)
  assert.match(sql, /offer_code text/i)
  assert.match(sql, /active_invite\.id/i)
  assert.match(sql, /lower\(btrim\(v_user\.email\)\)/i)
  assert.match(sql, /student_monthly_25_v1/i)
  assert.match(sql, /patient_monthly_25_v1/i)
})

test('processador de pagamento rejeita valor incorreto, replay e evento antigo', async () => {
  const sql = await readFile(integrityUrl, 'utf8')

  assert.match(sql, /process_cartpanda_student_payment_event/i)
  assert.match(sql, /coalesce\(p_amount_cents, -1\) <> 2500/i)
  assert.match(sql, /pg_advisory_xact_lock/i)
  assert.match(sql, /duplicate_event/i)
  assert.match(sql, /stale_event_ignored/i)
  assert.match(sql, /last_provider_event_at/i)
  assert.match(sql, /last_provider_event_rank/i)
  assert.match(sql, /grant execute[\s\S]*to service_role/i)
  assert.doesNotMatch(
    sql.slice(sql.indexOf('create or replace function public.process_cartpanda_student_payment_event')),
    /grant execute[\s\S]*to anon/i,
  )
})

test('reembolso e chargeback removem venda da comissao ativa', async () => {
  const sql = await readFile(integrityUrl, 'utf8')

  assert.match(sql, /v_effective_status in \('refunded', 'chargeback'\)/i)
  assert.match(sql, /status = v_effective_status/i)
  assert.match(sql, /reversal_event_id = p_event_id/i)
  assert.match(sql, /reversed_at = v_event_at/i)
})

test('view de webhook bruto deixa de ser exposta a clientes', async () => {
  const sql = await readFile(integrityUrl, 'utf8')

  assert.match(sql, /alter view public\.cartpanda_webhook_events set \(security_invoker = true\)/i)
  assert.match(sql, /revoke all on public\.cartpanda_webhook_events from public, anon, authenticated/i)
  assert.match(sql, /grant select on public\.cartpanda_webhook_events to service_role/i)
})

test('novos alunos reutilizam identidade e backend impede novas duplicidades', async () => {
  const api = await readFile(new URL('../src/supabaseApi.js', import.meta.url), 'utf8')
  const sql = await readFile(integrityUrl, 'utf8')
  const app = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8')

  assert.match(api, /normalizedEmail/)
  assert.match(api, /normalizedPhone/)
  assert.match(api, /uniqueMatches/)
  assert.match(sql, /students_coach_normalized_email_unique/i)
  assert.match(sql, /coachfit_reject_new_duplicate_student_phone/i)
  assert.match(app, /String\(savedStudent\.id\)/)
})

test('cobranca de aluno fica exclusiva de profissional afiliado', async () => {
  const sql = await readFile(integrityUrl, 'utf8')
  const app = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8')

  assert.match(sql, /if not public\.coachfit_professional_requires_app_payment\(auth\.uid\(\)\) then/i)
  assert.match(app, /affiliateBillingEnabled=\{professionalAffiliate\}/)
  assert.match(app, /Acesso sem cobrança adicional do app/)
  assert.match(app, /assinatura mensal de R\$ 25/)
})

test('profissional afiliado recebe apenas as proprias metricas', async () => {
  const sql = await readFile(integrityUrl, 'utf8')
  const api = await readFile(new URL('../src/supabaseApi.js', import.meta.url), 'utf8')
  const app = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8')

  assert.match(sql, /get_my_affiliate_report/i)
  assert.match(sql, /payments\.coach_id = auth\.uid\(\)/i)
  assert.match(sql, /payments\.affiliate_email = v_email/i)
  assert.match(api, /loadRemoteMyAffiliateReport/)
  assert.match(api, /loadRemoteCurrentProfessionalAffiliate\(\)\.catch\(\(\) => false\)/)
  assert.match(app, /Programa de afiliados/)
  assert.match(app, /Sua comissão/)
})

test('logs do webhook evitam payload, token e e-mail completo', async () => {
  const webhook = await readFile(new URL('../supabase/functions/cartpanda-webhook/index.ts', import.meta.url), 'utf8')

  assert.match(webhook, /cartpanda_webhook_received/)
  assert.match(webhook, /cartpanda_student_event_processed/)
  assert.match(webhook, /shortEventRef/)
  assert.doesNotMatch(webhook, /console\.(log|info|error)\([^\n]*buyerEmail/)
  assert.doesNotMatch(webhook, /console\.(log|info|error)\([^\n]*WEBHOOK_TOKEN/)
})

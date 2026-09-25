import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

import {
  addBillingCycle,
  buildStudentAccessUrl,
  isSubscriptionCurrent,
  normalizeBillingCycle,
} from '../src/studentAccess.js'

test('link de acesso usa somente o convite opaco e preserva a rota do app', () => {
  assert.equal(
    buildStudentAccessUrl('https://app.coachfitpro.com.br/login?mode=signin', '4a1f20e6d0bb4f30a1abf99ed673cba8'),
    'https://app.coachfitpro.com.br/login?invite=4a1f20e6d0bb4f30a1abf99ed673cba8',
  )
})

test('ciclo mensal preserva o dia-base usando o ultimo dia valido do mes', () => {
  assert.equal(addBillingCycle('2026-01-31', 'mensal'), '2026-02-28')
  assert.equal(addBillingCycle('2028-01-31', 'mensal'), '2028-02-29')
})

test('ciclos semanal, semestral e anual usam calendario', () => {
  assert.equal(addBillingCycle('2026-09-10', 'semanal'), '2026-09-17')
  assert.equal(addBillingCycle('2026-08-31', 'semestral'), '2027-02-28')
  assert.equal(addBillingCycle('2028-02-29', 'anual'), '2029-02-28')
  assert.equal(normalizeBillingCycle('6 meses'), 'semestral')
})

test('assinatura profissional ativa expira pela data do periodo', () => {
  assert.equal(isSubscriptionCurrent({ status: 'active', currentPeriodEndsAt: '2026-09-20T23:59:59Z' }, Date.parse('2026-09-21T12:00:00Z')), false)
  assert.equal(isSubscriptionCurrent({ status: 'active', currentPeriodEndsAt: '2026-09-22T23:59:59Z' }, Date.parse('2026-09-21T12:00:00Z')), true)
  assert.equal(isSubscriptionCurrent({ status: 'pending' }, Date.parse('2026-09-21T12:00:00Z')), false)
})

test('migration implementa vencimentos, checkout por convite e acesso centralizado', async () => {
  const sql = await readFile(new URL('../SUPABASE/migrations/20260921_student_access_funnel.sql', import.meta.url), 'utf8')
  assert.match(sql, /billing_cycle/i)
  assert.match(sql, /first_due_date/i)
  assert.match(sql, /next_due_date/i)
  assert.match(sql, /create_student_checkout_session_by_invite/i)
  assert.match(sql, /coachfit_next_billing_date/i)
  assert.match(sql, /app_subscription_expires_at/i)
  assert.doesNotMatch(sql, /update public\.student_invites/i)
  assert.match(sql, /returns table \(checkout_token uuid, status text, expires_at timestamptz\)/i)
  assert.match(sql, /grant execute on function public\.create_student_checkout_session_by_invite\(text\) to anon, authenticated/i)
})

test('webhook ignora replay e persiste periodo do aluno no processador atomico', async () => {
  const webhook = await readFile(new URL('../supabase/functions/cartpanda-webhook/index.ts', import.meta.url), 'utf8')
  const integrity = await readFile(new URL('../SUPABASE/migrations/20260925_affiliate_e2e_integrity.sql', import.meta.url), 'utf8')
  assert.match(webhook, /findProcessedWebhookEvent/)
  assert.match(webhook, /process_cartpanda_student_payment_event/)
  assert.match(webhook, /resolveWebhookEventId/)
  assert.match(integrity, /app_subscription_started_at/)
  assert.match(integrity, /app_subscription_expires_at/)
  assert.match(integrity, /duplicate_event/)
  const confirmationBlock = webhook.slice(webhook.indexOf('function isConfirmedPayment'), webhook.indexOf('function parseMoneyToCents'))
  assert.match(confirmationBlock, /order_type/)
})

test('frontend oferece ativacao pelo convite e atualiza o portal automaticamente', async () => {
  const app = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8')
  const api = await readFile(new URL('../src/supabaseApi.js', import.meta.url), 'utf8')
  assert.match(app, /Ativar meu acesso/)
  assert.match(app, /buildStudentAccessUrl/)
  assert.match(app, /inviteIsUsable/)
  assert.match(app, /Falar com \{professionalLabel\}/)
  assert.match(api, /create_student_checkout_session_by_invite/)
  assert.match(api, /financialAccessOpen:\s*payload\.financial_access_open/)
})

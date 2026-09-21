import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFile } from 'node:fs/promises'

import { buildStudentCheckoutUrl, resolveAudienceCheckoutUrl } from '../src/studentPayment.js'

test('link individual preserva o checkout e adiciona o token cid', () => {
  assert.equal(
    buildStudentCheckoutUrl('https://pagamento.exemplo.com/checkout/123:1?subscription=9', '5cf348b5-82ed-48fe-8e60-5dc0f34cd6c1'),
    'https://pagamento.exemplo.com/checkout/123:1?subscription=9&cid=5cf348b5-82ed-48fe-8e60-5dc0f34cd6c1',
  )
  assert.equal(buildStudentCheckoutUrl('javascript:alert(1)', 'token'), '')
})

test('treinador usa checkout de aluno e nutricionista usa checkout de paciente', () => {
  assert.equal(resolveAudienceCheckoutUrl({ nutritionist: false }), 'https://pagamento.coachfitpro.com.br/checkout?subscription=4664')
  assert.equal(resolveAudienceCheckoutUrl({ nutritionist: true }), 'https://pagamento.coachfitpro.com.br/checkout/212922722:1?subscription=4665')
})

test('frontend cria a sessão no banco antes de montar o link', async () => {
  const api = await readFile(new URL('../src/supabaseApi.js', import.meta.url), 'utf8')
  const app = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8')

  assert.match(api, /create_student_checkout_session/)
  assert.match(app, /Gerar link de pagamento/)
  assert.match(app, /VITE_FITCOACH_STUDENT_CHECKOUT_URL/)
  assert.match(app, /VITE_FITCOACH_PATIENT_CHECKOUT_URL/)
})

test('webhook usa cid persistido antes do fallback de assinatura do coach', async () => {
  const webhook = await readFile(new URL('../supabase/functions/cartpanda-webhook/index.ts', import.meta.url), 'utf8')

  assert.match(webhook, /findString\(payload, \['cid', 'click_id'/)
  assert.match(webhook, /student_checkout_sessions/)
  assert.match(webhook, /app_payment_status:\s*input\.status/)
  assert.match(webhook, /reason: 'student_checkout_not_found'/)
})

test('pagamento Cartpanda nao sobrescreve a mensalidade do profissional', async () => {
  const webhook = await readFile(new URL('../supabase/functions/cartpanda-webhook/index.ts', import.meta.url), 'utf8')
  const app = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8')
  const api = await readFile(new URL('../src/supabaseApi.js', import.meta.url), 'utf8')

  assert.doesNotMatch(webhook, /\/rest\/v1\/students\?[^`]*[\s\S]*?payment:/)
  assert.match(api, /appPaymentStatus:\s*row\.app_payment_status/)
  assert.match(app, /student\.payment\s*===\s*'Pago'/)
  assert.match(app, /student\.appPaymentStatus\s*===\s*'active'/)
})

test('banco vincula cada token ao aluno pertencente ao profissional autenticado', async () => {
  const sql = await readFile(new URL('../supabase/migrations/20260921_student_cartpanda_payments.sql', import.meta.url), 'utf8')

  assert.match(sql, /create table if not exists public\.student_checkout_sessions/i)
  assert.match(sql, /create or replace function public\.create_student_checkout_session/i)
  assert.match(sql, /students\.coach_id = auth\.uid\(\)/i)
  assert.match(sql, /checkout_sessions\.status = 'pending'/i)
  assert.doesNotMatch(sql, /\band status = 'pending'/i)
  assert.match(sql, /grant execute on function public\.create_student_checkout_session\(uuid\) to authenticated/i)
  assert.doesNotMatch(sql, /grant (all|insert|update|delete)[^;]* to anon/i)
})

test('area do aluno prioriza cabecalho e navegacao essencial', async () => {
  const app = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8')

  assert.match(app, /student-header-nav/)
  assert.match(app, /const primaryStudentNavItems = \[/)
  assert.match(app, /id: 'inicio'/)
  assert.match(app, /id: 'treino'/)
  assert.match(app, /id: 'dieta'/)
  assert.match(app, /id: 'progresso'/)
  assert.match(app, /Abrir menu do aluno/)
})

test('backend bloqueia conteudo e execucao quando um dos pagamentos esta pendente', async () => {
  const sql = await readFile(new URL('../SUPABASE/migrations/20260921_student_payment_backend_enforcement.sql', import.meta.url), 'utf8')

  assert.match(sql, /students\.payment = 'Pago'/i)
  assert.match(sql, /students\.app_payment_status = 'active'/i)
  assert.match(sql, /create or replace function public\.get_student_portal\(invite_code text\)/i)
  assert.match(sql, /create or replace function public\.get_student_workouts\(invite_code text\)/i)
  assert.match(sql, /create or replace function public\.save_student_workout_session/i)
  assert.match(sql, /create or replace function public\.complete_student_workout_session/i)
  assert.match(sql, /revoke all on function public\.get_student_portal_unchecked\(text\) from public, anon, authenticated/i)
})

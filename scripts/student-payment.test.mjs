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
  assert.match(webhook, /payment:\s*input\.status === 'active' \? 'Pago' : 'Pendente'/)
  assert.match(webhook, /reason: 'student_checkout_not_found'/)
})

test('banco vincula cada token ao aluno pertencente ao profissional autenticado', async () => {
  const sql = await readFile(new URL('../supabase/migrations/20260921_student_cartpanda_payments.sql', import.meta.url), 'utf8')

  assert.match(sql, /create table if not exists public\.student_checkout_sessions/i)
  assert.match(sql, /create or replace function public\.create_student_checkout_session/i)
  assert.match(sql, /students\.coach_id = auth\.uid\(\)/i)
  assert.match(sql, /grant execute on function public\.create_student_checkout_session\(uuid\) to authenticated/i)
  assert.doesNotMatch(sql, /grant (all|insert|update|delete)[^;]* to anon/i)
})

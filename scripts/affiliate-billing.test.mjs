import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFile } from 'node:fs/promises'

const migrationUrl = new URL('../SUPABASE/migrations/20260924_affiliate_student_billing.sql', import.meta.url)

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

test('Admin Master gerencia afiliados por e-mail sem conceder privilégio administrativo', async () => {
  const app = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8')
  const api = await readFile(new URL('../src/supabaseApi.js', import.meta.url), 'utf8')

  assert.match(app, /Afiliados e cobrança do aluno/)
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
  assert.match(app, /profissional volta ao plano normal/)
})

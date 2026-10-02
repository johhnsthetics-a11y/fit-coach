import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'

import {
  PROFESSIONAL_REFERRAL_STORAGE_KEY,
  buildProfessionalReferralUrl,
  normalizeProfessionalReferralToken,
  normalizeProfessionalReferralType,
} from '../src/professionalReferral.js'

const VALID_TOKEN = 'a'.repeat(64)

test('normaliza somente os tipos profissionais aceitos', () => {
  assert.equal(normalizeProfessionalReferralType('trainer'), 'trainer')
  assert.equal(normalizeProfessionalReferralType('Treinador'), 'trainer')
  assert.equal(normalizeProfessionalReferralType('coach'), 'trainer')
  assert.equal(normalizeProfessionalReferralType('nutritionist'), 'nutritionist')
  assert.equal(normalizeProfessionalReferralType('Nutricionista'), 'nutritionist')
  assert.equal(normalizeProfessionalReferralType('student'), null)
  assert.equal(normalizeProfessionalReferralType(''), null)
})

test('aceita apenas token opaco hexadecimal de 32 bytes', () => {
  assert.equal(normalizeProfessionalReferralToken(`  ${VALID_TOKEN.toUpperCase()}  `), VALID_TOKEN)
  assert.equal(normalizeProfessionalReferralToken('a'.repeat(63)), null)
  assert.equal(normalizeProfessionalReferralToken('g'.repeat(64)), null)
  assert.equal(normalizeProfessionalReferralToken(''), null)
})

test('monta o convite no dominio oficial sem perder parametros existentes', () => {
  assert.equal(
    buildProfessionalReferralUrl(VALID_TOKEN),
    `https://app.coachfitpro.com.br/login?mode=signin&professional_ref=${VALID_TOKEN}`,
  )
  assert.equal(
    buildProfessionalReferralUrl(VALID_TOKEN, 'https://app.coachfitpro.com.br/login?mode=signup&campaign=partner'),
    `https://app.coachfitpro.com.br/login?mode=signup&campaign=partner&professional_ref=${VALID_TOKEN}`,
  )
  assert.equal(buildProfessionalReferralUrl('invalid-token'), '')
  assert.equal(PROFESSIONAL_REFERRAL_STORAGE_KEY, 'coachfitpro-professional-referral')
})

test('API usa somente as RPCs autenticadas do fluxo profissional', async () => {
  const source = await readFile(new URL('../src/supabaseApi.js', import.meta.url), 'utf8')

  assert.match(source, /export async function createRemoteProfessionalReferral\(\{ email, professionalType \} = \{\}\)/)
  assert.match(source, /rpcRequest\('create_affiliate_professional_referral',\s*\{\s*p_referred_email: normalizedEmail,\s*p_professional_type: normalizedType/)
  assert.match(source, /export async function claimRemoteProfessionalReferral\(token\)/)
  assert.match(source, /rpcRequest\('claim_affiliate_professional_referral',\s*\{ p_token: normalizedToken \}\)/)
  assert.match(source, /export async function cancelRemoteProfessionalReferral\(referralId\)/)
  assert.match(source, /rpcRequest\('cancel_affiliate_professional_referral',\s*\{ p_referral_id: referralId \}\)/)
  assert.match(source, /export async function loadRemoteProfessionalReferrals\(\)/)
  assert.match(source, /rpcRequest\('get_my_professional_referrals',\s*\{\}\)/)
  assert.doesNotMatch(source, /service_role/i)
})

test('app preserva o convite ate a reivindicacao autenticada terminar', async () => {
  const source = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8')

  assert.match(source, /PROFESSIONAL_REFERRAL_STORAGE_KEY/)
  assert.match(source, /searchParams\.get\('professional_ref'\)/)
  assert.match(source, /sessionStorage\.setItem\(PROFESSIONAL_REFERRAL_STORAGE_KEY, normalizedToken\)/)
  assert.match(source, /searchParams\.delete\('professional_ref'\)/)
  assert.match(source, /history\.replaceState/)
  assert.match(source, /claimRemoteProfessionalReferral\(pendingToken\)/)
  assert.match(source, /result\?\.ok === true[\s\S]*sessionStorage\.removeItem\(PROFESSIONAL_REFERRAL_STORAGE_KEY\)/)
  assert.match(source, /result\?\.errorCode === 'email_mismatch'[\s\S]*return/)
  assert.match(source, /terminalProfessionalReferralErrors[\s\S]*sessionStorage\.removeItem\(PROFESSIONAL_REFERRAL_STORAGE_KEY\)/)
})

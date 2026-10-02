import assert from 'node:assert/strict'
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

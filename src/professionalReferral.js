export const PROFESSIONAL_REFERRAL_STORAGE_KEY = 'coachfitpro-professional-referral'

const DEFAULT_PROFESSIONAL_REFERRAL_URL = 'https://app.coachfitpro.com.br/login?mode=signin'
const PROFESSIONAL_REFERRAL_TOKEN_PATTERN = /^[a-f0-9]{64}$/

const PROFESSIONAL_TYPE_ALIASES = new Map([
  ['trainer', 'trainer'],
  ['treinador', 'trainer'],
  ['coach', 'trainer'],
  ['nutritionist', 'nutritionist'],
  ['nutricionista', 'nutritionist'],
])

export function normalizeProfessionalReferralType(value) {
  const normalized = String(value || '').trim().toLowerCase()
  return PROFESSIONAL_TYPE_ALIASES.get(normalized) || null
}

export function normalizeProfessionalReferralToken(value) {
  const normalized = String(value || '').trim().toLowerCase()
  return PROFESSIONAL_REFERRAL_TOKEN_PATTERN.test(normalized) ? normalized : null
}

export function buildProfessionalReferralUrl(token, baseUrl = DEFAULT_PROFESSIONAL_REFERRAL_URL) {
  const normalizedToken = normalizeProfessionalReferralToken(token)
  if (!normalizedToken) return ''

  try {
    const url = new URL(String(baseUrl || DEFAULT_PROFESSIONAL_REFERRAL_URL).trim())
    if (url.protocol !== 'https:') return ''
    url.searchParams.set('professional_ref', normalizedToken)
    return url.toString()
  } catch {
    return ''
  }
}

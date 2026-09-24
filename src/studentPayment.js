export const DEFAULT_STUDENT_CHECKOUT_URL = 'https://pagamento.coachfitpro.com.br/checkout/212922687:1?subscription=4664'
export const DEFAULT_PATIENT_CHECKOUT_URL = 'https://pagamento.coachfitpro.com.br/checkout/212922722:1?subscription=4665'
const LEGACY_STUDENT_CHECKOUT_URL = 'https://pagamento.coachfitpro.com.br/checkout?subscription=4664'

export function resolveAudienceCheckoutUrl({ nutritionist = false, studentUrl = '', patientUrl = '' } = {}) {
  const configuredUrl = String(nutritionist ? patientUrl : studentUrl).trim()

  if (!nutritionist && configuredUrl === LEGACY_STUDENT_CHECKOUT_URL) {
    return DEFAULT_STUDENT_CHECKOUT_URL
  }

  return configuredUrl || (nutritionist ? DEFAULT_PATIENT_CHECKOUT_URL : DEFAULT_STUDENT_CHECKOUT_URL)
}

export function buildStudentCheckoutUrl(baseUrl, checkoutToken) {
  const token = String(checkoutToken || '').trim()
  if (!baseUrl || !token) return ''

  try {
    const url = new URL(String(baseUrl).trim())
    if (url.protocol !== 'https:') return ''
    url.searchParams.set('cid', token)
    return url.toString()
  } catch {
    return ''
  }
}

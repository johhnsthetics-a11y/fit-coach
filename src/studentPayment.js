export const DEFAULT_STUDENT_CHECKOUT_URL = 'https://pagamento.coachfitpro.com.br/checkout?subscription=4664'
export const DEFAULT_PATIENT_CHECKOUT_URL = 'https://pagamento.coachfitpro.com.br/checkout/212922722:1?subscription=4665'

export function resolveAudienceCheckoutUrl({ nutritionist = false, studentUrl = '', patientUrl = '' } = {}) {
  return nutritionist
    ? String(patientUrl || DEFAULT_PATIENT_CHECKOUT_URL).trim()
    : String(studentUrl || DEFAULT_STUDENT_CHECKOUT_URL).trim()
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

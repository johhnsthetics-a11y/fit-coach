export const DEFAULT_STUDENT_CHECKOUT_URL = 'https://pagamento.coachfitpro.com.br/checkout/212922687:1?subscription=4664'
export const DEFAULT_PATIENT_CHECKOUT_URL = 'https://pagamento.coachfitpro.com.br/checkout/212922722:1?subscription=4665'

function isDirectCheckoutUrl(value) {
  try {
    const url = new URL(String(value || '').trim())
    return url.protocol === 'https:' && /^\/checkout\/\d+:\d+\/?$/.test(url.pathname)
  } catch {
    return false
  }
}

export function resolveAudienceCheckoutUrl({ nutritionist = false, studentUrl = '', patientUrl = '' } = {}) {
  const configuredUrl = String(nutritionist ? patientUrl : studentUrl).trim()
  if (isDirectCheckoutUrl(configuredUrl)) return configuredUrl
  return nutritionist ? DEFAULT_PATIENT_CHECKOUT_URL : DEFAULT_STUDENT_CHECKOUT_URL
}

export function buildStudentCheckoutUrl(baseUrl, checkoutToken) {
  const token = String(checkoutToken || '').trim()
  if (!isDirectCheckoutUrl(baseUrl) || !token) return ''

  try {
    const url = new URL(String(baseUrl).trim())
    if (url.protocol !== 'https:') return ''
    url.searchParams.set('cid', token)
    return url.toString()
  } catch {
    return ''
  }
}

export function resolveStudentPaymentLockState({ student, professionalType = 'trainer' } = {}) {
  const professionalLabel = professionalType === 'nutritionist' ? 'nutricionista' : 'treinador'

  if (student?.payment !== 'Pago') {
    return {
      kind: 'professional',
      title: 'Seu acompanhamento está temporariamente pausado.',
      message: `Fale com seu ${professionalLabel} para regularizar a mensalidade do acompanhamento.`,
      actionLabel: '',
      canOpenCheckout: false,
    }
  }

  const appStatus = String(student?.appPaymentStatus || 'pending').trim().toLowerCase()
  if (appStatus === 'active') return null

  if (appStatus === 'past_due') {
    return {
      kind: 'renewal',
      title: 'Não foi possível renovar seu CoachFit.',
      message: professionalType === 'nutritionist'
        ? 'Regularize a mensalidade de R$ 25 para voltar a acessar dieta, progresso e acompanhamento.'
        : 'Regularize a mensalidade de R$ 25 para voltar a acessar treinos, progresso e acompanhamento.',
      actionLabel: 'Regularizar por R$ 25/mês',
      canOpenCheckout: true,
    }
  }

  if (['canceled', 'refunded', 'chargeback'].includes(appStatus)) {
    return {
      kind: 'canceled',
      title: 'Sua assinatura do CoachFit foi cancelada.',
      message: 'Para reativar o aplicativo, entre em contato com o suporte do CoachFit.',
      actionLabel: '',
      canOpenCheckout: false,
    }
  }

  return {
    kind: 'activation',
    title: 'Seu acompanhamento já está preparado.',
    message: 'Falta apenas ativar seu CoachFit por R$ 25 por mês para acessar todas as ferramentas.',
    actionLabel: 'Ativar meu CoachFit',
    canOpenCheckout: true,
  }
}

export function getStudentAppPaymentLabel(status) {
  const labels = {
    active: 'COACH FIT PRO ATIVO',
    pending: 'Aguardando pagamento',
    past_due: 'Pagamento vencido',
    canceled: 'Assinatura cancelada',
    refunded: 'Pagamento reembolsado',
    chargeback: 'Pagamento contestado',
  }

  return labels[status] || 'Aguardando pagamento'
}

export function getProfessionalBillingLabel(professionalType) {
  return professionalType === 'nutritionist' ? 'Nutricionista' : 'Treinador'
}

export function getCommissionAudience(professionalType) {
  return professionalType === 'nutritionist'
    ? { singular: 'Paciente', plural: 'Pacientes', singularLower: 'paciente', pluralLower: 'pacientes' }
    : { singular: 'Aluno', plural: 'Alunos', singularLower: 'aluno', pluralLower: 'alunos' }
}

export function normalizeCommissionWhatsappUrl(value) {
  try {
    const url = new URL(String(value || '').trim())
    const allowedHosts = new Set(['wa.me', 'api.whatsapp.com', 'www.whatsapp.com'])
    return url.protocol === 'https:' && allowedHosts.has(url.hostname.toLowerCase()) ? url.toString() : ''
  } catch {
    return ''
  }
}

export function summarizeStudentInvoices(invoices = []) {
  return invoices.reduce((summary, invoice) => {
    const amount = Number(invoice?.amount || 0)
    if (invoice?.status === 'Pago') summary.paidTotal += amount
    if (['Pendente', 'Atrasado'].includes(invoice?.status)) {
      summary.pendingTotal += amount
      summary.pendingCount += 1
    }
    return summary
  }, { paidTotal: 0, pendingTotal: 0, pendingCount: 0 })
}

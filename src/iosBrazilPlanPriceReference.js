// Marketing reference prices supplied by the Coach Fit Pro owner for Brazil.
// These are not exchanged/converted USD values, nor a replacement for Apple
// StoreKit pricing. Update alongside the Brazilian App Store Connect catalog.
// The App Store purchase confirmation always determines the actual charge.
export const IOS_BRAZIL_PLAN_PRICE_REFERENCE = Object.freeze({
  mensal: Object.freeze({
    introductoryPrice: 'R$ 9,90',
    recurringPrice: 'R$ 49,90',
    periodLabel: '/mês',
    promoDescription: 'Primeiro mês para novos assinantes elegíveis',
    renewalLabel: 'Depois, R$ 49,90/mês',
  }),
  semestral: Object.freeze({
    recurringPrice: 'R$ 239,90',
    periodLabel: '/6 meses',
    renewalLabel: 'Renovação a cada 6 meses',
  }),
  anual: Object.freeze({
    recurringPrice: 'R$ 359,00',
    periodLabel: '/ano',
    renewalLabel: 'Renovação anual',
  }),
})

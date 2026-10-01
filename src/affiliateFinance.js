function formatLocalDate(date) {
  return date.toLocaleDateString('sv-SE')
}

export function getAffiliateFinanceDefaultPeriod(now = new Date()) {
  const end = new Date(now)
  const start = new Date(now)
  start.setDate(start.getDate() - 29)

  return {
    startDate: formatLocalDate(start),
    endDate: formatLocalDate(end),
  }
}

export const NUTRITION_PLAN_METADATA_PREFIX = '[coachfitpro-nutrition-meta]'

function escapeRegExp(value = '') {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function getNutritionPlanMetadata(notes = '') {
  const source = String(notes || '')
  const markerIndex = source.lastIndexOf(NUTRITION_PLAN_METADATA_PREFIX)
  if (markerIndex < 0) return {}

  try {
    const metadata = JSON.parse(source.slice(markerIndex + NUTRITION_PLAN_METADATA_PREFIX.length).trim())
    return metadata && typeof metadata === 'object' && !Array.isArray(metadata) ? metadata : {}
  } catch {
    return {}
  }
}

export function stripNutritionPlanMetadata(notes = '') {
  return String(notes || '').replace(new RegExp(`\\n?${escapeRegExp(NUTRITION_PLAN_METADATA_PREFIX)}[\\s\\S]*$`), '').trim()
}

export function buildNutritionPlanNotesWithMetadata(notes = '', meals = [], options = {}) {
  const cleanNotes = stripNutritionPlanMetadata(notes)
  const getServingGrams = typeof options.getServingGrams === 'function'
    ? options.getServingGrams
    : (item) => Number(item?.grams) || 0
  const metadata = {
    version: 2,
    allowPatientPdfDownload: Boolean(options.allowPatientPdfDownload),
    meals: (Array.isArray(meals) ? meals : []).map((meal) => ({
      id: meal?.id,
      items: (Array.isArray(meal?.items) ? meal.items : []).map((item) => ({
        id: item?.id,
        category: item?.category,
        foodName: item?.foodName,
        grams: getServingGrams(item),
        quantity: item?.quantity,
        measureUnit: item?.measureUnit,
        customMeasureName: item?.customMeasureName,
        customMeasureGrams: item?.customMeasureGrams,
        mode: item?.mode,
        customMacros: item?.customMacros,
      })),
    })),
  }
  return `${cleanNotes}${cleanNotes ? '\n\n' : ''}${NUTRITION_PLAN_METADATA_PREFIX}${JSON.stringify(metadata)}`
}

export function canPatientDownloadNutritionPdf(plan = {}) {
  if (plan?.allowPatientPdfDownload === true) return true
  return getNutritionPlanMetadata(plan?.notes).allowPatientPdfDownload === true
}

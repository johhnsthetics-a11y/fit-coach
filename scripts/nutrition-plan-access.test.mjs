import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildNutritionPlanNotesWithMetadata,
  canPatientDownloadNutritionPdf,
  getNutritionPlanMetadata,
} from '../src/nutritionPlanAccess.js'

const meals = [{ id: 'breakfast', items: [{ id: 'egg', foodName: 'Ovo inteiro', grams: 100 }] }]

test('dieta sem autorização explícita não libera PDF para o paciente', () => {
  assert.equal(canPatientDownloadNutritionPdf({ notes: 'Plano sem permissão de PDF.' }), false)
})

test('permissão normalizada do plano continua liberando o PDF após recarregar os dados', () => {
  assert.equal(canPatientDownloadNutritionPdf({ allowPatientPdfDownload: true, notes: 'Observações limpas.' }), true)
})

test('autorização de PDF é persistida sem expor os metadados nas observações do paciente', () => {
  const notes = buildNutritionPlanNotesWithMetadata('Manter hidratação.', meals, { allowPatientPdfDownload: true })
  const metadata = getNutritionPlanMetadata(notes)

  assert.equal(metadata.allowPatientPdfDownload, true)
  assert.equal(canPatientDownloadNutritionPdf({ notes }), true)
  assert.equal(notes.startsWith('Manter hidratação.'), true)
})

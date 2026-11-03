import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'

const app = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8')
const css = await readFile(new URL('../src/index.css', import.meta.url), 'utf8')

function section(source, start, end) {
  const from = source.indexOf(start)
  const to = source.indexOf(end, from + start.length)
  assert.notEqual(from, -1, `missing section start: ${start}`)
  assert.notEqual(to, -1, `missing section end: ${end}`)
  return source.slice(from, to)
}

test('professional preview reuses the actual patient diet and current unsaved draft', () => {
  const form = section(app, 'function NutritionForm(', 'function escapeNutritionPdfHtml')
  const preview = section(app, 'function NutritionStudentDietPreview(', 'function NutritionFormLegacy')
  assert.match(form, /items: meal\.items\.map\(\(item\) => \(\{ \.\.\.item \}\)\)/)
  assert.match(form, /themeSettings=\{themeSettings\}/)
  assert.match(preview, /<StudentDietExperience/)
  assert.match(preview, /previewMode/)
  assert.match(preview, /mergeThemeStyle\(themeSettings, theme\)/)
  assert.match(preview, /waterGoalMl/)
  assert.match(preview, /showPdfAction=\{canPatientDownloadNutritionPdf\(plan\)\}/)
})

test('preview never reads or writes the patient actual saved meal and favorites state', () => {
  const diet = section(app, 'function StudentDietExperience(', 'function createNutritionQuestionnaireDraft')
  assert.match(diet, /if \(previewMode\) return \[\]/)
  assert.match(diet, /if \(previewMode\) return \{ meals: \[\], days: \[\] \}/)
  assert.equal((diet.match(/if \(previewMode\) return/g) || []).length >= 4, true)
  assert.match(diet, /const displayedWaterMl = previewMode \? previewWaterMl : waterMl/)
  assert.match(diet, /showPdfAction \? <button/)
})

test('preview does not globally recolor patient meal cards or override all buttons', () => {
  assert.doesNotMatch(css, /nutrition-student-preview-v2\.app-theme-light \.nutrition-student-preview-panel button/)
  assert.doesNotMatch(css, /nutrition-student-preview-v2\.app-theme-dark \.nutrition-student-preview-panel article/)
  assert.match(css, /nutrition-preview-patient-diet-parity-v1/)
  assert.match(css, /@media \(max-width: 520px\)/)
})

test('patient preview updates do not remove chat moderation or Apple subscription screens', () => {
  assert.match(app, /AdminChatReports/)
  assert.match(app, /ChatConversation/)
  assert.match(app, /NativeIosSubscriptionPanel/)
})

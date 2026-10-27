import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'

const app = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8')
const css = await readFile(new URL('../src/index.css', import.meta.url), 'utf8')
const api = await readFile(new URL('../src/supabaseApi.js', import.meta.url), 'utf8')
const nutritionForm = app.slice(app.indexOf('function NutritionForm('), app.indexOf('function escapeNutritionPdfHtml('))
const studentPage = app.slice(app.indexOf('function Students('), app.indexOf('function StudentSnapshot('))
const anamnesisForm = app.slice(app.indexOf('function ProfessionalAnamnesisForm('), app.indexOf('function ProfessionalAnamnesisSummary('))
const anamnesisSummary = app.slice(app.indexOf('function ProfessionalAnamnesisSummary('), app.indexOf('function StudentAnamnesisSummary('))

test('dieta mostra anamnese vinculada ao paciente em um painel flutuante recolhível', () => {
  assert.match(nutritionForm, /const formAnamnesis = anamneses\.find\(\(item\) => String\(item\.studentId\) === String\(formStudent\?\.id\)\) \|\| null/)
  assert.match(nutritionForm, /const \[anamnesisOpen, setAnamnesisOpen\] = useState\(false\)/)
  assert.match(nutritionForm, /aria-controls="nutrition-anamnesis-panel"/)
  assert.match(nutritionForm, /id="nutrition-anamnesis-panel"/)
  assert.match(nutritionForm, /<ProfessionalAnamnesisSummary[\s\S]*?anamnesis=\{formAnamnesis\}[\s\S]*?student=\{formStudent\}/)
})

test('ficha do aluno permite preencher e salvar a anamnese com rótulos por função', () => {
  assert.match(app, /function ProfessionalAnamnesisForm\(/)
  assert.match(studentPage, /Preencher anamnese/)
  assert.match(studentPage, /Editar anamnese/)
  assert.equal(app.includes('onSaveAnamnesis={saveProfessionalStudentAnamnesis}'), true)
  assert.match(anamnesisForm, /nutritionist \? 'paciente' : 'aluno'/)
  assert.match(api, /export async function saveRemoteProfessionalAnamnesis\(/)
})

test('revisão profissional usa grupos semânticos compactos e diferencia dados ausentes', () => {
  assert.match(anamnesisSummary, /professional-anamnesis-summary/)
  assert.match(anamnesisSummary, /professional-anamnesis-alert/)
  assert.match(anamnesisSummary, /professional-anamnesis-section__list/)
  assert.match(anamnesisSummary, /<dl/)
  assert.match(anamnesisSummary, /<dt/)
  assert.match(anamnesisSummary, /<dd/)
  assert.match(anamnesisSummary, /isAnamnesisUnavailable/)
  assert.match(anamnesisSummary, /is-empty/)
})

test('revisão profissional possui estilos responsivos equivalentes nos temas claro e escuro', () => {
  assert.match(css, /professional-anamnesis-summary-v1/)
  assert.match(css, /\.professional-anamnesis-summary/)
  assert.match(css, /\.app-theme-light \.professional-anamnesis-summary/)
  assert.match(css, /\.professional-anamnesis-sections[\s\S]*?grid-template-columns/)
  assert.match(css, /\.professional-anamnesis-section__list > div,[^{]+\{[^}]*grid-template-columns:\s*1fr/)
  assert.doesNotMatch(css, /\.professional-anamnesis-section__list > div,[^{]+\{[^}]*grid-template-columns:\s*minmax/)
  assert.match(css, /@media \(max-width: 720px\)[\s\S]*?\.professional-anamnesis-sections/)
})

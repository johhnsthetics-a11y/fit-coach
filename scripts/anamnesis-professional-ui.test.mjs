import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'

const app = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8')
const api = await readFile(new URL('../src/supabaseApi.js', import.meta.url), 'utf8')
const nutritionForm = app.slice(app.indexOf('function NutritionForm('), app.indexOf('function escapeNutritionPdfHtml('))
const studentPage = app.slice(app.indexOf('function Students('), app.indexOf('function StudentSnapshot('))
const anamnesisForm = app.slice(app.indexOf('function ProfessionalAnamnesisForm('), app.indexOf('function ProfessionalAnamnesisSummary('))

test('dieta mostra anamnese vinculada ao paciente em edição e oferece leitura expansível', () => {
  assert.match(nutritionForm, /const formAnamnesis = anamneses\.find\(\(item\) => String\(item\.studentId\) === String\(formStudent\?\.id\)\) \|\| null/)
  assert.match(nutritionForm, /<details[^>]*open=\{Boolean\(formAnamnesis\)\}/)
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

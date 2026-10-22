import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8')

const indexSource = read('../index.html')
const mainSource = read('../src/main.jsx')
const appSource = read('../src/App.jsx')
const publicVersion = read('../public/version.txt').trim()
const serviceWorkerSource = read('../public/service-worker.js')
const manifestSource = read('../public/manifest.webmanifest')

test('build usa apenas as entradas canonicas em src', () => {
  assert.match(indexSource, /src="\/src\/main\.jsx"/)
  assert.match(mainSource, /from ['"]\.\/App['"]/)
  assert.match(mainSource, /import ['"]\.\/index\.css['"]/)
  assert.doesNotMatch(`${indexSource}\n${mainSource}`, /src-App\.jsx|src-index\.css|\.\.\/App\.jsx|\.\.\/index\.css/)
})

test('marcador publico, aplicacao e cache compartilham a versao atual', () => {
  const appMarker = appSource.match(/COACH_FIT_PRO_BUILD_MARKER\s*=\s*['"]([^'"]+)['"]/)?.[1]
  const cacheName = serviceWorkerSource.match(/CACHE_NAME\s*=\s*['"]([^'"]+)['"]/)?.[1]

  assert.equal(appMarker, publicVersion)
  assert.ok(cacheName?.includes(publicVersion), `cache ${cacheName || '(ausente)'} deve incluir ${publicVersion}`)
})

test('service worker nao armazena requisicoes autenticadas nem respostas de API', () => {
  assert.match(serviceWorkerSource, /request\.headers\.has\(['"]Authorization['"]\)/)
  assert.match(serviceWorkerSource, /url\.search/)
  assert.match(serviceWorkerSource, /url\.origin !== self\.location\.origin/)
})

test('metadados publicos representam profissionais, alunos e pacientes atuais', () => {
  const manifest = JSON.parse(manifestSource)
  assert.match(indexSource, /treinadores e nutricionistas/i)
  assert.match(indexSource, /alunos e pacientes/i)
  assert.match(manifest.description, /alunos e pacientes/i)
  assert.match(manifest.description, /hidrata/i)
})

test('textos legais contemplam treinadores, nutricionistas, alunos e pacientes', () => {
  const legalModalSource = appSource.slice(appSource.indexOf('function LegalModal'), appSource.indexOf('function AuthScreen'))
  assert.match(legalModalSource, /treinadores e nutricionistas/i)
  assert.match(legalModalSource, /alunos e pacientes/i)
  assert.match(legalModalSource, /profissional responsável/i)
})

test('montagem de dieta adapta paciente e aluno ao tipo profissional', () => {
  const nutritionFormSource = appSource.slice(appSource.indexOf('function NutritionForm('), appSource.indexOf('function escapeNutritionPdfHtml'))
  const pdfSource = appSource.slice(appSource.indexOf('function openNutritionPlanPdf'), appSource.indexOf('function NutritionStudentDietPreview'))
  const previewSource = appSource.slice(appSource.indexOf('function NutritionStudentDietPreview'), appSource.indexOf('function NutritionFormLegacy'))
  const planListSource = appSource.slice(appSource.indexOf('function NutritionPlanList('), appSource.indexOf('function createNutritionQuestionnaireDraft'))

  assert.match(nutritionFormSource, /const nutritionist = isNutritionistUser\(professional\)/)
  assert.match(nutritionFormSource, /const clientLabel = nutritionist \? ['"]paciente['"] : ['"]aluno['"]/)
  assert.match(nutritionFormSource, /Visão do \{clientLabel\}/)
  assert.match(previewSource, /aria-label=\{`Visão do \$\{clientLabel\} da dieta`\}/)
  assert.match(previewSource, /Orientação da nutricionista/)
  assert.match(previewSource, /Orientação do treinador/)
  assert.match(pdfSource, /const clientTitle = nutritionist \? ['"]Paciente['"] : ['"]Aluno['"]/)
  assert.match(planListSource, /const clientLabel = nutritionist \? ['"]paciente['"] : ['"]aluno['"]/)
  assert.doesNotMatch(planListSource, /Orientação do coach/)
})

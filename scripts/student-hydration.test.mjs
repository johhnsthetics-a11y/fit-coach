import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const appSource = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8')
const cssSource = readFileSync(new URL('../src/index.css', import.meta.url), 'utf8')

test('aluno e paciente possuem uma area dedicada de hidratacao', () => {
  assert.match(appSource, /studentPortalTabIds[^\n]+['"]agua['"]/)
  assert.match(appSource, /patientPortalTabIds[^\n]+['"]agua['"]/)
  assert.match(appSource, /id:\s*['"]agua['"],\s*label:\s*['"]Água['"],\s*icon:\s*['"]water['"]/)
  assert.match(appSource, /activeTab === ['"]agua['"]/)
  assert.match(appSource, /function StudentHydrationPage\(/)
})

test('atalho da tela inicial abre a hidratacao sem manter o controle completo enterrado no inicio', () => {
  assert.match(appSource, /function StudentWaterQuickCard\(/)
  assert.match(appSource, /onOpenTab\(['"]agua['"]\)/)
  assert.doesNotMatch(appSource, /function StudentHomeDashboard[\s\S]*?<StudentWaterTracker[\s\S]*?function StudentQuestionnaireCenter/)
})

test('registro diario suporta tres volumes, historico e desfazer', () => {
  assert.match(appSource, /waterLogStorageKey/)
  assert.match(appSource, /setWaterEntries/)
  assert.match(appSource, /onAddWater\(250\)/)
  assert.match(appSource, /onAddWater\(350\)/)
  assert.match(appSource, /onAddWater\(500\)/)
  assert.match(appSource, /undoLastWater/)
  assert.match(appSource, /Histórico de hoje/)
})

test('meta concluida celebra e tenta notificar somente com permissao do usuario', () => {
  assert.match(appSource, /waterGoalCelebration/)
  assert.match(appSource, /Meta de água concluída/)
  assert.match(appSource, /Notification\.requestPermission\(\)/)
  assert.match(appSource, /Ativar notificações/)
  assert.match(appSource, /prefers-reduced-motion/)
})

test('reiniciar o progresso nao repete a notificacao da mesma conquista diaria', () => {
  const resetSource = appSource.slice(appSource.indexOf('function resetWater()'), appSource.indexOf('async function requestWaterNotifications()'))
  assert.doesNotMatch(resetSource, /removeLocalStorage\(waterGoalNoticeKey\)/)
})

test('experiencia de hidratacao possui estilos responsivos nos temas claro e escuro', () => {
  assert.match(cssSource, /\.student-hydration-page/)
  assert.match(cssSource, /\.student-water-quick-card/)
  assert.match(cssSource, /\.student-hydration-celebration/)
  assert.match(cssSource, /\.app-theme-light \.student-hydration-page/)
  assert.match(cssSource, /@keyframes studentHydrationCelebrate/)
  assert.match(cssSource, /@media \(prefers-reduced-motion: reduce\)[\s\S]*student-hydration/s)
})

test('volumes permanecem alinhados e legiveis nos celulares estreitos', () => {
  assert.match(cssSource, /\.student-hydration-actions \.student-water-action\s*\{[^}]*display:\s*flex[^}]*white-space:\s*nowrap[^}]*font-variant-numeric:\s*tabular-nums/s)
  assert.match(cssSource, /@media \(max-width:\s*420px\)\s*\{[^}]*\.student-hydration-hero\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)/s)
  assert.match(cssSource, /@media \(max-width:\s*420px\)[\s\S]*\.student-hydration-actions \.student-water-action\s*\{[^}]*min-width:\s*0/s)
})

test('percentual da garrafa tem contraste proprio no tema claro', () => {
  assert.match(cssSource, /\.student-mobile-shell\.app-theme-light \.student-hydration-bottle-body > strong\s*\{[^}]*background:\s*rgba\(255, 255, 255,[^}]*color:\s*#075985\s*!important[^}]*-webkit-text-fill-color:\s*#075985\s*!important/s)
})

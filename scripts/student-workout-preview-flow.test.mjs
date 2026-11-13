import assert from 'node:assert/strict'
import test, { after, before } from 'node:test'
import { readFile } from 'node:fs/promises'
import React from 'react'
import { renderToString } from 'react-dom/server'
import { createServer } from 'vite'

const student = { id: 'build28-preview-student', name: 'Aluno de prévia', goal: 'Hipertrofia', level: 'Intermediário' }
const workout = { id: 'build28-preview-workout', title: 'Treino demonstrativo', days: [
  { day: 'Segunda-feira', focus: 'Peito', exercises: [{ name: 'Supino reto', sets: '3', reps: '10', rest: '60s' }, { name: 'Remada baixa', sets: '3', reps: '12', rest: '60s' }] },
  { day: 'Quarta-feira', focus: 'Costas', exercises: [{ name: 'Remada baixa', sets: '3', reps: '12', rest: '60s' }] },
] }
let server, StudentWorkoutExecution, appSource, figmaCss, polishCss, polish36Css, polish37Css, polish38Css, polish39Css, mainSource, xpCelebrationCss

before(async () => {
  server = await createServer({
    mode: 'test', envFile: false,
    define: { 'import.meta.env.VITE_SUPABASE_URL': 'undefined', 'import.meta.env.VITE_SUPABASE_ANON_KEY': 'undefined' },
    server: { middlewareMode: true, hmr: false },
  })
  const app = await server.ssrLoadModule('/src/App.jsx')
  StudentWorkoutExecution = app.StudentWorkoutExecution
  appSource = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8')
  figmaCss = await readFile(new URL('../src/student-workout-figma-dark.css', import.meta.url), 'utf8')
  polishCss = await readFile(new URL('../src/student-workout-polish-build34.css', import.meta.url), 'utf8')
  polish36Css = await readFile(new URL('../src/student-workout-polish-build36.css', import.meta.url), 'utf8')
  polish37Css = await readFile(new URL('../src/student-workout-polish-build37.css', import.meta.url), 'utf8')
  polish38Css = await readFile(new URL('../src/student-workout-polish-build38.css', import.meta.url), 'utf8')
  polish39Css = await readFile(new URL('../src/student-workout-polish-build39.css', import.meta.url), 'utf8')
  mainSource = await readFile(new URL('../src/main.jsx', import.meta.url), 'utf8')
  xpCelebrationCss = await readFile(new URL('../src/student-workout-xp-celebration-build35.css', import.meta.url), 'utf8')
})

test('prévia percorre as cinco telas do Figma sem salvar dados reais', () => {
  const roots = {
    overview: /student-workout-figma-overview/,
    execution: /student-workout-figma-execution/,
    rest: /student-workout-figma-rest/,
    'exercise-complete': /student-workout-figma-exercise-complete/,
    summary: /student-workout-figma-summary/,
  }
  const html = Object.fromEntries(Object.keys(roots).map(stage => [stage, renderToString(React.createElement(StudentWorkoutExecution, { student, workout, preview: true, previewStage: stage, dayIndex: 0 }))]))
  for (const [stage, root] of Object.entries(roots)) {
    assert.match(html[stage], new RegExp(`data-preview-screen="${stage}"`))
    assert.match(html[stage], root)
  }
  assert.match(html.overview, /SEU TREINO/)
  assert.match(html.overview, /exercícios[\s\S]*séries[\s\S]*minutos/)
  assert.match(html.overview, /Iniciar treino/)
  assert.equal((html.overview.match(/Iniciar treino/g) || []).length, 1, 'o overview deve apresentar uma única ação principal')
  assert.match(html.overview, /data-progress-segment/)
  assert.match(html.overview, /student-workout-day-accordion__toggle/)
  assert.match(html.overview, /aria-controls="student-workout-day-options"/)
  assert.doesNotMatch(html.overview, /aria-label="Escolher outro dia de treino"/)
  assert.ok(html.overview.indexOf('student-workout-figma-topbar') < html.overview.indexOf('student-workout-day-accordion__toggle'))
  assert.match(html.execution, /Técnica do exercício/)
  assert.match(html.execution, /Concluir série/)
  assert.doesNotMatch(html.execution, /Registrar série e descansar|student-workout-figma-execution-actions/)
  assert.match(html.execution, /data-progress-segment/)
  assert.doesNotMatch(html.execution, /Sem histórico anterior/)
  assert.match(html.rest, /Recupere o fôlego/)
  assert.match(html.rest, /00:48/)
  assert.ok(html.rest.indexOf('Pular descanso') < html.rest.indexOf('student-workout-figma-rest-controls'))
  assert.match(html['exercise-complete'], /feito\./)
  assert.match(html['exercise-complete'], /Seus registros/)
  assert.match(html['exercise-complete'], /Conclua uma série nesta prévia para exibir seus registros reais/)
  assert.doesNotMatch(html['exercise-complete'], /Exemplo demonstrativo/)
  assert.doesNotMatch(html['exercise-complete'], /class="student-workout-figma-set-record"/)
  assert.match(html['exercise-complete'], /Ir para Remada baixa/)
  assert.match(html.summary, /Resumo demonstrativo/)
  assert.match(html.summary, /Plano previsto/)
  assert.match(html.summary, /Resumo demonstrativo\. Os valores reais aparecem após o aluno concluir a sessão\./)
  assert.match(html.summary, /data-preview-rating="true"/)
  assert.match(html.summary, /<strong>—<\/strong>/)
})

test('BUILD38 prioriza a ação do exercício concluído e usa preto neutro somente no dark real', () => {
  const completed = renderToString(React.createElement(StudentWorkoutExecution, { student, workout, preview: true, previewStage: 'exercise-complete', dayIndex: 0 }))
  const actionIndex = completed.indexOf('student-workout-figma-bottom-actions')
  const mediaIndex = completed.indexOf('student-workout-figma-complete-technique')
  assert.ok(actionIndex >= 0 && mediaIndex > actionIndex, 'a ação para avançar/concluir deve vir antes da mídia opcional')
  assert.match(polish38Css, /\.student-mobile-shell\.app-theme-dark\.student-workout-active\s*\{[\s\S]*?--sw-bg:\s*#050607;/)
  assert.match(polish38Css, /\.student-mobile-shell\.app-theme-dark\.student-workout-active \.student-workout-figma-screen:not\(\.is-compact\)[\s\S]*?background: #050607 !important/)
  assert.match(polish38Css, /@media \(max-width: 767px\)[\s\S]*?min-height: 0/)
  assert.match(polish38Css, /student-workout-figma-exercise-complete \.student-workout-figma-bottom-actions/)
  assert.match(polish38Css, /student-workout-rest-skip/)
  assert.match(polish38Css, /@media \(prefers-reduced-motion: reduce\)/)
  assert.match(polish38Css, /\.student-workout-xp-celebration\.app-theme-dark\s*\{[\s\S]*?--xp-bg:\s*#050607;/)
  assert.match(polish38Css, /student-workout-xp-celebration\.app-theme-dark \.student-workout-xp-celebration__dialog[\s\S]*?background: linear-gradient\(155deg, #171C1E 0%, #0E1113 68%\)/)
  assert.match(polish38Css, /student-workout-xp-celebration \.student-workout-xp-celebration__stars span\.is-selected[\s\S]*?#F1CE68/)
  assert.match(polish38Css, /student-workout-xp-celebration\.app-theme-light[\s\S]*?#A66D00/)
  assert.doesNotMatch(polish38Css, /\.student-mobile-shell\.app-theme-light[^\n]*#050607/)
  assert.ok(mainSource.indexOf("import './student-workout-polish-build38.css'") > mainSource.indexOf("import './student-workout-polish-build37.css'"))
})

test('BUILD39 vence o override legado das estrelas do resumo light sem alterar o tema dark', () => {
  const selector = 'html body .student-mobile-shell.app-theme-light.student-workout-active .student-workout-figma-summary .student-workout-rating-stars button.is-selected'
  assert.match(polish36Css, /html body \.student-mobile-shell\.app-theme-light\.student-workout-active \.student-workout-figma-summary \.student-workout-rating-stars button\.is-selected[\s\S]*?background:\s*#087f72\s*!important/i)
  assert.ok(polish39Css.includes(`${selector} {`), 'o novo seletor deve ter especificidade igual à regra legada')
  assert.match(polish39Css, /background: #FFF5CB !important;[\s\S]*?color: #A66D00 !important;[\s\S]*?-webkit-text-fill-color: #A66D00 !important/)
  assert.match(polish39Css, /student-workout-rating-stars button\.is-selected > span,[\s\S]*?color: #A66D00 !important;[\s\S]*?fill: #A66D00 !important/)
  assert.ok(mainSource.indexOf("import './student-workout-polish-build39.css'") > mainSource.indexOf("import './student-workout-polish-build38.css'"), 'BUILD39 deve carregar depois da regra antiga')
  assert.doesNotMatch(polish39Css, /\.student-mobile-shell\.app-theme-dark/)
})

test('cabeçalhos do aluno não repetem o mesmo nome de plano e dia', () => {
  const samePlanAndDay = { ...workout, title: 'Treino A', days: [{ ...workout.days[0], day: 'Treino A' }] }
  for (const stage of ['overview', 'execution', 'rest', 'exercise-complete', 'summary']) {
    const html = renderToString(React.createElement(StudentWorkoutExecution, { student, workout: samePlanAndDay, preview: true, previewStage: stage, dayIndex: 0 }))
    assert.doesNotMatch(html, /Treino A\s*[—•]\s*Treino A/)
  }
  const distinctTitles = { ...workout, title: 'Plano principal', days: [{ ...workout.days[0], day: 'Treino A' }] }
  const distinctHtml = renderToString(React.createElement(StudentWorkoutExecution, { student, workout: distinctTitles, preview: true, previewStage: 'overview', dayIndex: 0 }))
  assert.match(distinctHtml, /<h3>Plano principal<\/h3>/)
  assert.match(distinctHtml, /SEU TREINO[\s\S]*?Treino A/)
  assert.doesNotMatch(distinctHtml, /Plano principal\s*[—•]\s*Treino A/)
})

test('a prévia usa os tokens oficiais escuros e o fluxo permanece somente local', () => {
  assert.match(figmaCss, /--sw-bg:\s*#0B1516/)
  assert.match(figmaCss, /--sw-panel:\s*#111E20/)
  assert.match(figmaCss, /--sw-text:\s*#F4FFFD/)
  assert.match(figmaCss, /--sw-muted:\s*#A7BDBA/)
  assert.match(figmaCss, /--sw-accent:\s*#4EE9D0/)
  assert.match(figmaCss, /\.student-mobile-shell\s+\.mobile-workout-student-experience-v2:not\(\.is-compact\)\.student-workout-figma-screen\s*\{\s*background:\s*var\(--sw-bg\)\s*!important;/)
  assert.match(figmaCss, /--sw-bg:\s*#FFFFFF/)
  assert.match(figmaCss, /--sw-accent:\s*#087F72/)
  assert.match(figmaCss, /html body \.student-mobile-shell\.app-theme-light[\s\S]{0,260}student-workout-figma-primary/)
  assert.match(figmaCss, /student-workout-figma-progress-segments/)
  assert.match(appSource, /function returnFromRestToExecution\(\)/)
  assert.match(appSource, /if \(preview\) onPreviewStageChange\?\.\('execution'\)/)
  assert.match(appSource, /if \(preview\) onPreviewStageChange\?\.\(nextPendingAfterCompletion/)
  assert.match(appSource, /if \(preview \|\| !student\?\.id \|\| !workout\?\.id\) return/)
})

test('prévia da Área do aluno não recebe callbacks reais', () => {
  const portal = appSource.match(/function StudentPortalPreview\([\s\S]*?(?=\nfunction [A-Z][A-Za-z0-9_]*)/)?.[0] || ''
  assert.match(portal, /workoutPreviewStage/)
  assert.match(portal, /previewStage=\{workoutPreviewStage\}/)
  assert.doesNotMatch(portal, /onCompleteWorkout\s*=|onEndWorkout\s*=|onRateWorkout\s*=|onSaveWorkoutSession\s*=/)
})

test('BUILD35 mantém a prévia sem celebração e respeita o tema e movimento reduzido', () => {
  const previewSummary = renderToString(React.createElement(StudentWorkoutExecution, {
    student,
    workout,
    preview: true,
    previewStage: 'summary',
    dayIndex: 0,
    onRateWorkout: () => { throw new Error('a prévia não pode chamar o salvamento real') },
  }))
  assert.match(previewSummary, /data-preview-rating="true"/)
  assert.match(previewSummary, /Enviar avaliação pelo app do aluno/)
  assert.doesNotMatch(previewSummary, /student-workout-xp-celebration/)
  assert.match(appSource, /if \(preview\) throw new Error\('A prévia não salva avaliações do aluno\.'\)/)
  assert.match(appSource, /if \(xpAwarded > 0 && celebratedCompletionIdRef\.current !== completionId\)/)
  assert.match(xpCelebrationCss, /\.student-workout-xp-celebration\.app-theme-light/)
  assert.match(xpCelebrationCss, /position:\s*fixed/)
  assert.match(xpCelebrationCss, /@media \(prefers-reduced-motion:\s*reduce\)/)
  assert.ok(mainSource.indexOf("import './student-workout-xp-celebration-build35.css'") > mainSource.indexOf("import './student-workout-polish-build34.css'"))
})

test('BUILD34 melhora ícones, toque, alertas, feedback e largura sem quebrar a prévia', () => {
  for (const icon of ['moreHorizontal:', 'edit:', 'pause:', 'info:']) assert.ok(appSource.includes(icon), `ícone ${icon} deve existir no sistema do app`)
  assert.match(polishCss, /student-workout-figma-edit-set\s*\{[\s\S]*?width:\s*44px;[\s\S]*?height:\s*44px;/)
  assert.match(polishCss, /student-workout-figma-rest-controls button\s*\{[\s\S]*?min-height:\s*48px;/)
  assert.match(polishCss, /@media \(min-width:\s*768px\)/)
  assert.match(polishCss, /width:\s*min\(100%,\s*760px\)/)
  assert.match(polishCss, /@media \(prefers-reduced-motion:\s*reduce\)/)
  assert.match(appSource, /function scrollWorkoutToTop\(\)\s*\{\s*if \(preview \|\| typeof window === 'undefined' \|\| window\.innerWidth > 767\) return/)
  const scrollHelper = appSource.match(/function scrollWorkoutToTop\(\)\s*\{[\s\S]*?\n  \}/)?.[0] || ''
  assert.ok(scrollHelper, 'helper de scroll do treino deve existir')
  assert.doesNotMatch(scrollHelper, /scrollIntoView/)
  assert.match(scrollHelper, /target\.scrollTo\(\{ top: 0, behavior \}\)/)
  assert.match(appSource, /previousRestActiveRef\.current = true/)
  assert.match(appSource, /previousRestActiveRef\.current = false[\s\S]{0,100}scrollWorkoutToActiveSet\(\)/)
  const activeSetScroll = appSource.match(/function scrollWorkoutToActiveSet\(\) \{([\s\S]*?)\n  \}/)?.[1] || ''
  assert.match(activeSetScroll, /mobile-workout-set-card-v29\.is-current/)
  assert.match(activeSetScroll, /targetRect\.height \/ 2/)
  assert.doesNotMatch(activeSetScroll, /scrollIntoView|\.focus\(/)
  assert.match(polish36Css, /student-workout-figma-sequence-row\s*\{[\s\S]*?grid-template-columns:\s*38px minmax\(0, 1fr\) minmax\(76px, 30%\)/)
  assert.match(polish36Css, /student-workout-figma-execution \.mobile-workout-set-inline-action-v29\s*\{\s*display:\s*none !important/)
  assert.match(polish36Css, /bottom:\s*calc\(76px \+ env\(safe-area-inset-bottom, 0px\)\)/)
  assert.match(polish36Css, /\.student-mobile-shell\.app-theme-light\.student-workout-active\s*\{[\s\S]*?background:\s*#ffffff !important/)
  assert.match(polish36Css, /@media \(prefers-reduced-motion:\s*reduce\)/)
  assert.match(appSource, /activeTab !== 'mensagens' && activeTab !== 'treino'/)
  assert.match(appSource, /hideHeader className="student-workout-app-section"/)
  assert.match(mainSource, /import '\.\/student-workout-polish-build36\.css'/)
  const newSession = appSource.match(/function startNewWorkoutSession\(\) \{([\s\S]*?)\n  \}/)?.[1] || ''
  assert.match(newSession, /setSeriesFeedback\(null\)/)
  assert.match(newSession, /setExpandedSetKey\(''\)/)
  assert.doesNotMatch(appSource, /student-workout-figma-execution-actions|executionActionLabel|handleExecutionPrimaryAction/)
  assert.match(polish37Css, /student-workout-figma-execution \.mobile-workout-set-inline-action-v29\s*\{\s*display:\s*flex !important/)
  assert.match(polish37Css, /student-workout-end-subtle/)
  assert.match(polish37Css, /student-workout-figma-execution-topbar\.student-workout-has-end-action\s*\{[\s\S]*?grid-template-columns:\s*40px minmax\(0, 1fr\) auto/)
  assert.match(polish37Css, /student-workout-rest-skip/)
  assert.match(polish37Css, /student-workout-day-accordion__options/)
  assert.match(polish37Css, /app-theme-light[^\n]*student-workout-rating-stars button\.is-selected[\s\S]*?#a66d00/)
  assert.match(polish37Css, /student-workout-figma-exercise-intro[\s\S]*?#f8fbfa/)
  assert.match(mainSource, /import '\.\/student-workout-polish-build37\.css'/)
  const trainSection = appSource.match(/if \(activeTab === 'treino'\) \{([\s\S]*?)(?=\n    if \(activeTab === 'dieta'\))/)?.[1] || ''
  assert.ok(trainSection, 'seção Treino do aluno deve existir')
  assert.doesNotMatch(trainSection, /StudentReminderCard/)
  assert.match(appSource, /<ThemeToggle theme=\{theme\} onToggle=\{toggleUiTheme\} className="student-theme-toggle student-header-theme-toggle shrink-0" \/>/)
  assert.match(appSource, /className="student-workout-day-accordion__toggle" aria-expanded=\{dayPickerOpen\}/)
})
after(async () => { await server?.close() })

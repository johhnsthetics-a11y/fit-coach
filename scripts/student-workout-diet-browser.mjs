import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import { createServer, transformWithEsbuild } from 'vite'

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright')

function parseTimerSeconds(value) {
  const parts = String(value).match(/\d{2}:\d{2}:\d{2}/)?.[0].split(':').map(Number) || [0, 0, 0]
  return parts[0] * 3600 + parts[1] * 60 + parts[2]
}

const student = {
  id: 'qa-student-workout-diet',
  name: 'Aluno QA',
  payment: 'Pago',
  appPaymentStatus: 'active',
  accessOverrideUntil: '2099-01-01',
}

const workout = {
  id: 'qa-workout',
  studentId: student.id,
  title: 'Treino A',
  active: true,
  days: [{
    day: 'Segunda-feira',
    focus: 'Peito e tríceps',
    exercises: [{
      id: 'qa-exercise',
      name: 'Supino reto',
      sets: '3',
      reps: '12',
      rest: '60s',
      muscleGroup: 'Peitoral',
      primaryMuscle: 'peitoral',
      imageUrl: 'https://example.test/supino.jpg',
      videoUrl: 'https://example.test/supino.mp4',
      instructions: 'Mantenha os ombros apoiados e controle a descida.',
    }, {
      id: 'qa-exercise-2',
      name: 'Remada baixa com triângulo',
      sets: '2',
      reps: '10',
      rest: '45s',
      muscleGroup: 'Costas',
      primaryMuscle: 'dorsais',
      equipment: 'Cabo',
      instructions: 'Mantenha o tronco estável e conduza os cotovelos para trás.',
    }],
  }],
}

const nutritionPlan = {
  id: 'qa-nutrition-plan',
  studentId: student.id,
  title: 'Plano alimentar detalhado',
  calories: '2100 kcal',
  protein: '160 g',
  active: true,
  meals: [{
    id: 'qa-breakfast',
    name: 'Café da manhã',
    time: '07:30',
    macros: '32P / 58C / 18G',
    foods: 'Ovos, Aveia',
  }, {
    id: 'qa-meal',
    name: 'Almoço',
    time: '12:30',
    macros: '52P / 74C / 14G',
    foods: 'Arroz Branco (200g), Peito de Frango (180g), Ovos (100g)',
    items: [
      { id: 'rice', category: 'Carboidratos', foodName: 'Arroz Branco', grams: 200, quantity: 200, measureUnit: 'g' },
      { id: 'chicken', category: 'Carnes', foodName: 'Peito de Frango', grams: 180, quantity: 180, measureUnit: 'g' },
      { id: 'eggs', category: 'Ovos', foodName: 'Ovos', grams: 100, quantity: 100, measureUnit: 'g' },
    ],
  }, {
    id: 'qa-dinner',
    name: 'Jantar',
    time: '19:30',
    macros: '42P / 45C / 12G',
    foods: 'Batata Doce (180g), Peixe (160g)',
  }],
}

const workoutHistory = [{
  id: 'qa-history-1',
  studentId: student.id,
  workoutId: workout.id,
  title: 'Treino A · Segunda-feira',
  completedAt: '2026-10-01T12:00:00.000Z',
  notes: 'Atividades registradas pelo aluno:\nSupino reto — S1: 18 kg × 12 · S2: 20 kg × 10\nRemada baixa com triângulo — S1: 30 kg × 10',
}]

const fixture = `
import React, { useState } from 'react'
import { createRoot } from 'react-dom/client'
import { StudentMobileApp } from '/src/App.jsx'
import '/src/index.css'

const student = ${JSON.stringify(student)}
const workout = ${JSON.stringify(workout)}
const nutritionPlan = ${JSON.stringify(nutritionPlan)}
const initialWorkoutLogs = ${JSON.stringify(workoutHistory)}
const theme = new URLSearchParams(window.location.search).get('theme') === 'light' ? 'light' : 'dark'

function Harness() {
  const [workoutLogs, setWorkoutLogs] = useState(initialWorkoutLogs)
  async function saveWorkout(value) {
    const saved = { ...value, id: 'qa-saved-' + Date.now(), completedAt: new Date().toISOString() }
    setWorkoutLogs((current) => [...current, saved])
    return saved
  }
  return <StudentMobileApp
    student={student}
    checkins={[]}
    workouts={[workout]}
    nutritionPlans={[nutritionPlan]}
    workoutLogs={workoutLogs}
    messages={[]}
    appointments={[]}
    invoices={[]}
    assessments={[]}
    questionnaireAssignments={[]}
    exerciseLibraryItems={[]}
    coachId="qa-coach"
    theme={theme}
    coachSettings={{ publicName: 'Treinador QA' }}
    professionalType="trainer"
    accountEmail="aluno.qa@example.test"
    onCompleteWorkout={saveWorkout}
    onEndWorkout={async (value) => value}
    onSendMessage={async (value) => value}
    onAddCheckin={async (value) => value}
    onSubmitQuestionnaire={async (value) => value}
    onExit={() => {}}
  />
}

createRoot(document.getElementById('root')).render(<Harness />)
`

const server = await createServer({
  mode: 'test',
  envFile: false,
  define: {
    'import.meta.env.VITE_SUPABASE_URL': 'undefined',
    'import.meta.env.VITE_SUPABASE_ANON_KEY': 'undefined',
  },
  plugins: [{
    name: 'student-workout-diet-fixture',
    resolveId(id) {
      if (id === '/qa-student-workout-diet.jsx') return '\0qa-student-workout-diet.jsx'
    },
    async load(id) {
      if (id === '\0qa-student-workout-diet.jsx') {
        return transformWithEsbuild(fixture, 'qa-student-workout-diet.jsx', { loader: 'jsx', jsx: 'transform' })
      }
    },
    configureServer(vite) {
      vite.middlewares.use(async (request, response, next) => {
        if (new URL(request.url, 'http://localhost').pathname !== '/qa-student-workout-diet') return next()
        response.setHeader('Content-Type', 'text/html')
        response.end(await vite.transformIndexHtml('/qa-student-workout-diet', '<meta name="viewport" content="width=device-width, initial-scale=1"><div id="root"></div><script type="module" src="/qa-student-workout-diet.jsx"></script>'))
      })
    },
  }],
  server: { host: '127.0.0.1', port: 0, hmr: false },
})

await server.listen()
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_EXECUTABLE_PATH })
const base = server.resolvedUrls.local[0]

async function openTab(page, width, label) {
  if (width < 1024) {
    await page.getByRole('button', { name: 'Abrir menu do aluno' }).click()
    const menu = page.locator('.student-mobile-menu-panel')
    await menu.waitFor()
    await menu.getByRole('button', { name: new RegExp(`^${label}`) }).click()
    return
  }
  await page.locator('.student-desktop-sidebar').getByRole('button', { name: new RegExp(`^${label}`) }).click()
}

try {
  await mkdir('.superpowers/diet-qa', { recursive: true })
  const themes = process.env.QA_THEMES ? process.env.QA_THEMES.split(',') : ['light', 'dark']
  const widths = process.env.QA_WIDTHS ? process.env.QA_WIDTHS.split(',').map(Number) : [320, 390, 430, 1440]
  for (const theme of themes) {
  for (const width of widths) {
    const context = await browser.newContext({ viewport: { width, height: 960 }, hasTouch: width < 1024, isMobile: width < 1024 })
    const page = await context.newPage()
    const pageErrors = []
    page.on('pageerror', (error) => pageErrors.push(error.message))
    page.on('console', (message) => { if (message.type() === 'error') pageErrors.push(message.text()) })
    page.on('requestfailed', (request) => pageErrors.push(`${request.url()}: ${request.failure()?.errorText || 'request failed'}`))
    await page.goto(`${base}qa-student-workout-diet?theme=${theme}`)
    try {
      await page.locator('.student-mobile-shell').waitFor()
    } catch (error) {
      const body = await page.locator('body').innerText().catch(() => '')
      throw new Error(`A aplicação não montou em ${theme}/${width}px: ${pageErrors.join(' | ') || body || error.message}`)
    }
    await page.locator(`.student-mobile-shell.app-theme-${theme}`).waitFor()

    await openTab(page, width, 'Treino')
    const workoutArea = page.locator('.student-app-layout main')
    await workoutArea.getByRole('button', { name: 'Minha evolução', exact: true }).click()
    await workoutArea.getByRole('heading', { name: 'Minha evolução', exact: true }).waitFor()
    assert.ok(await workoutArea.getByText('Supino reto', { exact: true }).count(), 'A evolução deve listar somente exercícios com histórico real')
    assert.ok(await workoutArea.getByText('Peitoral', { exact: true }).count(), 'A evolução deve reutilizar o grupo muscular do treino')
    assert.ok(await workoutArea.locator('.student-workout-progress-page-v13').evaluate((element) => element.scrollWidth <= element.clientWidth + 1), 'A evolução não pode gerar overflow horizontal')
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth <= 1), 'A página de evolução não pode ampliar a viewport mobile')
    await page.screenshot({ path: `.superpowers/diet-qa/workout-progress-${theme}-${width}.png`, fullPage: true })
    await workoutArea.getByRole('button', { name: 'Voltar para treinos', exact: true }).click()
    const openWorkout = workoutArea.getByRole('button', { name: 'Ver treino', exact: true })
    assert.ok(await openWorkout.count(), `A aba Treino deve exibir a rotina: ${await workoutArea.innerText()}`)
    await openWorkout.click()
    await workoutArea.getByText('Supino reto', { exact: true }).waitFor()
    assert.equal(await workoutArea.locator('.muscle-map-card, img[alt*="anatômico"], img[alt*="exercício"], img[alt*="músculo"]').count(), 0, 'O treino do aluno não deve renderizar fotos ou anatomia do exercício')
    assert.ok(await workoutArea.getByText(/3 séries.*12 reps.*60s/i).count(), 'A prescrição textual do exercício deve permanecer visível')

    await workoutArea.getByRole('button', { name: '▶ Iniciar treino', exact: true }).click()
    await workoutArea.locator('.mobile-workout-command-v12').waitFor()
    assert.equal(await workoutArea.getByRole('button', { name: 'Exercício anterior', exact: true }).count(), 0, 'O primeiro exercício não deve exibir navegação anterior')
    assert.equal(await workoutArea.getByRole('button', { name: 'Ver evolução do exercício', exact: true }).count(), 0, 'A evolução não deve distrair durante a sessão ativa')
    assert.ok(await workoutArea.getByText('Orientações do treinador', { exact: true }).count(), 'As orientações devem usar o nome profissional correto')
    assert.equal(await workoutArea.locator('#student-workout-finish').count(), 0, 'A finalização deve ficar oculta antes do último exercício')
    const completeExerciseButton = workoutArea.getByRole('button', { name: 'Concluir exercício', exact: true })
    const completeExerciseAlignment = await completeExerciseButton.evaluate((element) => ({
      display: getComputedStyle(element).display,
      justifyContent: getComputedStyle(element).justifyContent,
      textAlign: getComputedStyle(element).textAlign,
    }))
    assert.equal(completeExerciseAlignment.display, 'flex', 'Concluir exercício deve usar alinhamento flexível')
    assert.equal(completeExerciseAlignment.justifyContent, 'center', 'Concluir exercício deve ficar centralizado')
    assert.equal(completeExerciseAlignment.textAlign, 'center', 'O texto de Concluir exercício deve ficar centralizado')
    const openSetButton = workoutArea.locator('.mobile-workout-set-open-v11').first()
    const openSetAlignment = await openSetButton.evaluate((element) => ({
      justifyContent: getComputedStyle(element).justifyContent,
      textAlign: getComputedStyle(element).textAlign,
    }))
    assert.equal(openSetAlignment.justifyContent, 'center', 'Próxima etapa e Abrir série devem ficar centralizados')
    assert.equal(openSetAlignment.textAlign, 'center', 'O conteúdo do botão de série deve ficar centralizado')
    await workoutArea.getByLabel('Carga (kg)', { exact: true }).fill('20')
    await workoutArea.getByLabel('Repetições', { exact: true }).fill('12')
    const completeSetButton = workoutArea.getByRole('button', { name: 'Concluir série', exact: true })
    const completeSetStyle = await completeSetButton.evaluate((element) => ({
      background: getComputedStyle(element).backgroundColor,
      color: getComputedStyle(element).color,
      justifyContent: getComputedStyle(element).justifyContent,
    }))
    assert.equal(completeSetStyle.justifyContent, 'center', 'Concluir série deve ficar centralizado')
    if (theme === 'light') {
      assert.equal(completeSetStyle.background, 'rgb(8, 125, 108)', 'Concluir série não pode permanecer branco no tema claro')
      assert.equal(completeSetStyle.color, 'rgb(255, 255, 255)', 'Concluir série deve manter contraste no tema claro')
    }
    await completeSetButton.click()

    const restWidget = page.locator('.mobile-workout-rest-portal-v12 .mobile-workout-rest-floating-v6')
    await restWidget.waitFor()
    const restPortal = page.locator('.mobile-workout-rest-portal-v12')
    assert.equal(await restPortal.evaluate((element) => getComputedStyle(element).backgroundColor), 'rgba(0, 0, 0, 0)', 'O portal de descanso não pode cobrir o treino com um fundo opaco')
    assert.ok(await workoutArea.getByText('Supino reto', { exact: true }).isVisible(), 'Concluir a série deve manter o exercício visível')
    if (theme === 'light') {
      assert.equal(await restWidget.locator('.mobile-workout-rest-floating-card-v6').evaluate((element) => getComputedStyle(element).backgroundColor), 'rgba(255, 255, 255, 0.98)', 'O descanso deve usar superfície clara legível')
    }
    const initialWidget = await restWidget.evaluate((element) => {
      const rect = element.getBoundingClientRect()
      return { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom, width: rect.width, viewportWidth: innerWidth, viewportHeight: innerHeight }
    })
    assert.ok(initialWidget.left >= 7 && initialWidget.top >= 71, 'O descanso deve nascer dentro da área segura')
    assert.ok(initialWidget.right <= initialWidget.viewportWidth - 7 && initialWidget.bottom <= initialWidget.viewportHeight - 91, 'O descanso deve ficar acima da navegação e dentro da viewport')

    const handle = restWidget.getByRole('button', { name: 'Mover timer de descanso', exact: true })
    const handleBox = await handle.boundingBox()
    const targetLeft = width <= 320 ? 30 : width <= 430 ? 48 : 140
    await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2)
    await page.mouse.down()
    await page.mouse.move(handleBox.x + handleBox.width / 2 + targetLeft - initialWidget.left, 180, { steps: 8 })
    await page.mouse.up()
    assert.ok(await restWidget.evaluate((element) => element.classList.contains('is-compact')), 'Arrastar o descanso não pode expandir o widget')
    const movedWidget = await restWidget.evaluate((element) => {
      const rect = element.getBoundingClientRect()
      return { left: rect.left, top: rect.top }
    })
    assert.ok(Math.abs(movedWidget.left - targetLeft) <= 8, `O descanso deve permanecer onde foi solto, recebido ${movedWidget.left}px`)
    assert.ok(movedWidget.top >= 71, 'O descanso arrastado deve continuar na área segura')

    const compactTimer = restWidget.getByRole('button', { name: /Expandir descanso/ })
    const compactTimerBox = await compactTimer.boundingBox()
    assert.ok(compactTimerBox.height >= 44, 'O controle de expandir deve ter uma área de toque confortável')
    const compactValue = parseTimerSeconds(await restWidget.locator('.mobile-workout-rest-compact-v13 strong').innerText())
    await compactTimer.click()
    await page.waitForTimeout(1100)
    const expandedValue = parseTimerSeconds(await restWidget.locator('.mobile-workout-rest-floating-copy-v6 strong').innerText())
    assert.ok(expandedValue <= compactValue - 1 && expandedValue >= compactValue - 2, 'Expandir o descanso não pode reiniciar nem duplicar a contagem')
    const minimizeTimer = restWidget.getByRole('button', { name: 'Minimizar timer de descanso', exact: true })
    const minimizeTimerBox = await minimizeTimer.boundingBox()
    assert.ok(minimizeTimerBox.height >= 44 && minimizeTimerBox.width >= 44, 'O controle de minimizar deve ter ao menos 44px')
    await minimizeTimer.click()
    const minimizedValue = parseTimerSeconds(await restWidget.locator('.mobile-workout-rest-compact-v13 strong').innerText())
    await compactTimer.click()
    const reexpandedValue = parseTimerSeconds(await restWidget.locator('.mobile-workout-rest-floating-copy-v6 strong').innerText())
    assert.ok(reexpandedValue <= minimizedValue && reexpandedValue >= minimizedValue - 1, 'Minimizar e reabrir não pode reiniciar o descanso')
    await page.screenshot({ path: `.superpowers/diet-qa/workout-timer-${theme}-${width}.png`, fullPage: false })
    if (theme === 'light') {
      assert.equal(await restWidget.locator('.mobile-workout-rest-floating-copy-v6 strong').evaluate((element) => getComputedStyle(element).color), 'rgb(20, 33, 31)', 'O contador expandido deve permanecer legível no portal claro')
    }
    await restWidget.getByRole('button', { name: 'Pausar', exact: true }).click()
    const pausedValue = await restWidget.locator('.mobile-workout-rest-floating-copy-v6 strong').innerText()
    await page.waitForTimeout(1100)
    assert.equal(await restWidget.locator('.mobile-workout-rest-floating-copy-v6 strong').innerText(), pausedValue, 'Pausar deve congelar o único contador')
    await restWidget.getByRole('button', { name: '+30s', exact: true }).click()
    await restWidget.getByRole('button', { name: 'Pular', exact: true }).click()
    await restWidget.waitFor({ state: 'hidden' })

    for (const [load, reps] of [['22', '12'], ['24', '11']]) {
      await workoutArea.getByLabel('Carga (kg)', { exact: true }).fill(load)
      await workoutArea.getByLabel('Repetições', { exact: true }).fill(reps)
      await workoutArea.getByRole('button', { name: 'Concluir série', exact: true }).click()
      await restWidget.waitFor()
      assert.equal(await restPortal.evaluate((element) => getComputedStyle(element).backgroundColor), 'rgba(0, 0, 0, 0)', 'O portal deve continuar transparente nas séries seguintes')
      await restWidget.getByRole('button', { name: /Expandir descanso/ }).click()
      await restWidget.getByRole('button', { name: 'Pular', exact: true }).click()
      await restWidget.waitFor({ state: 'hidden' })
    }

    await workoutArea.getByText('3/5 concluídas no dia', { exact: true }).waitFor()
    assert.equal(await workoutArea.locator('#student-workout-finish').count(), 0, 'A finalização continua oculta enquanto o primeiro exercício está ativo')
    await workoutArea.getByRole('button', { name: 'Concluir exercício', exact: true }).click()
    await workoutArea.getByText('Remada baixa com triângulo', { exact: true }).waitFor()
    const previousExerciseButton = workoutArea.getByRole('button', { name: 'Exercício anterior', exact: true })
    assert.ok(await previousExerciseButton.isVisible(), 'O segundo exercício deve permitir voltar ao anterior')
    assert.equal(await previousExerciseButton.evaluate((element) => getComputedStyle(element).justifyContent), 'center', 'Exercício anterior deve ficar centralizado')
    const muscleSummary = workoutArea.locator('.mobile-workout-muscle-target-anatomy-v6')
    assert.ok(await muscleSummary.isVisible(), 'O músculo principal deve permanecer visível e compacto')
    assert.ok(await muscleSummary.evaluate((element) => element.scrollWidth <= element.clientWidth + 1), 'O músculo principal não pode gerar overflow')
    assert.equal(await muscleSummary.locator('span').first().evaluate((element) => getComputedStyle(element).backgroundColor), 'rgba(0, 0, 0, 0)', 'O rótulo muscular não deve herdar fundos antigos')
    const finishPanel = workoutArea.locator('#student-workout-finish')
    await finishPanel.waitFor()
    const finishWorkout = finishPanel.getByRole('button', { name: 'Finalizar treino', exact: true })
    assert.equal(await finishWorkout.isEnabled(), false, 'A finalização deve aparecer no último exercício sem ignorar etapas pendentes')
    await finishPanel.getByLabel('Como foi o esforço?').selectOption('Forte')
    await finishPanel.getByLabel('Observação para o treinador').fill('Execução controlada e sem dor.')
    await workoutArea.getByRole('button', { name: 'Exercício anterior', exact: true }).click()
    assert.equal(await workoutArea.locator('#student-workout-finish').count(), 0, 'Voltar do último exercício deve ocultar a finalização')
    await workoutArea.locator('.mobile-workout-exercise-switcher-v4 button').nth(1).click()
    await finishPanel.waitFor()
    assert.equal(await finishPanel.getByLabel('Como foi o esforço?').inputValue(), 'Forte', 'O esforço deve ser preservado ao navegar entre exercícios')
    assert.equal(await finishPanel.getByLabel('Observação para o treinador').inputValue(), 'Execução controlada e sem dor.', 'A observação deve ser preservada ao navegar entre exercícios')

    for (const [load, reps] of [['35', '10'], ['37', '10']]) {
      await workoutArea.getByLabel('Carga (kg)', { exact: true }).fill(load)
      await workoutArea.getByLabel('Repetições', { exact: true }).fill(reps)
      await workoutArea.getByRole('button', { name: 'Concluir série', exact: true }).click()
      await restWidget.waitFor()
      await restWidget.getByRole('button', { name: /Expandir descanso/ }).click()
      await restWidget.getByRole('button', { name: 'Pular', exact: true }).click()
      await restWidget.waitFor({ state: 'hidden' })
    }

    await workoutArea.getByText('5/5 concluídas no dia', { exact: true }).waitFor()
    assert.equal(await finishWorkout.isEnabled(), true, 'Finalizar treino deve ser liberado após todas as séries')
    const finalizeColors = await finishWorkout.evaluate((element) => ({ background: getComputedStyle(element).backgroundColor, color: getComputedStyle(element).color }))
    assert.notEqual(finalizeColors.background, 'rgba(0, 0, 0, 0)', 'Finalizar treino deve continuar sendo a ação primária')
    assert.notEqual(finalizeColors.background, 'rgb(255, 255, 255)', 'Finalizar treino não deve parecer uma ação neutra no tema claro')
    assert.equal(finalizeColors.color, 'rgb(255, 255, 255)', 'Finalizar treino precisa manter contraste de texto')
    await page.screenshot({ path: `.superpowers/diet-qa/workout-execution-${theme}-${width}.png`, fullPage: true })
    await finishWorkout.click()
    await workoutArea.getByText('Treino concluído', { exact: true }).waitFor()
    await workoutArea.getByRole('button', { name: 'Minha evolução', exact: true }).click()
    await workoutArea.getByRole('heading', { name: 'Minha evolução', exact: true }).waitFor()
    assert.ok(await workoutArea.getByText('2 treinos', { exact: true }).count(), 'A evolução deve refletir o novo registro sem recarregar a aplicação')
    await workoutArea.getByRole('button', { name: 'Voltar para treinos', exact: true }).click()

    const workoutOverflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    assert.ok(workoutOverflow <= 1, `O treino não pode ter overflow horizontal em ${width}px`)
    await page.screenshot({ path: `.superpowers/diet-qa/workout-${theme}-${width}.png`, fullPage: true })

    await openTab(page, width, 'Dieta')
    await page.getByRole('button', { name: /Plano alimentar detalhado/ }).click()
    const breakfastButton = page.getByRole('button', { name: /Café da manhã/ })
    const lunchButton = page.getByRole('button', { name: /Almoço/ })
    const dinnerButton = page.getByRole('button', { name: /Jantar/ })
    assert.equal(await breakfastButton.getAttribute('aria-expanded'), 'true', 'A primeira refeição deve iniciar aberta')
    assert.equal(await lunchButton.getAttribute('aria-expanded'), 'false', 'As demais refeições devem iniciar recolhidas')
    assert.ok(await breakfastButton.getAttribute('aria-controls'), 'O accordion precisa relacionar cabeçalho e conteúdo')
    assert.ok(await page.getByText('Quantidade não informada', { exact: true }).count(), 'Quantidades ausentes devem ser informadas sem inventar 0 g')
    assert.equal(await page.getByText('0 g', { exact: true }).count(), 0, 'A dieta não pode inventar 0 g para quantidades ausentes')
    await lunchButton.click()
    assert.equal(await breakfastButton.getAttribute('aria-expanded'), 'true', 'Abrir o almoço não deve fechar o café da manhã')
    assert.equal(await lunchButton.getAttribute('aria-expanded'), 'true', 'O almoço deve abrir independentemente')
    const lunchSection = lunchButton.locator('xpath=..')
    const foodList = lunchSection.locator('.student-diet-food-list')
    await foodList.waitFor()
    assert.equal(await foodList.locator('.student-diet-food-row').count(), 3, 'Cada alimento deve ocupar uma linha própria')
    assert.ok(await foodList.getByText('Arroz Branco', { exact: true }).count(), 'O nome do alimento deve ficar visível')
    assert.ok(await foodList.getByText('200 g', { exact: true }).count(), 'A quantidade do alimento deve ficar visível')
    assert.ok(await foodList.getByText('Peito de Frango', { exact: true }).count(), 'Os alimentos da refeição não podem ser omitidos')
    assert.equal(await lunchSection.locator('.nutrition-meal-macros-v2 > div').count(), 3, 'Os três macronutrientes devem aparecer no rodapé da refeição')
    await breakfastButton.click()
    assert.equal(await breakfastButton.getAttribute('aria-expanded'), 'false', 'A refeição deve poder ser recolhida novamente')
    assert.equal(await lunchButton.getAttribute('aria-expanded'), 'true', 'Recolher uma refeição não deve alterar as demais')
    await dinnerButton.click()
    assert.equal(await dinnerButton.getAttribute('aria-expanded'), 'true', 'Qualquer refeição deve poder ser aberta')

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    assert.ok(overflow <= 1, `A página não pode ter overflow horizontal em ${width}px`)
    await page.screenshot({ path: `.superpowers/diet-qa/diet-${theme}-${width}.png`, fullPage: true })
    await context.close()
  }
  }

  console.log('PASS student workout text-only and detailed diet')
} finally {
  await browser.close()
  await server.close()
}

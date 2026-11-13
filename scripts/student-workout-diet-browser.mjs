import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import { createServer, transformWithEsbuild } from 'vite'

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright')

function parseTimerSeconds(value) {
  const parts = String(value).match(/\d{1,2}(?::\d{2}){1,2}/)?.[0].split(':').map(Number) || []
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2]
  if (parts.length === 2) return parts[0] * 60 + parts[1]
  return parts[0] || 0
}

function contrastRatio(foreground, background) {
  const luminance = (color) => {
    const channels = String(color).match(/[\d.]+/g)?.slice(0, 3).map(Number)
    if (!channels || channels.length !== 3) return null
    const [red, green, blue] = channels.map((channel) => {
      const linear = channel / 255
      return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
    })
    return 0.2126 * red + 0.7152 * green + 0.0722 * blue
  }
  const textLuminance = luminance(foreground)
  const surfaceLuminance = luminance(background)
  if (textLuminance === null || surfaceLuminance === null) return 0
  const [lighter, darker] = [textLuminance, surfaceLuminance].sort((a, b) => b - a)
  return (lighter + 0.05) / (darker + 0.05)
}

const student = {
  id: 'qa-student-workout-diet',
  name: 'Aluno QA',
  payment: 'Pago',
  appPaymentStatus: 'active',
  accessOverrideUntil: '2099-01-01',
}
const todayWeekday = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'][new Date().getDay()]

const workout = {
  id: 'qa-workout',
  studentId: student.id,
  title: 'Treino A',
  active: true,
  days: [{
    day: todayWeekday,
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
  title: `Treino A · ${todayWeekday}`,
  completedAt: '2026-10-01T12:00:00.000Z',
  notes: 'Atividades registradas pelo aluno:\nSupino reto — S1: 18 kg × 12 · S2: 20 kg × 10\nRemada baixa com triângulo — S1: 30 kg × 10',
}]

const fixture = `
import React, { useState } from 'react'
import { createRoot } from 'react-dom/client'
import { StudentMobileApp } from '/src/App.jsx'
import '/src/index.css'
import '/src/trainer-workout-workspace.css'
import '/src/student-workout-execution-build29.css'
import '/src/chat/chat.css'
import '/chat-wallpaper.css'
import '/chat-wallpaper-theme.css'
import '/src/StudentAnamnesisWorkspace.css'
import '/src/student-workout-figma-dark.css'
import '/src/student-workout-polish-build34.css'
import '/src/student-workout-xp-celebration-build35.css'
import '/src/student-workout-polish-build36.css'
import '/src/student-workout-polish-build37.css'
import '/src/student-workout-polish-build38.css'
import '/src/student-workout-polish-build39.css'
import '/src/student-workout-rest-background-build40.css'

const student = ${JSON.stringify(student)}
const workout = ${JSON.stringify(workout)}
const nutritionPlan = ${JSON.stringify(nutritionPlan)}
const initialWorkoutLogs = ${JSON.stringify(workoutHistory)}
const theme = new URLSearchParams(window.location.search).get('theme') === 'light' ? 'light' : 'dark'

function Harness() {
  const [workoutLogs, setWorkoutLogs] = useState(initialWorkoutLogs)
  const [mealLogs, setMealLogs] = useState([])
  async function saveWorkout(value) {
    const saved = { ...value, id: 'qa-saved-' + Date.now(), completedAt: new Date().toISOString() }
    setWorkoutLogs((current) => [...current, saved])
    return saved
  }
  async function saveMealLog(value) {
    const saved = { id: 'qa-meal-' + Date.now(), mealName: value.mealName, notes: value.notes, nutritionPlanId: value.nutritionPlanId, recordedAt: new Date().toISOString(), photoUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6lGQAAAAASUVORK5CYII=' }
    setMealLogs((current) => [saved, ...current])
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
    onRateWorkout={async (workoutLogId, rating) => ({ id: workoutLogId, rating })}
    onLoadMealLogs={async () => mealLogs}
    onSaveMealLog={saveMealLog}
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
    const progressButton = workoutArea.getByRole('button', { name: 'Minha evolução', exact: true })
    assert.equal(await progressButton.count(), 1, `O treino deve expor Minha evolução; conteúdo: ${(await workoutArea.innerText()).slice(0, 900)}; erros=${JSON.stringify(pageErrors)}`)
    assert.equal(await progressButton.isVisible(), true, `Minha evolução deve estar visível; conteúdo: ${(await workoutArea.innerText()).slice(0, 900)}`)
    await progressButton.click()
    await workoutArea.getByRole('heading', { name: 'Minha evolução', exact: true }).waitFor()
    assert.ok(await workoutArea.getByText('Supino reto', { exact: true }).count(), 'A evolução deve listar somente exercícios com histórico real')
    assert.ok(await workoutArea.getByText('Peitoral', { exact: true }).count(), 'A evolução deve reutilizar o grupo muscular do treino')
    assert.ok(await workoutArea.locator('.student-workout-progress-page-v13').evaluate((element) => element.scrollWidth <= element.clientWidth + 1), 'A evolução não pode gerar overflow horizontal')
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth <= 1), 'A página de evolução não pode ampliar a viewport mobile')
    await page.screenshot({ path: `.superpowers/diet-qa/workout-progress-${theme}-${width}.png`, fullPage: true })
    await workoutArea.getByRole('button', { name: 'Voltar para treinos', exact: true }).click()
    assert.ok(await workoutArea.getByText(/TREINO DE HOJE/).count(), `O treino de hoje deve abrir diretamente no overview: ${await workoutArea.innerText()}`)
    assert.equal(await workoutArea.getByRole('button', { name: 'Abrir treino', exact: true }).count(), 0, 'Com um dia mapeado para hoje, não deve ser necessária a lista manual antiga')
    await workoutArea.getByText('Supino reto', { exact: true }).waitFor()
    assert.equal(await workoutArea.locator('.muscle-map-card, img[alt*="anatômico"], img[alt*="exercício"], img[alt*="músculo"]').count(), 0, 'O treino do aluno não deve renderizar fotos ou anatomia do exercício')
    assert.ok(await workoutArea.getByText('3 × 12', { exact: true }).count(), 'A meta do exercício deve mostrar séries e repetições prescritas')
    assert.ok(await workoutArea.getByText('60s descanso', { exact: true }).count(), 'O tempo de descanso prescrito deve permanecer visível')

    await workoutArea.getByRole('button', { name: 'Iniciar treino', exact: true }).click()
    const sessionScreen = workoutArea.locator('.mobile-workout-definitive-v12')
    await sessionScreen.waitFor()
    assert.equal(await workoutArea.getByRole('button', { name: 'Exercício anterior', exact: true }).count(), 0, 'O primeiro exercício não deve exibir navegação anterior')
    assert.equal(await workoutArea.getByRole('button', { name: 'Ver evolução do exercício', exact: true }).count(), 0, 'A evolução não deve distrair durante a sessão ativa')
    assert.ok(await workoutArea.locator('.student-workout-figma-prescription-line').getByText(/12 reps prescritas/).count(), 'O exercício deve separar meta prescrita do valor realizado')
    assert.equal(await workoutArea.getByRole('button', { name: 'Encerrar treino', exact: true }).count(), 1, 'Encerrar treino deve continuar disponível como ação secundária')
    assert.equal(await workoutArea.getByRole('button', { name: 'Concluir treino', exact: true }).count(), 0, 'A conclusão normal só aparece após todas as séries e exercícios')
    const openSetButton = workoutArea.locator('.mobile-workout-set-open-v11').first()
    const openSetAlignment = await openSetButton.evaluate((element) => ({
      alignItems: getComputedStyle(element).alignItems,
      justifyItems: getComputedStyle(element).justifyItems,
      textAlign: getComputedStyle(element).textAlign,
    }))
    assert.equal(openSetAlignment.alignItems, 'center', 'Próxima etapa e Abrir série devem ficar centralizados')
    assert.equal(openSetAlignment.justifyItems, 'center', 'Os elementos do botão de série devem ficar centralizados')
    assert.equal(openSetAlignment.textAlign, 'center', 'O conteúdo do botão de série deve ficar centralizado')
    await workoutArea.getByLabel('Carga (kg)', { exact: true }).fill('20')
    const firstRepsInput = workoutArea.getByLabel('Repetições realizadas', { exact: true }).first()
    assert.equal(await firstRepsInput.inputValue(), '', 'O campo de repetições realizadas não deve pré-preencher a meta')
    await firstRepsInput.fill('12')
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

    const restScreen = workoutArea.locator('.student-workout-figma-rest')
    await restScreen.waitFor()
    await restScreen.getByText('Recupere o fôlego.', { exact: true }).waitFor()
    const restClock = restScreen.locator('.student-workout-figma-rest-clock')
    const initialRestSeconds = parseTimerSeconds(await restClock.locator('strong').innerText())
    assert.ok(initialRestSeconds > 0 && initialRestSeconds <= 60, `O descanso deve iniciar com o tempo prescrito; recebido ${initialRestSeconds}s`)
    const restBounds = await restScreen.evaluate((element) => {
      const rect = element.getBoundingClientRect()
      return { left: rect.left, right: rect.right, viewportWidth: innerWidth, scrollWidth: document.documentElement.scrollWidth }
    })
    assert.ok(restBounds.left >= 0 && restBounds.right <= restBounds.viewportWidth + 1, 'A tela de descanso deve caber na largura do dispositivo')
    assert.ok(restBounds.scrollWidth <= restBounds.viewportWidth + 1, 'Descanso não deve criar rolagem horizontal')
    const skipButton = restScreen.getByRole('button', { name: 'Pular descanso', exact: true })
    assert.ok((await skipButton.boundingBox()).height >= 44, 'Pular descanso deve manter uma área de toque confortável')
    await page.screenshot({ path: `.superpowers/diet-qa/workout-rest-${theme}-${width}.png`, fullPage: false })
    await restScreen.getByRole('button', { name: 'Pausar', exact: true }).click()
    await restScreen.getByRole('button', { name: 'Retomar', exact: true }).waitFor()
    const pausedValue = parseTimerSeconds(await restClock.locator('strong').innerText())
    await page.waitForTimeout(1100)
    assert.equal(parseTimerSeconds(await restClock.locator('strong').innerText()), pausedValue, 'Pausar deve congelar o contador')
    await restScreen.getByRole('button', { name: '+15 s', exact: true }).click()
    const adjustedValue = parseTimerSeconds(await restClock.locator('strong').innerText())
    assert.ok(adjustedValue >= pausedValue + 14, 'Ajustar descanso deve somar segundos sem reiniciar')
    await restScreen.getByRole('button', { name: '−15 s', exact: true }).click()
    assert.ok(Math.abs(parseTimerSeconds(await restClock.locator('strong').innerText()) - pausedValue) <= 1, 'O ajuste inverso deve restaurar o tempo pausado')
    await restScreen.getByRole('button', { name: 'Retomar', exact: true }).click()
    await restScreen.getByRole('button', { name: 'Pular descanso', exact: true }).click()
    await restScreen.waitFor({ state: 'hidden' })

    for (const [index, [load, reps]] of [['22', '12'], ['24', '11']].entries()) {
      await workoutArea.getByLabel('Carga (kg)', { exact: true }).fill(load)
      await workoutArea.getByLabel('Repetições realizadas', { exact: true }).fill(reps)
      await workoutArea.getByRole('button', { name: 'Concluir série', exact: true }).click()
      if (index === 0) {
        await restScreen.waitFor()
        await restScreen.getByRole('button', { name: 'Pular descanso', exact: true }).click()
        await restScreen.waitFor({ state: 'hidden' })
      } else {
        await workoutArea.locator('.student-workout-figma-exercise-complete').waitFor()
      }
    }

    await workoutArea.getByText('3/5 séries', { exact: true }).waitFor()
    await workoutArea.locator('.student-workout-figma-exercise-complete').waitFor()
    await workoutArea.getByRole('button', { name: 'Ir para Remada baixa com triângulo', exact: true }).click()
    await workoutArea.getByRole('heading', { name: 'Remada baixa com triângulo', exact: true }).waitFor()

    for (const [index, [load, reps]] of [['35', '10'], ['37', '10']].entries()) {
      await workoutArea.getByLabel('Carga (kg)', { exact: true }).fill(load)
      await workoutArea.getByLabel('Repetições realizadas', { exact: true }).fill(reps)
      await workoutArea.getByRole('button', { name: 'Concluir série', exact: true }).click()
      if (index === 0) {
        await restScreen.waitFor()
        await restScreen.getByRole('button', { name: 'Pular descanso', exact: true }).click()
        await restScreen.waitFor({ state: 'hidden' })
      } else {
        await workoutArea.locator('.student-workout-figma-exercise-complete').waitFor()
      }
    }

    await workoutArea.getByText('5/5 séries', { exact: true }).waitFor()
    const finishPanel = workoutArea.locator('.student-workout-figma-exercise-complete')
    await finishPanel.waitFor()
    const finishWorkout = finishPanel.getByRole('button', { name: 'Concluir treino', exact: true })
    assert.equal(await finishWorkout.isEnabled(), true, 'Concluir treino deve ser liberado após todas as séries')
    const finalizeColors = await finishWorkout.evaluate((element) => ({ background: getComputedStyle(element).backgroundColor, color: getComputedStyle(element).color }))
    assert.notEqual(finalizeColors.background, 'rgba(0, 0, 0, 0)', 'Concluir treino deve continuar sendo a ação primária')
    assert.notEqual(finalizeColors.background, 'rgb(255, 255, 255)', 'Concluir treino não deve parecer uma ação neutra no tema claro')
    assert.ok(contrastRatio(finalizeColors.color, finalizeColors.background) >= 4.5, `Concluir treino deve manter contraste WCAG AA, recebido ${JSON.stringify(finalizeColors)}`)
    await finishPanel.locator('summary').filter({ hasText: 'Adicionar observação do treino' }).click()
    await finishPanel.getByLabel('Como foi o esforço?').selectOption('Forte')
    await finishPanel.getByLabel('Observação para o treinador').fill('Execução controlada e sem dor.')
    await page.screenshot({ path: `.superpowers/diet-qa/workout-execution-${theme}-${width}.png`, fullPage: true })
    await finishWorkout.click()
    await workoutArea.getByText('Treino concluído!', { exact: true }).waitFor()
    const ratingPanel = workoutArea.locator('.student-workout-rating-panel')
    await ratingPanel.waitFor()
    await ratingPanel.getByRole('button', { name: '5 estrelas', exact: true }).click()
    await ratingPanel.getByRole('button', { name: 'Enviar avaliação', exact: true }).click()
    await ratingPanel.getByText('Avaliação salva. Obrigado por compartilhar sua experiência.', { exact: true }).waitFor()
    const xpCelebration = page.getByRole('dialog', { name: 'Treino concluído!', exact: true })
    await xpCelebration.waitFor({ state: 'visible' })
    assert.equal(await page.locator('.student-workout-xp-celebration').count(), 1, 'A avaliação deve disparar a celebração em tela cheia')
    await xpCelebration.getByRole('button', { name: 'Continuar', exact: true }).click()
    await workoutArea.getByRole('button', { name: 'Ver detalhes da sessão', exact: true }).click()
    await workoutArea.getByRole('heading', { name: 'Minha evolução', exact: true }).waitFor()
    assert.ok(await workoutArea.getByText('2 treinos', { exact: true }).count(), 'A evolução deve refletir o novo registro sem recarregar a aplicação')
    await workoutArea.getByRole('button', { name: 'Voltar para treinos', exact: true }).click()

    const workoutOverflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    assert.ok(workoutOverflow <= 1, `O treino não pode ter overflow horizontal em ${width}px`)
    await page.screenshot({ path: `.superpowers/diet-qa/workout-${theme}-${width}.png`, fullPage: true })

    await openTab(page, width, 'Dieta')
    await page.getByText('Plano alimentar detalhado', { exact: true }).waitFor()
    await page.getByRole('heading', { name: 'Registre sua refeição', exact: true }).waitFor()
    await page.getByRole('button', { name: 'Registrar refeição com foto', exact: true }).click()
    const photoInput = page.getByLabel('Foto da refeição', { exact: true })
    await photoInput.setInputFiles({
      name: 'refeicao-demo.png',
      mimeType: 'image/png',
      buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6lGQAAAAASUVORK5CYII=', 'base64'),
    })
    await page.locator('.student-meal-photo-field textarea').fill('Registro fictício para demonstração.')
    await page.getByRole('button', { name: 'Salvar refeição', exact: true }).click()
    await page.getByRole('status').filter({ hasText: 'Refeição registrada com sucesso.' }).waitFor()
    assert.equal(await page.locator('.student-meal-photo-log').count(), 1, 'O diário deve exibir o registro demonstrativo após salvar')

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    assert.ok(overflow <= 1, `A página não pode ter overflow horizontal em ${width}px`)
    await page.screenshot({ path: `.superpowers/diet-qa/diet-${theme}-${width}.png`, fullPage: true })
    await context.close()
  }
  }

  console.log('PASS student workout, 1–5 star rating, and meal-photo journal')
} finally {
  await browser.close()
  await server.close()
}

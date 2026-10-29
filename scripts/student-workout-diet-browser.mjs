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
  }],
}

const fixture = `
import React from 'react'
import { createRoot } from 'react-dom/client'
import { StudentMobileApp } from '/src/App.jsx'
import '/src/index.css'

const student = ${JSON.stringify(student)}
const workout = ${JSON.stringify(workout)}
const nutritionPlan = ${JSON.stringify(nutritionPlan)}
const theme = new URLSearchParams(window.location.search).get('theme') === 'light' ? 'light' : 'dark'

function Harness() {
  return <StudentMobileApp
    student={student}
    checkins={[]}
    workouts={[workout]}
    nutritionPlans={[nutritionPlan]}
    workoutLogs={[]}
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
    onCompleteWorkout={async (value) => value}
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
        response.end(await vite.transformIndexHtml('/qa-student-workout-diet', '<div id="root"></div><script type="module" src="/qa-student-workout-diet.jsx"></script>'))
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
    const openWorkout = workoutArea.getByRole('button', { name: 'Ver treino', exact: true })
    assert.ok(await openWorkout.count(), `A aba Treino deve exibir a rotina: ${await workoutArea.innerText()}`)
    await openWorkout.click()
    await workoutArea.getByText('Supino reto', { exact: true }).waitFor()
    assert.equal(await workoutArea.locator('.muscle-map-card, img[alt*="anatômico"], img[alt*="exercício"], img[alt*="músculo"]').count(), 0, 'O treino do aluno não deve renderizar fotos ou anatomia do exercício')
    assert.ok(await workoutArea.getByText(/3 séries.*12 reps.*60s/i).count(), 'A prescrição textual do exercício deve permanecer visível')

    await workoutArea.getByRole('button', { name: '▶ Iniciar treino', exact: true }).click()
    await workoutArea.locator('.mobile-workout-command-v12').waitFor()
    await workoutArea.getByLabel('Carga (kg)', { exact: true }).fill('20')
    await workoutArea.getByLabel('Repetições', { exact: true }).fill('12')
    await workoutArea.getByRole('button', { name: 'Concluir série', exact: true }).click()

    const restWidget = page.locator('.mobile-workout-rest-portal-v12 .mobile-workout-rest-floating-v6')
    await restWidget.waitFor()
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
    const movedWidget = await restWidget.evaluate((element) => {
      const rect = element.getBoundingClientRect()
      return { left: rect.left, top: rect.top }
    })
    assert.ok(Math.abs(movedWidget.left - targetLeft) <= 8, `O descanso deve permanecer onde foi solto, recebido ${movedWidget.left}px`)
    assert.ok(movedWidget.top >= 71, 'O descanso arrastado deve continuar na área segura')

    const compactTimer = restWidget.getByRole('button', { name: /Expandir descanso/ })
    const compactValue = parseTimerSeconds(await compactTimer.innerText())
    await compactTimer.click()
    await page.waitForTimeout(1100)
    const expandedValue = parseTimerSeconds(await restWidget.locator('.mobile-workout-rest-floating-copy-v6 strong').innerText())
    assert.ok(expandedValue <= compactValue - 1 && expandedValue >= compactValue - 2, 'Expandir o descanso não pode reiniciar nem duplicar a contagem')
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

    const workoutOverflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    assert.ok(workoutOverflow <= 1, `O treino não pode ter overflow horizontal em ${width}px`)
    await page.screenshot({ path: `.superpowers/diet-qa/workout-${theme}-${width}.png`, fullPage: true })

    await openTab(page, width, 'Dieta')
    await page.getByRole('button', { name: /Plano alimentar detalhado/ }).click()
    const foodList = page.locator('.student-diet-food-list')
    await foodList.waitFor()
    assert.equal(await foodList.locator('.student-diet-food-row').count(), 3, 'Cada alimento deve ocupar uma linha própria')
    assert.ok(await foodList.getByText('Arroz Branco', { exact: true }).count(), 'O nome do alimento deve ficar visível')
    assert.ok(await foodList.getByText('200 g', { exact: true }).count(), 'A quantidade do alimento deve ficar visível')
    assert.ok(await foodList.getByText('Peito de Frango', { exact: true }).count(), 'Os alimentos da refeição não podem ser omitidos')
    assert.equal(await page.locator('.nutrition-meal-macros-v2 > div').count(), 3, 'Os três macronutrientes devem aparecer no rodapé da refeição')

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

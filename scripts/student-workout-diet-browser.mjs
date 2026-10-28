import assert from 'node:assert/strict'
import { createServer, transformWithEsbuild } from 'vite'

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright')

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
    theme="dark"
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
      vite.middlewares.use('/qa-student-workout-diet', async (_request, response) => {
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
  for (const width of [390, 1440]) {
    const context = await browser.newContext({ viewport: { width, height: 960 } })
    const page = await context.newPage()
    await page.goto(`${base}qa-student-workout-diet`)
    await page.locator('.student-mobile-shell').waitFor()

    await openTab(page, width, 'Treino')
    const workoutArea = page.locator('.student-mobile-main')
    await workoutArea.getByText('Supino reto', { exact: true }).waitFor()
    assert.equal(await workoutArea.locator('.muscle-map-card, img[alt*="anatômico"], img[alt*="exercício"], img[alt*="músculo"]').count(), 0, 'O treino do aluno não deve renderizar fotos ou anatomia do exercício')
    assert.ok(await workoutArea.getByText(/3 séries.*12 reps.*60s/i).count(), 'A prescrição textual do exercício deve permanecer visível')

    await openTab(page, width, 'Dieta')
    await page.getByRole('button', { name: /Plano alimentar detalhado/ }).click()
    const foodList = page.locator('.student-diet-food-list')
    await foodList.waitFor()
    assert.equal(await foodList.locator('.student-diet-food-row').count(), 3, 'Cada alimento deve ocupar uma linha própria')
    assert.ok(await foodList.getByText('Arroz Branco', { exact: true }).count(), 'O nome do alimento deve ficar visível')
    assert.ok(await foodList.getByText('200 g', { exact: true }).count(), 'A quantidade do alimento deve ficar visível')
    assert.ok(await foodList.getByText('Peito de Frango', { exact: true }).count(), 'Os alimentos da refeição não podem ser omitidos')

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    assert.ok(overflow <= 1, `A página não pode ter overflow horizontal em ${width}px`)
    await context.close()
  }

  console.log('PASS student workout text-only and detailed diet')
} finally {
  await browser.close()
  await server.close()
}

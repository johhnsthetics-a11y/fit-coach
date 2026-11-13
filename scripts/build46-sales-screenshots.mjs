import assert from 'node:assert/strict'
import { mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { createServer } from 'vite'

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright')
const output = resolve('public/assets/sales-screens')
mkdirSync(output, { recursive: true })

const students = [
  {
    id: 'sales-demo-student-01',
    name: 'Rafa Demonstração',
    email: 'aluno01@example.test',
    goal: 'Condicionamento',
    level: 'Intermediário',
    payment: 'Pago',
    adherence: 82,
    accessOverrideUntil: '2099-01-01',
    weight: '78 kg',
    height: '1,76 m',
  },
  {
    id: 'sales-demo-student-02',
    name: 'Bia Demonstração',
    email: 'aluna02@example.test',
    goal: 'Hipertrofia',
    level: 'Intermediário',
    payment: 'Pago',
    adherence: 76,
    accessOverrideUntil: '2099-01-01',
    weight: '64 kg',
    height: '1,66 m',
  },
]

const workouts = [
  {
    id: 'sales-demo-workout-01',
    studentId: students[0].id,
    title: 'Treino A — Corpo completo',
    focus: 'Condicionamento geral',
    active: true,
    exercises: [
      { name: 'Agachamento livre', sets: '3', reps: '8–10', rest: '90 s' },
      { name: 'Supino reto com barra', sets: '3', reps: '8–10', rest: '90 s' },
      { name: 'Remada baixa', sets: '3', reps: '10–12', rest: '75 s' },
    ],
  },
  {
    id: 'sales-demo-workout-02',
    studentId: students[1].id,
    title: 'Treino B — Inferiores',
    focus: 'Força e resistência',
    active: true,
    exercises: [
      { name: 'Leg press 45°', sets: '3', reps: '10–12', rest: '90 s' },
      { name: 'Levantamento terra romeno', sets: '3', reps: '8–10', rest: '90 s' },
      { name: 'Mesa flexora', sets: '3', reps: '12–15', rest: '60 s' },
    ],
  },
]

const meal = {
  id: 'sales-demo-meal-01',
  name: 'Almoço',
  time: '12:30',
  foods: 'Arroz, feijão, proteína e salada',
  macros: '520 kcal · P 36 g · C 62 g · G 14 g',
  items: [{ id: 'sales-demo-food-01', foodName: 'Arroz integral cozido', grams: 100, quantity: 100, measureUnit: 'g' }],
}

const nutritionPlans = [
  {
    id: 'sales-demo-diet-01',
    studentId: students[0].id,
    title: 'Plano alimentar — rotina',
    active: true,
    calories: '2.050 kcal',
    protein: '140 g',
    meals: [meal],
  },
  {
    id: 'sales-demo-diet-02',
    studentId: students[1].id,
    title: 'Plano alimentar — equilíbrio',
    active: true,
    calories: '1.850 kcal',
    protein: '125 g',
    meals: [meal],
  },
]

const fixture = {
  user: { id: 'sales-demo-professional', name: 'Marina Demo', email: 'profissional@example.test' },
  students,
  workouts,
  nutritionPlans,
  checkins: [{ id: 'sales-demo-checkin-01', studentId: students[0].id, state: 'Pendente', createdAt: new Date().toISOString() }],
  messages: [],
  invoices: [],
  appointments: [1, 2].map((offset, index) => ({
    id: `sales-demo-appointment-0${index + 1}`,
    studentId: students[index].id,
    title: 'Acompanhamento',
    startsAt: new Date(Date.now() + offset * 24 * 60 * 60 * 1000).toISOString(),
    status: 'Agendado',
  })),
}

const server = await createServer({
  mode: 'test',
  envFile: false,
  define: {
    'import.meta.env.VITE_SUPABASE_URL': 'undefined',
    'import.meta.env.VITE_SUPABASE_ANON_KEY': 'undefined',
  },
  server: { host: '127.0.0.1', port: 0, hmr: false },
})
await server.listen()
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROMIUM_EXECUTABLE_PATH || '/usr/bin/chromium',
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
})

const positionTargetBelowHeader = async (page, selector, topOffset = 210) => page.evaluate(({ targetSelector, topOffset }) => {
  const target = document.querySelector(targetSelector)
  if (!target) throw new Error(`Não foi possível localizar o conteúdo real: ${targetSelector}`)

  let scrollRoot = document.scrollingElement
  let parent = target.parentElement
  while (parent && parent !== document.body) {
    const style = getComputedStyle(parent)
    if (parent.scrollHeight > parent.clientHeight + 8 && /(auto|scroll)/.test(style.overflowY)) {
      scrollRoot = parent
      break
    }
    parent = parent.parentElement
  }

  const rootTop = scrollRoot === document.scrollingElement ? 0 : scrollRoot.getBoundingClientRect().top
  const targetTop = target.getBoundingClientRect().top - rootTop + scrollRoot.scrollTop
  const nextTop = Math.max(0, targetTop - topOffset)
  scrollRoot.scrollTo({ top: nextTop, behavior: 'instant' })
  return {
    targetTop,
    nextTop,
    targetViewportTop: target.getBoundingClientRect().top,
    rootScrollHeight: scrollRoot.scrollHeight,
    rootClientHeight: scrollRoot.clientHeight,
  }
}, { targetSelector: selector, topOffset })

try {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    screen: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
  })
  await context.route('**/*', (route) => {
    const url = new URL(route.request().url())
    return url.hostname === '127.0.0.1'
      ? route.continue()
      : route.fulfill({ status: 204, body: '' })
  })
  await context.addInitScript((data) => {
    const theme = localStorage.getItem('build46-sales-theme') || 'dark'
    localStorage.setItem('build46-sales-theme', theme)
    localStorage.setItem('coachfitpro-ui-theme-20260831', theme)
    localStorage.setItem('fitcoach-ai-pro-v2', JSON.stringify(data))
  }, fixture)

  const page = await context.newPage()
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('console', (message) => {
    if (message.type() === 'error' && !message.text().includes('net::ERR')) errors.push(message.text())
  })
  const base = server.resolvedUrls.local[0]
  const views = [
    { query: 'area=visao', file: 'overview.png', selector: '.coach-dashboard-metrics', topOffset: 580 },
    { query: 'area=treinos', file: 'workouts.png', selector: '.trainer-workout-section-heading.trainer-workout-plan-list-intro-v2', tab: 'Planos', topOffset: 40 },
    { query: 'area=nutricao&nutricaoTab=prescritas', file: 'nutrition.png', selector: '.nutrition-tab-panel-v1', topOffset: 40 },
  ]

  for (const theme of ['dark', 'light']) {
    if (theme === 'light') await page.evaluate(() => localStorage.setItem('build46-sales-theme', 'light'))
    for (const view of views) {
      await page.goto(`${base}?${view.query}`, { waitUntil: 'networkidle' })
      if (view.tab) {
        const manager = page.locator('.mobile-workout-manager')
        await manager.getByRole('tab', { name: new RegExp(view.tab) }).click()
      }
      await page.locator(view.selector).first().waitFor({ state: 'visible', timeout: 15000 })
      await page.evaluate(() => document.fonts.ready)
      const alignment = await positionTargetBelowHeader(page, view.selector, view.topOffset)
      await page.waitForTimeout(250)
      const pageError = await page.getByText('Algo saiu do lugar, mas seus dados continuam seguros.', { exact: true }).count()
      assert.equal(pageError, 0, `${view.query}: tela de erro não deve ser exibida`)
      const dimensions = await page.evaluate(() => ({
        viewportWidth: innerWidth,
        scrollWidth: document.documentElement.scrollWidth,
        font: getComputedStyle(document.querySelector('#root')).fontFamily,
      }))
      assert.ok(dimensions.scrollWidth <= dimensions.viewportWidth + 1, `${view.query}: não deve haver overflow horizontal`)
      console.log(`${view.query} alignment: ${JSON.stringify(alignment)}`)
      if (view.query === 'area=treinos') {
        const planGeometry = await page.locator('.trainer-workout-plan-row').evaluateAll((rows) => rows.map((row) => {
          const rowRect = row.getBoundingClientRect()
          const archiveButton = row.querySelector('.trainer-workout-plan-row-actions button:last-child')
          const archiveRect = archiveButton?.getBoundingClientRect()
          const nextRect = row.nextElementSibling?.getBoundingClientRect()
          return {
            title: row.querySelector('.trainer-workout-plan-row-main strong')?.textContent,
            rowBottom: rowRect.bottom,
            archiveBottom: archiveRect?.bottom,
            nextTop: nextRect?.top ?? null,
          }
        }))
        assert.ok(planGeometry.length > 0, 'A fixture deve mostrar ao menos um plano ativo')
        for (const plan of planGeometry) {
          assert.ok(plan.archiveBottom !== undefined && plan.archiveBottom <= plan.rowBottom + 1, `Arquivar deve ficar dentro do cartão (${theme}): ${JSON.stringify(plan)}`)
          assert.ok(plan.nextTop === null || plan.nextTop >= plan.rowBottom + 4, `A ação Arquivar não deve encostar na linha seguinte (${theme}): ${JSON.stringify(plan)}`)
        }
        console.log(`Planos e ação Arquivar sem sobreposição (${theme}): ${planGeometry.length} cartões.`)
      }
      const file = view.file.replace('.png', `-${theme}.png`)
      await page.screenshot({ path: resolve(output, file), fullPage: false, animations: 'disabled' })
      console.log(`${file}: ${JSON.stringify(dimensions)}`)
    }
  }

  assert.deepEqual(errors, [], `Erros de console/React durante captura: ${JSON.stringify(errors)}`)
  console.log(`Capturas reais do app salvas em ${output} para os temas escuro e claro.`)
} finally {
  await browser.close()
  await server.close()
}

import assert from 'node:assert/strict'
import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createServer } from 'vite'

// Optional browser verification. Install Playwright separately; the default
// regression suite needs only the project's existing React/Vite dependencies.
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright')
const root = resolve(process.env.TEST_APP_ROOT || '.')
const output = resolve(process.env.TEST_OUTPUT_DIR || '../diagnostics')
const expectFailure = process.env.EXPECT_ORIGINAL_FAILURE === '1'
mkdirSync(output, { recursive: true })
const server = await createServer({
  root, mode: 'test', envFile: false,
  define: { 'import.meta.env.VITE_SUPABASE_URL': 'undefined', 'import.meta.env.VITE_SUPABASE_ANON_KEY': 'undefined' },
  server: { host: '127.0.0.1', port: 0, hmr: false },
})
await server.listen()
let browser
const results = []
try {
  browser = await chromium.launch({
    headless: true,
    ...(process.env.CHROMIUM_EXECUTABLE_PATH ? { executablePath: process.env.CHROMIUM_EXECUTABLE_PATH } : {}),
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
  })
  const student = { id: 'student-regression', name: 'Aluno Regressão', goal: 'Hipertrofia', level: 'Intermediário' }
  const workout = { id: 'workout-regression', studentId: student.id, title: 'Rotina Regressão', active: true, exercises: [{ name: 'Supino reto com barra', sets: '3', reps: '10', rest: '60s' }] }
  const scenarios = [
    { name: 'sem-treinos', students: [student], workouts: [] },
    { name: 'com-treinos', students: [student], workouts: [workout] },
    { name: 'sem-alunos', students: [], workouts: [] },
    { name: 'exercicios-nulos', students: [student], workouts: [{ ...workout, exercises: null }] },
  ]
  for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
    for (const scenario of expectFailure ? scenarios.slice(0, 1) : scenarios) {
      const context = await browser.newContext({ viewport })
      const page = await context.newPage()
      const errors = []
      page.on('pageerror', (error) => errors.push(error.stack))
      page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()) })
      // Only external media is stubbed; app modules, route, hooks, state and
      // renderers execute unchanged. No real accounts or database writes.
      await context.route('**/*', (route) => {
        const url = new URL(route.request().url())
        return url.hostname === '127.0.0.1' ? route.continue() : route.fulfill({ status: 204, body: '' })
      })
      await context.addInitScript((data) => {
        if (sessionStorage.getItem('regression-seeded')) return
        localStorage.setItem('fitcoach-ai-pro-v2', JSON.stringify(data))
        sessionStorage.setItem('regression-seeded', '1')
      }, { user: { id: 'coach-regression', name: 'Treinador Regressão' }, students: scenario.students, workouts: scenario.workouts })
      const base = server.resolvedUrls.local[0]
      await page.goto(base + '?area=visao')
      if (viewport.width < 1024) await page.getByRole('button', { name: 'Abrir menu', exact: true }).click()
      await page.locator('.coach-nav-item').filter({ hasText: /^Treinos$/ }).click()
      if (expectFailure) {
        await page.getByText('Algo saiu do lugar, mas seus dados continuam seguros.', { exact: true }).waitFor()
        const diagnostic = await page.evaluate(() => JSON.parse(localStorage.getItem('coachfitpro-last-error')))
        assert.equal(diagnostic.message, 'editingPlan is not defined')
        writeFileSync(resolve(output, `browser-before-${viewport.width}.json`), JSON.stringify(diagnostic, null, 2))
        await page.screenshot({ path: resolve(output, `before-${viewport.width}.png`) })
        console.log(`Original ${viewport.width}: ${diagnostic.message}\n${diagnostic.stack}`)
      } else {
        for (const action of ['menu', 'url-direta', 'refresh']) {
          if (action === 'url-direta') await page.goto(base + '?area=treinos')
          if (action === 'refresh') await page.reload()
          await page.locator('.mobile-workout-manager').waitFor({ state: 'visible' })
          assert.equal(new URL(page.url()).searchParams.get('area'), 'treinos')
          assert.equal(await page.evaluate(() => localStorage.getItem('coachfitpro-last-error')), null)
          if (scenario.students.length) assert.equal(await page.locator('select[name="studentId"]').last().inputValue(), student.id)
          if (scenario.workouts.length) assert.ok(await page.getByText('Rotina Regressão', { exact: true }).count())
          results.push(`${viewport.width} / ${scenario.name} / ${action}: PASS`)
        }
        if (scenario.name === 'com-treinos') {
          await page.screenshot({ path: resolve(output, `after-${viewport.width}.png`) })
          await page.getByRole('button', { name: 'Criar treino', exact: true }).click()
          await page.getByText('Criar novo treino', { exact: true }).waitFor()
          for (const step of ['Aluno', 'Dias', 'Exercícios', 'Revisar']) {
            assert.ok(await page.getByRole('button', { name: new RegExp(step) }).count(), `Etapa ${step} deve estar visível`)
          }
          await page.getByRole('button', { name: 'Continuar', exact: true }).click()
          await page.getByRole('button', { name: 'Adicionar primeiro dia', exact: true }).first().click()
          await page.getByRole('dialog', { name: 'Editar dia do treino', exact: true }).getByRole('button', { name: 'Salvar dia', exact: true }).click()
          await page.getByRole('button', { name: 'Continuar para exercícios', exact: true }).click()
          await page.locator('.mobile-workout-live-preview').waitFor({ state: 'visible' })
          assert.ok(await page.getByText('Prévia ao vivo', { exact: true }).count())
          assert.ok(await page.getByRole('button', { name: 'Concluir série', exact: true }).count())
          assert.ok(await page.getByLabel('Carga (kg)', { exact: true }).count())
          assert.ok(await page.getByLabel('Repetições', { exact: true }).count())
          await page.screenshot({ path: resolve(output, `builder-${viewport.width}.png`), fullPage: true })
          await page.getByRole('button', { name: /Adicionar (primeiro )?exercício/ }).first().click()
          const picker = page.getByRole('dialog', { name: 'Adicionar exercício', exact: true })
          await picker.waitFor({ state: 'visible' })
          const exerciseCards = picker.locator('.mobile-workout-picker-card-v2')
          assert.ok(await exerciseCards.count() >= 300)
          assert.ok(await picker.locator('.exercise-thumb').count() >= 300)
          assert.equal(await picker.locator('.mobile-workout-picker-check').count(), 0, 'Não deve existir um segundo botão de adicionar')
          assert.equal(
            await picker.getByRole('button', { name: /^(Adicionar|✓ Adicionado)$/ }).count(),
            await exerciseCards.count(),
            'Cada exercício deve ter exatamente um botão verde de adicionar',
          )
          assert.ok(await picker.getByText(/exercícios? selecionados?/).count())
          await page.screenshot({ path: resolve(output, `picker-${viewport.width}.png`), fullPage: true })
          await picker.getByRole('button', { name: 'Fechar', exact: true }).click()
        }
        if (viewport.width < 1024) await page.getByRole('button', { name: 'Abrir menu', exact: true }).click()
        await page.locator('.coach-nav-item').filter({ hasText: /^Visão geral$/ }).click()
        await page.locator('.coach-dashboard-metrics').waitFor({ state: 'visible' })
        assert.deepEqual(errors, [], 'No browser exceptions or console errors')
      }
      await context.close()
    }
  }
  writeFileSync(resolve(output, expectFailure ? 'browser-before.txt' : 'browser-after.txt'), results.join('\n'))
  if (!expectFailure) console.log(results.join('\n') + `\n${results.length} browser checks passed; return navigation and console checks passed.`)
} finally {
  await browser?.close()
  await server.close()
}

import assert from 'node:assert/strict'
import { createServer } from 'vite'

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright')
const server = await createServer({
  mode: 'test', envFile: false,
  define: { 'import.meta.env.VITE_SUPABASE_URL': 'undefined', 'import.meta.env.VITE_SUPABASE_ANON_KEY': 'undefined' },
  server: { host: '127.0.0.1', port: 0, hmr: false },
})
await server.listen()
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_EXECUTABLE_PATH })
try {
  for (const width of [390, 1440]) {
    for (const profile of [
      { email: 'sac@coachfitpro.com.br', role: 'Nutricionista', master: true },
      { email: 'nutrition@example.test', role: 'Nutricionista', nutritionist: true },
      { email: 'coach@example.test', role: 'Coach principal' },
    ]) {
      const context = await browser.newContext({ viewport: { width, height: 900 } })
      await context.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.fulfill({ status: 204, body: '' }))
      const page = await context.newPage()
      const errors = []
      page.on('pageerror', error => errors.push(error.message))
      await page.addInitScript(user => localStorage.setItem('fitcoach-ai-pro-v2', JSON.stringify({ user, students: [], workouts: [] })), { ...profile, id: 'qa-professional', name: 'Profissional QA' })
      const base = server.resolvedUrls.local[0]
      await page.goto(base + '?area=treinos')
      await page.locator('.coach-nav-item').first().waitFor()
      const nav = page.locator('.coach-nav-item')
      assert.equal(await nav.filter({ hasText: /^Treinos$/ }).count(), profile.nutritionist ? 0 : 1)
      assert.equal(await nav.filter({ hasText: /^Admin Master$/ }).count(), profile.master ? 1 : 0)
      await page.waitForFunction(expected => document.querySelector('.coach-mobile-page-header h2')?.textContent === expected, profile.nutritionist ? 'Nutrição' : 'Treinos')
      await page.reload()
      await page.waitForFunction(expected => document.querySelector('.coach-mobile-page-header h2')?.textContent === expected, profile.nutritionist ? 'Nutrição' : 'Treinos')
      await page.goto(base + '?area=visao')
      await page.getByText(profile.nutritionist ? 'Cadastre o primeiro paciente' : 'Cadastre o primeiro aluno', { exact: true }).waitFor()
      if (width < 1024) await page.getByRole('button', { name: 'Abrir menu', exact: true }).click()
      await nav.filter({ hasText: profile.nutritionist ? /^Pacientes$/ : /^Treinos$/ }).click()
      await page.waitForFunction(expected => document.querySelector('.coach-mobile-page-header h2')?.textContent === expected, profile.nutritionist ? 'Pacientes' : 'Treinos')
      await page.goto(base + '?area=alunos')
      await page.getByRole('button', { name: profile.nutritionist ? 'Novo paciente' : 'Novo aluno', exact: true }).click()
      await page.getByRole('button', { name: profile.nutritionist ? 'Salvar paciente' : 'Salvar aluno', exact: true }).waitFor()
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false)
      assert.deepEqual(errors, [])
      console.log(`PASS ${width}px ${profile.master ? 'master + nutrition role' : profile.role}: routes, refresh, navigation, form, overflow`)
      await context.close()
    }
  }
} finally {
  await browser.close()
  await server.close()
}

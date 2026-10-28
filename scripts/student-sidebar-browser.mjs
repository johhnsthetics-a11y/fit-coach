import assert from 'node:assert/strict'
import { mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { createServer, transformWithEsbuild } from 'vite'

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright')
const output = resolve('__qa-output/student-sidebar-premium')
mkdirSync(output, { recursive: true })
const student = {
  id: 'qa-sidebar-student',
  name: 'Aluno de demonstração',
  goal: 'Condicionamento e força',
  payment: 'Pago',
  appPaymentStatus: 'active',
  accessOverrideUntil: '2099-01-01',
  waterGoalMl: 2500,
}
const fixture = `
import React from 'react'
import { createRoot } from 'react-dom/client'
import { StudentMobileApp } from '/src/App.jsx'
import '/src/index.css'

const student = ${JSON.stringify(student)}
function Harness() {
  const theme = new URLSearchParams(location.search).get('theme') === 'dark' ? 'dark' : 'light'
  return <StudentMobileApp
    student={student}
    checkins={[]}
    workouts={[]}
    nutritionPlans={[]}
    workoutLogs={[]}
    messages={[]}
    appointments={[]}
    invoices={[]}
    assessments={[]}
    questionnaireAssignments={[]}
    coachId="qa-sidebar-coach"
    theme={theme}
    toggleUiTheme={() => {}}
    coachSettings={{ brandName: 'Coach Fit Pro', publicName: 'Treinador QA' }}
    professionalName="Treinador QA"
    professionalType="trainer"
    accountEmail="aluno.qa@example.test"
    onExit={() => {}}
    onDeleteAccount={async () => ({ ok: true })}
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
    name: 'student-sidebar-fixture',
    resolveId(id) {
      if (id === '/qa-sidebar-fixture.jsx') return '\0qa-sidebar-fixture.jsx'
    },
    async load(id) {
      if (id === '\0qa-sidebar-fixture.jsx') {
        return transformWithEsbuild(fixture, 'qa-student-sidebar.jsx', { loader: 'jsx', jsx: 'transform' })
      }
    },
    configureServer(vite) {
      vite.middlewares.use('/qa-student-sidebar', async (_request, response) => {
        response.setHeader('Content-Type', 'text/html')
        response.end(await vite.transformIndexHtml('/qa-student-sidebar', '<div id="root"></div><script type="module" src="/qa-sidebar-fixture.jsx"></script>'))
      })
    },
  }],
  server: { host: '127.0.0.1', port: 0, hmr: false },
})

await server.listen()
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_EXECUTABLE_PATH })
const base = server.resolvedUrls.local[0]

try {
  for (const theme of ['light', 'dark']) {
    for (const width of [390, 1024, 1440]) {
      const context = await browser.newContext({ viewport: { width, height: 900 } })
      const page = await context.newPage()
      await page.goto(`${base}qa-student-sidebar?theme=${theme}`)
      await page.locator('.student-mobile-shell').waitFor()

      const sidebar = width < 1024
        ? page.locator('.student-mobile-menu-panel')
        : page.locator('.student-desktop-sidebar')
      if (width < 1024) {
        await page.getByRole('button', { name: 'Abrir menu do aluno' }).click()
        await sidebar.waitFor()
      }

      const activeItem = sidebar.getByRole('button', { name: /^Início/ })
      assert.equal(await activeItem.getAttribute('aria-current'), 'page', 'O item ativo deve ser anunciado como página atual')
      const accentWidth = await activeItem.evaluate((element) => parseFloat(getComputedStyle(element, '::before').width) || 0)
      assert.ok(accentWidth >= 3, 'O item ativo deve ter marcador lateral visível')

      const idleItem = sidebar.getByRole('button', { name: /^Treino/ })
      const idleBorder = await idleItem.evaluate((element) => getComputedStyle(element).borderColor)
      assert.ok(/rgba\([^)]*, 0\)|transparent/.test(idleBorder), `Itens inativos não devem parecer botões contornados: ${idleBorder}`)

      const idleIconColors = await sidebar.locator('.app-nav-toned-button:not(.is-active) .app-nav-tone-icon').evaluateAll((icons) => (
        [...new Set(icons.map((icon) => getComputedStyle(icon).color))]
      ))
      assert.equal(idleIconColors.length, 1, 'Ícones inativos devem usar uma cor visual uniforme')

      if (width >= 1024) {
        await sidebar.getByText('Mais opções', { exact: true }).click()
      }
      const privacyLabel = sidebar.getByText('Conta e privacidade', { exact: true })
      await privacyLabel.waitFor()
      const privacyLayout = await privacyLabel.evaluate((element) => ({
        clientWidth: element.clientWidth,
        scrollWidth: element.scrollWidth,
        textOverflow: getComputedStyle(element).textOverflow,
      }))
      assert.ok(privacyLayout.scrollWidth <= privacyLayout.clientWidth + 1, 'Conta e privacidade não pode ser cortado')
      assert.notEqual(privacyLayout.textOverflow, 'ellipsis', 'Conta e privacidade não deve usar reticências')

      await sidebar.getByText('Mais opções', { exact: true }).waitFor()
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, 'A sidebar não pode criar overflow horizontal')
      if (width === 390 || width === 1440) {
        await page.screenshot({ path: resolve(output, `${theme}-${width}.png`), fullPage: false })
      }
      await context.close()
    }
  }
  console.log('PASS student sidebar premium: themes, active state, labels and responsive layout')
} finally {
  await browser.close()
  await server.close()
}


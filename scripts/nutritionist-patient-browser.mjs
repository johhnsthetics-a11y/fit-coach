import assert from 'node:assert/strict'
import { mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { createServer, transformWithEsbuild } from 'vite'

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright')
const output = resolve('__qa-output/nutritionist-patient-20261014')
mkdirSync(output, { recursive: true })
const patientFixture = `
import React from 'react';
import { createRoot } from 'react-dom/client';
import { StudentMobileApp } from '/src/App.jsx';
import '/src/index.css';
const student = { id: 'patient-qa', name: 'Marina Costa', goal: 'Reeducação alimentar', payment: 'Pago', email: 'marina@example.test', accessOverrideUntil: '2099-01-01' };
const plan = { id: 'plan-qa', studentId: student.id, title: 'Plano alimentar principal', active: true, meals: [] };
function Harness() {
  const [theme, setTheme] = React.useState('dark');
  return <StudentMobileApp student={student} professionalType="nutritionist" financialAccessOpen nutritionPlans={[plan]} checkins={[]} workouts={[]} workoutLogs={[]} exerciseLibraryItems={[]} messages={[]} appointments={[]} invoices={[]} assessments={[]} questionnaireAssignments={[]} nutritionQuestionnaires={[]} coachSettings={{ publicName: 'Dra. Helena' }} coachId="nutritionist-qa" theme={theme} toggleUiTheme={() => setTheme(value => value === 'dark' ? 'light' : 'dark')} onCompleteWorkout={async value => value} onEndWorkout={async value => value} onAddCheckin={async value => value} onSendMessage={async value => value} onSubmitQuestionnaire={async value => value} onExit={() => {}} />;
}
createRoot(document.getElementById('root')).render(<Harness />);
`

const server = await createServer({
  mode: 'test',
  envFile: false,
  define: {
    'import.meta.env.VITE_SUPABASE_URL': 'undefined',
    'import.meta.env.VITE_SUPABASE_ANON_KEY': 'undefined',
  },
  plugins: [{
    name: 'nutritionist-patient-qa',
    resolveId(id) {
      if (id === '/nutritionist-patient-fixture.jsx') return '\0nutritionist-patient-fixture.jsx'
    },
    async load(id) {
      if (id === '\0nutritionist-patient-fixture.jsx') {
        return transformWithEsbuild(patientFixture, 'nutritionist-patient-fixture.jsx', { loader: 'jsx', jsx: 'transform' })
      }
    },
    configureServer(viteServer) {
      viteServer.middlewares.use('/qa-patient', async (_request, response) => {
        response.setHeader('Content-Type', 'text/html')
        response.end(await viteServer.transformIndexHtml('/qa-patient', '<div id="root"></div><script type="module" src="/nutritionist-patient-fixture.jsx"></script>'))
      })
    },
  }],
  server: { host: '127.0.0.1', port: 0, hmr: false },
})

await server.listen()
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_EXECUTABLE_PATH })
const base = server.resolvedUrls.local[0]

try {
  for (const width of [320, 390, 1440]) {
    const context = await browser.newContext({ viewport: { width, height: 900 } })
    await context.route('**/*', (route) => new URL(route.request().url()).hostname === '127.0.0.1'
      ? route.continue()
      : route.fulfill({ status: 204, body: '' }))
    const page = await context.newPage()
    const errors = []
    page.on('pageerror', (error) => errors.push(error.message))

    await page.addInitScript(() => {
      localStorage.setItem('fitcoach-ai-pro-v2', JSON.stringify({
        user: { id: 'nutritionist-qa', name: 'Dra. Helena', email: 'helena@example.test', role: 'Nutricionista' },
        students: [{ id: 'patient-qa', name: 'Marina Costa', email: 'marina@example.test', status: 'Ativo', payment: 'Pago', goal: 'Reeducação alimentar' }],
        nutritionPlans: [],
        workouts: [],
      }))
    })
    await page.goto(`${base}?area=visao`)
    await page.locator('.coach-auth-shell').waitFor()

    const professionalNavText = await page.locator('.coach-mobile-bottom-nav button span').allTextContents()
    assert.deepEqual(professionalNavText.map((text) => text.trim()), ['Início', 'Pacientes', 'Dieta', 'Agenda', 'Menu'])
    assert.equal(await page.getByText('Criar treino', { exact: true }).count(), 0)
    assert.equal(await page.getByText('Criar dieta', { exact: true }).isVisible(), width < 1024)
    assert.equal(await page.getByText('Sem treino ativo', { exact: true }).count(), 0)
    assert.equal(await page.getByText('Sem plano alimentar', { exact: true }).count(), 1)

    if (width < 1024) await page.getByRole('button', { name: 'Abrir menu', exact: true }).click()
    const professionalNav = page.locator('.coach-nav-item')
    assert.equal(await professionalNav.filter({ hasText: /^Treinos$/ }).count(), 0)
    assert.equal(await professionalNav.filter({ hasText: /^Check-ins$/ }).count(), 1)
    assert.equal(await professionalNav.filter({ hasText: /^Recebimentos$/ }).count(), 1)
    if (width < 1024) await page.locator('.coach-mobile-menu-panel button[aria-label="Fechar menu"]').click()
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false)
    await page.screenshot({ path: resolve(output, `nutritionist-${width}.png`), fullPage: true })

    const professionalViews = new Map([
      ['visao', 'Visão geral'],
      ['agenda', 'Agenda'],
      ['alunos', 'Pacientes'],
      ['avaliacoes', 'Avaliações'],
      ['nutricao', 'Nutrição'],
      ['checkins', 'Check-ins'],
      ['pagamentos', 'Recebimentos'],
      ['notificacoes', 'Notificações'],
      ['mensagens', 'Mensagens'],
      ['aluno-app', 'Área do paciente'],
      ['configuracoes', 'Gerenciamento'],
      ['assinatura', 'Minha assinatura'],
    ])
    for (const [view, title] of professionalViews) {
      await page.goto(`${base}?area=${view}`)
      await page.waitForFunction((expectedTitle) => document.querySelector('.coach-mobile-page-header h2')?.textContent?.trim() === expectedTitle, title)
      assert.equal(await page.locator('.coach-nav-item').filter({ hasText: /^Treinos$/ }).count(), 0, `${view}: nutricionista não deve receber a área de treinos`)
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, `${view}: sem overflow horizontal`)
      if (view === 'agenda') {
        await page.getByRole('tab', { name: 'Organização de Protocolos', exact: true }).click()
        await page.getByText('Organização de Protocolos', { exact: true }).first().waitFor()
      }
    }

    await page.goto(`${base}qa-patient?alunoTab=treino`)
    await page.locator('.student-mobile-shell').waitFor()
    await page.waitForFunction(() => document.querySelector('.student-header-nav p:last-child')?.textContent?.trim() === 'Início')
    await page.getByText('Seu acompanhamento', { exact: true }).first().waitFor()
    const patientEyebrowFits = await page.locator('.welcome-header-eyebrow').first().evaluate((element) => element.scrollWidth <= element.clientWidth + 1)
    assert.equal(patientEyebrowFits, true)
    const patientBottomText = await page.locator('.student-bottom-nav button span').allTextContents()
    assert.deepEqual(patientBottomText.map((text) => text.trim()), ['Início', 'Dieta', 'Progresso', 'Chat', 'MENU'])
    if (width < 1024) await page.getByRole('button', { name: 'Abrir menu do paciente', exact: true }).click()
    const patientMenu = width < 1024 ? page.locator('.student-mobile-menu-panel') : page.locator('.student-desktop-sidebar')
    await patientMenu.getByText('Área do paciente', { exact: true }).waitFor()
    assert.equal(await patientMenu.getByRole('button', { name: /^Treino/ }).count(), 0)
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false)
    assert.equal(await page.getByText(/^Treinos?$/, { exact: true }).count(), 0)
    if (width < 1024) await page.locator('.student-mobile-menu-panel button[aria-label="Fechar menu"]').click()
    await page.screenshot({ path: resolve(output, `patient-${width}.png`), fullPage: true })

    const patientTabs = new Map([
      ['inicio', 'Início'],
      ['dieta', 'Dieta'],
      ['checkin', 'Check-in'],
      ['mensagens', 'Chat'],
      ['pagamentos', 'Fatura'],
      ['agenda', 'Agenda'],
      ['progresso', 'Progresso'],
      ['historico', 'Histórico'],
      ['conta', 'Conta e privacidade'],
    ])
    for (const [tab, title] of patientTabs) {
      await page.goto(`${base}qa-patient?alunoTab=${tab}`)
      await page.locator('.student-mobile-shell').waitFor()
      await page.waitForFunction((expectedTitle) => document.querySelector('.student-header-nav p:last-child')?.textContent?.trim() === expectedTitle, title)
      assert.equal(await page.getByText(/^Treinos?$/, { exact: true }).count(), 0, `${tab}: paciente não deve receber treino`)
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, `${tab}: sem overflow horizontal`)
    }
    assert.deepEqual(errors, [])

    console.log(`PASS ${width}px nutritionist + patient navigation and responsive layout`)
    await context.close()
  }
} finally {
  await browser.close()
  await server.close()
}

import assert from 'node:assert/strict'
import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createServer, transformWithEsbuild } from 'vite'

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright')
const output = resolve('__qa-output/billing-commissions-20261001')
mkdirSync(output, { recursive: true })

const student = {
  id: 'qa-patient',
  name: 'Mariana Oliveira',
  payment: 'Pago',
  appPaymentStatus: 'active',
  accessOverrideUntil: '2099-01-01',
}
const invoices = [
  { id: 'paid', studentId: student.id, description: 'Acompanhamento setembro', amount: 180, dueDate: '2026-09-10', paidAt: '2026-09-09T14:00:00Z', status: 'Pago' },
  { id: 'open', studentId: student.id, description: 'Acompanhamento outubro', amount: 180, dueDate: '2026-10-10', status: 'Pendente' },
]
const report = {
  totals: { commissionCents: 1250, paidClients: 2, paidInstallments: 2, revenueCents: 5000 },
  clients: [
    { studentId: 'student-a', clientName: 'Carlos Almeida', clientEmail: 'carlos@example.test', appPaymentStatus: 'active', paymentCount: 1, revenueCents: 2500, commissionCents: 625, lastPaidAt: '2026-09-30T15:00:00Z' },
    { studentId: 'patient-b', clientName: 'Mariana Oliveira', clientEmail: 'mariana@example.test', appPaymentStatus: 'active', paymentCount: 1, revenueCents: 2500, commissionCents: 625, lastPaidAt: '2026-09-29T15:00:00Z' },
  ],
}

const fixture = `
import React from 'react';
import { createRoot } from 'react-dom/client';
import { StudentMobileApp, ProfessionalCommissionsPage } from '/src/App.jsx';
import '/src/index.css';
const student=${JSON.stringify(student)};
const invoices=${JSON.stringify(invoices)};
const report=${JSON.stringify(report)};
function Billing(){
  React.useEffect(() => { history.replaceState(null, '', '?alunoTab=pagamentos') }, []);
  return <StudentMobileApp student={student} checkins={[]} workouts={[]} nutritionPlans={[]} workoutLogs={[]} messages={[]} appointments={[]} invoices={invoices} assessments={[]} coachSettings={{ publicName:'Dra. Ana Souza', pixKey:'pix@coachfitpro.test' }} coachId="qa-nutritionist" professionalType="nutritionist" theme="light" onExit={()=>{}} />;
}
function Commissions(){ return <main className="min-h-screen bg-zinc-950 p-3 text-zinc-100 sm:p-6"><ProfessionalCommissionsPage loadCommissionReport={async()=>report} /></main> }
createRoot(document.getElementById('root')).render(location.pathname.includes('commissions') ? <Commissions/> : <Billing/>);
`

const server = await createServer({
  mode: 'test',
  envFile: false,
  define: {
    'import.meta.env.VITE_SUPABASE_URL': 'undefined',
    'import.meta.env.VITE_SUPABASE_ANON_KEY': 'undefined',
  },
  plugins: [{
    name: 'billing-commissions-fixture',
    resolveId(id) { if (id === '/__qa-billing-commissions.jsx') return '\0qa-billing-commissions.jsx' },
    async load(id) {
      if (id === '\0qa-billing-commissions.jsx') return transformWithEsbuild(fixture, 'qa-billing-commissions.jsx', { loader: 'jsx', jsx: 'transform' })
    },
    configureServer(vite) {
      vite.middlewares.use(async (request, response, next) => {
        if (!request.url?.startsWith('/qa-billing') && !request.url?.startsWith('/qa-commissions')) return next()
        response.setHeader('Content-Type', 'text/html')
        response.end(await vite.transformIndexHtml(request.url, '<div id="root"></div><script type="module" src="/__qa-billing-commissions.jsx"></script>'))
      })
    },
  }],
  server: { host: '127.0.0.1', port: 0, hmr: false },
})

await server.listen()
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_EXECUTABLE_PATH })
const base = server.resolvedUrls.local[0]
const results = []

try {
  for (const width of [390, 1440]) {
    const context = await browser.newContext({ viewport: { width, height: 900 } })
    await context.route('**/*', (route) => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.fulfill({ status: 204, body: '' }))
    const page = await context.newPage()
    const errors = []
    page.on('pageerror', (error) => errors.push(error.message))
    page.on('console', (message) => { if (message.type() === 'error' && !message.text().includes('net::ERR')) errors.push(message.text()) })

    await page.goto(`${base}qa-billing?alunoTab=pagamentos`)
    await page.waitForTimeout(500)
    await page.getByText('COACH FIT PRO ATIVO', { exact: true }).waitFor()
    await page.getByText('Nutricionista', { exact: true }).waitFor()
    await page.getByText('R$ 180,00', { exact: true }).first().waitFor()
    await page.getByText('pix@coachfitpro.test', { exact: true }).waitFor()
    assert.equal(await page.getByText(/afiliad/i).count(), 0)
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false)
    await page.screenshot({ path: resolve(output, `billing-${width}.png`), fullPage: true })
    results.push(`billing ${width}px`)

    await page.goto(`${base}qa-commissions`)
    await page.getByRole('heading', { name: 'Comissões', exact: true }).waitFor()
    await page.getByText('R$ 12,50', { exact: true }).waitFor()
    await page.getByText('Carlos Almeida', { exact: true }).waitFor()
    await page.getByText('Mariana Oliveira', { exact: true }).waitFor()
    assert.equal(await page.getByText(/afiliad/i).count(), 0)
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false)
    await page.screenshot({ path: resolve(output, `commissions-${width}.png`), fullPage: true })
    results.push(`commissions ${width}px`)

    assert.deepEqual(errors, [])
    await context.close()
  }
  writeFileSync(resolve(output, 'results.json'), JSON.stringify({ results }, null, 2))
  console.log(JSON.stringify({ results }, null, 2))
} finally {
  await browser.close()
  await server.close()
}

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
  professionalCommissions: {
    commissionRate: 0.5,
    totals: { paidProfessionals: 1, paidInstallments: 1, revenueCents: 4990, commissionCents: 2495 },
    payments: [{ paymentId:'pro-payment', referredName:'Paulo Treinador', referredEmail:'paulo@example.test', professionalType:'trainer', planCycle:'monthly', paidAt:'2026-10-01T15:00:00Z', grossAmountCents:4990, commissionRate:0.5, commissionCents:2495, status:'paid' }],
    referrals: [{ id:'ref-1', referredEmail:'paulo@example.test', professionalType:'trainer', status:'converted', convertedAt:'2026-10-01T15:00:00Z' }],
  },
  consolidatedTotals: { paidAccounts: 3, paidInstallments: 3, revenueCents: 9990, commissionCents: 3745 },
}
const referralReport = { referrals: report.professionalCommissions.referrals };
const adminReport = {
  totals: { affiliateCount:1, studentsBrought:2, newStudentsInPeriod:1, paidStudents:1, paidInstallments:1, revenueCents:2500, commissionCents:625 },
  professionalTotals: { referrals:1, convertedProfessionals:1, paidProfessionals:1, paidInstallments:1, revenueCents:4990, commissionCents:2495 },
  consolidatedTotals: { paidAccounts:2, paidInstallments:2, revenueCents:7490, commissionCents:3120 },
  affiliates: [{
    email:'ana@example.test', active:true, professionalName:'Ana Afiliada', professionalType:'nutritionist', studentsBrought:2, newStudentsInPeriod:1,
    paidStudents:1, paidInstallments:1, revenueCents:2500, commissionCents:625,
    professionalReferralsCount:1, convertedProfessionals:1, paidProfessionals:1, professionalPaidInstallments:1, professionalRevenueCents:4990, professionalCommissionCents:2495,
    consolidatedRevenueCents:7490, consolidatedCommissionCents:3120,
    sales:[{paymentId:'student-payment',studentId:'student-a',studentName:'Carlos Almeida',studentEmail:'carlos@example.test',paidAt:'2026-09-30T15:00:00Z',revenueCents:2500,commissionCents:625,providerAmountCents:2500,providerOrderId:'student-order',providerSubscriptionId:'student-subscription',status:'paid'}],
    professionalPayments:[{paymentId:'professional-payment',referredName:'Paulo Treinador',referredEmail:'paulo@example.test',professionalType:'trainer',planCycle:'monthly',paidAt:'2026-10-01T15:00:00Z',grossAmountCents:4990,commissionRate:0.5,commissionCents:2495,providerOrderId:'professional-order',providerSubscriptionId:'professional-subscription',status:'paid'}],
  }],
};

const fixture = `
import React from 'react';
import { createRoot } from 'react-dom/client';
import { StudentMobileApp, ProfessionalCommissionsPage, AffiliateFinancePage } from '/src/App.jsx';
import '/src/index.css';
const student=${JSON.stringify(student)};
const invoices=${JSON.stringify(invoices)};
const report=${JSON.stringify(report)};
const referralReport=${JSON.stringify(referralReport)};
const adminReport=${JSON.stringify(adminReport)};
function Billing(){
  React.useEffect(() => { history.replaceState(null, '', '?alunoTab=pagamentos') }, []);
  return <StudentMobileApp student={student} checkins={[]} workouts={[]} nutritionPlans={[]} workoutLogs={[]} messages={[]} appointments={[]} invoices={invoices} assessments={[]} coachSettings={{ publicName:'Dra. Ana Souza', pixKey:'pix@coachfitpro.test' }} coachId="qa-nutritionist" professionalType="nutritionist" theme="light" onExit={()=>{}} />;
}
function Commissions(){
  const params = new URLSearchParams(location.search);
  const theme = params.get('theme') === 'dark' ? 'dark' : 'light';
  const professionalType = params.get('role') === 'nutritionist' ? 'nutritionist' : 'trainer';
  return <main className={'app-shell min-h-screen p-3 sm:p-6 app-theme-' + theme} data-theme={theme}>
    <header className="mb-5"><h1 className="text-3xl font-black">Comissões</h1></header>
    <ProfessionalCommissionsPage professionalType={professionalType} appAdminSettings={{ commissionWhatsappUrl:'https://wa.me/5511999999999' }} loadCommissionReport={async()=>report} loadProfessionalReferrals={async()=>referralReport} createProfessionalReferral={async()=>({ok:true,token:'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',referral:{id:'ref-new',referredEmail:'novo@example.test',professionalType:'trainer',status:'pending'}})} cancelProfessionalReferral={async()=>({ok:true})} />
  </main>
}
function AdminFinance(){
  return <main className="min-h-screen bg-[#F8FAFA] p-3 sm:p-6"><AffiliateFinancePage loadFinanceReport={async()=>adminReport} /></main>;
}
createRoot(document.getElementById('root')).render(location.pathname.includes('affiliate-finance') ? <AdminFinance/> : location.pathname.includes('commissions') ? <Commissions/> : <Billing/>);
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
        if (!request.url?.startsWith('/qa-billing') && !request.url?.startsWith('/qa-commissions') && !request.url?.startsWith('/qa-affiliate-finance')) return next()
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

    for (const theme of ['light', 'dark']) {
      const role = width === 390 ? 'nutritionist' : 'trainer'
      await page.goto(`${base}qa-commissions?theme=${theme}&role=${role}`)
      await page.getByRole('heading', { name: 'Comissões', exact: true }).waitFor()
      assert.equal(await page.getByRole('heading', { name: 'Comissões', exact: true }).count(), 1)
      await page.getByText(/R\$\s*12,50/).waitFor()
      await page.getByText(/R\$\s*37,45/, { exact: true }).waitFor()
      await page.getByText('Carlos Almeida', { exact: true }).waitFor()
      await page.getByText('Mariana Oliveira', { exact: true }).waitFor()
      await page.getByText('Paulo Treinador', { exact: true }).waitFor()
      await page.getByRole('heading', { name: 'Cadastrar Treinador/Nutricionista' }).waitFor()
      await page.getByLabel('E-mail do profissional indicado').fill('novo@example.test')
      await page.getByLabel('Tipo do profissional indicado').selectOption('trainer')
      await page.getByRole('button', { name: 'Gerar link de convite' }).click()
      await page.getByText(/app\.coachfitpro\.com\.br\/login/).waitFor()
      await page.getByRole('button', { name: 'Copiar link' }).waitFor()
      await page.getByRole('button', { name: 'Exportar PDF' }).waitFor()
      const rescue = page.getByRole('link', { name: 'Resgatar' })
      await rescue.waitFor()
      assert.equal(await rescue.getAttribute('href'), 'https://wa.me/5511999999999')
      await page.getByText(role === 'nutritionist' ? 'Comissões de pacientes · 25%' : 'Comissões de alunos · 25%', { exact: true }).waitFor()
      assert.equal(await page.getByText(/afiliad/i).count(), 0)
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false)
      await page.screenshot({ path: resolve(output, `commissions-${theme}-${width}.png`), fullPage: true })
      results.push(`commissions ${theme} ${role} ${width}px`)
    }

    await page.goto(`${base}qa-affiliate-finance`)
    await page.getByText('Receita e comissão sem misturar valores pendentes', { exact: true }).waitFor()
    await page.getByText(/R\$\s*31,20/, { exact: true }).first().waitFor()
    await page.getByText('Comissão de alunos/pacientes · 25%', { exact: true }).waitFor()
    await page.getByText('Comissão profissional · 50%', { exact: true }).waitFor()
    await page.getByRole('button', { name: 'Ver 2 lançamento(s)' }).click()
    await page.getByText('Histórico financeiro do afiliado', { exact: true }).waitFor()
    await page.getByRole('button', { name: 'Alunos/Pacientes · 25%' }).waitFor()
    await page.getByRole('button', { name: 'Profissionais · 50%' }).click()
    await page.getByText('Paulo Treinador', { exact: true }).waitFor()
    await page.getByText('professional-order', { exact: true }).waitFor()
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false)
    await page.screenshot({ path: resolve(output, `affiliate-finance-${width}.png`), fullPage: true })
    results.push(`affiliate finance ${width}px`)

    assert.deepEqual(errors, [])
    await context.close()
  }
  writeFileSync(resolve(output, 'results.json'), JSON.stringify({ results }, null, 2))
  console.log(JSON.stringify({ results }, null, 2))
} finally {
  await browser.close()
  await server.close()
}

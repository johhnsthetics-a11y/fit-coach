import assert from 'node:assert/strict'
import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createServer, transformWithEsbuild } from 'vite'

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright')
const output = resolve('__qa-output/nutrition-multiple-20260916')
mkdirSync(output, { recursive: true })
const student = { id: 'nutrition-qa-a', name: 'João de Oliveira', goal: 'Hipertrofia', payment: 'Pago', accessOverrideUntil: '2099-01-01', email: 'joao@example.test' }
const secondStudent = { ...student, id: 'nutrition-qa-b', name: 'Maria Santos', email: 'maria@example.test' }
const meal = { id: 'meal-qa', name: 'Almoço com alimentos e orientações detalhadas', time: '12:30', foods: 'Arroz integral, feijão, frango grelhado e salada. Ajustar conforme orientação profissional.', macros: '650 kcal | P 40 g | C 85 g | G 17 g', items: [{ id: 'item-qa', foodName: 'Arroz integral cozido', grams: 100, quantity: 100, measureUnit: 'g' }] }
const plans = [
  { id: 'diet-a1', studentId: student.id, title: 'Fase 1 - Adaptação', active: true, calories: '2000 kcal', protein: '140 g', meals: [meal] },
  { id: 'diet-a2', studentId: student.id, title: 'Fase 2 - Manutenção', active: true, calories: '2300 kcal', protein: '150 g', meals: [meal] },
  { id: 'diet-hidden', studentId: student.id, title: 'Fase oculta', active: false, meals: [meal] },
  { id: 'diet-b', studentId: secondStudent.id, title: 'Plano Maria', active: true, meals: [meal] },
]
const fixture = `import React from 'react'; import {createRoot} from 'react-dom/client'; import {StudentMobileApp} from '/src/App.jsx'; import '/src/index.css';
const data=JSON.parse(localStorage.getItem('fitcoach-ai-pro-v2'));
function Harness(){const [theme,setTheme]=React.useState('light');return <StudentMobileApp student={data.students[0]} nutritionPlans={data.nutritionPlans} checkins={[]} workouts={[]} workoutLogs={[]} messages={[]} appointments={[]} invoices={[]} assessments={[]} questionnaireAssignments={[]} coachId="qa-coach" theme={theme} toggleUiTheme={()=>setTheme(v=>v==='light'?'dark':'light')} onExit={()=>{}}/>}
createRoot(document.getElementById('root')).render(<Harness/>);`
const server = await createServer({ mode: 'test', envFile: false,
  define: { 'import.meta.env.VITE_SUPABASE_URL': 'undefined', 'import.meta.env.VITE_SUPABASE_ANON_KEY': 'undefined' },
  plugins: [{ name: 'nutrition-qa', resolveId(id) { if (id === '/nutrition-fixture.jsx') return '\0nutrition-fixture.jsx' }, async load(id) { if (id === '\0nutrition-fixture.jsx') return transformWithEsbuild(fixture, 'nutrition-fixture.jsx', { loader: 'jsx', jsx: 'transform' }) }, configureServer(server) { server.middlewares.use('/qa-nutrition', async (_req, res) => { res.setHeader('Content-Type', 'text/html'); res.end(await server.transformIndexHtml('/qa-nutrition', '<div id="root"></div><script type="module" src="/nutrition-fixture.jsx"></script>')) }) } }],
  server: { host: '127.0.0.1', port: 0, hmr: false },
})
await server.listen()
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_EXECUTABLE_PATH })
const base = server.resolvedUrls.local[0]
const results = []
try {
  for (const width of (process.env.QA_WIDTHS || '320,360,390,430,768,1440').split(',').map(Number)) {
    const context = await browser.newContext({ viewport: { width, height: 900 } })
    await context.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.fulfill({ status: 204, body: '' }))
    const page = await context.newPage()
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    page.on('console', message => { if (message.type() === 'error' && !message.text().includes('net::ERR')) errors.push(message.text()) })
    await page.goto(base)
    await page.evaluate(data => localStorage.setItem('fitcoach-ai-pro-v2', JSON.stringify(data)), { user: { id: 'qa-coach', name: 'QA', email: 'qa@example.test' }, students: [student, secondStudent], nutritionPlans: plans })
    await page.goto(base + 'qa-nutrition?alunoTab=dieta')
    await page.locator('.student-mobile-shell').waitFor()
    assert.equal(await page.locator('.nutrition-plan-card-v6').count(), 2, 'Paciente deve ter acesso às duas dietas ativas, não só à primeira')
    assert.equal(await page.getByText('Fase oculta', { exact: true }).count(), 0)
    assert.equal(await page.getByText('Plano Maria', { exact: true }).count(), 0)
    await page.getByRole('button', { name: /Fase 2 - Manutenção/ }).click()
    await page.getByText(meal.foods, { exact: true }).waitFor()
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false)
    await page.screenshot({ path: resolve(output, `patient-${width}.png`), fullPage: true })
    await page.reload()
    assert.equal(await page.locator('.nutrition-plan-card-v6').count(), 2)
    await page.goto(base + '?area=nutricao&nutricaoTab=prescritas')
    const cards = page.locator('.nutrition-plan-card-v6')
    const search = page.getByRole('searchbox', { name: 'Buscar dietas prescritas' })
    await search.fill('joao')
    assert.equal(await cards.count(), 3, 'Busca sem acento inclui dietas disponíveis e ocultas do mesmo paciente')
    await search.fill('maria@example.test')
    assert.equal(await cards.count(), 1)
    await search.fill('manutencao')
    assert.equal(await cards.count(), 1)
    await search.fill('inexistente')
    await page.getByText('Nenhuma dieta encontrada para esta busca.', { exact: true }).waitFor()
    await page.getByRole('button', { name: 'Limpar busca', exact: true }).click()
    assert.equal(await cards.count(), 4)
    const phase2 = cards.filter({ hasText: 'Fase 2 - Manutenção' })
    await phase2.getByRole('button', { name: /Fase 2/ }).click()
    page.on('dialog', dialog => dialog.accept())
    await phase2.getByRole('button', { name: 'Ocultar do paciente', exact: true }).click()
    await phase2.getByText('Oculta do paciente', { exact: true }).waitFor()
    await page.reload()
    assert.equal(await cards.filter({ hasText: 'Oculta do paciente' }).count(), 2)
    await page.goto(base + 'qa-nutrition?alunoTab=dieta')
    assert.equal(await cards.count(), 1, 'Ocultar uma dieta não pode ocultar as outras')
    await page.goto(base + '?area=nutricao&nutricaoTab=prescritas')
    await phase2.getByRole('button', { name: /Fase 2/ }).click()
    await phase2.getByRole('button', { name: 'Mostrar ao paciente', exact: true }).click()
    await phase2.getByText('Disponível', { exact: true }).waitFor()
    const maria = cards.filter({ hasText: 'Plano Maria' })
    await maria.getByRole('button', { name: /Plano Maria/ }).click()
    await maria.getByRole('button', { name: 'Editar dieta', exact: true }).click()
    assert.equal(await page.getByRole('textbox', { name: 'Nome da dieta', exact: true }).inputValue(), 'Plano Maria', 'Editar paciente B não pode carregar dieta do paciente A selecionado no painel')
    assert.equal(await page.locator('input[name="studentId"]').inputValue(), secondStudent.id)
    await page.getByRole('textbox', { name: 'Nome da dieta', exact: true }).fill('Plano Maria atualizado')
    await page.getByRole('button', { name: 'Atualizar dieta', exact: true }).click()
    await page.waitForFunction(() => JSON.parse(localStorage.getItem('fitcoach-ai-pro-v2')).nutritionPlans.some(p => p.id === 'diet-b' && p.title === 'Plano Maria atualizado'))
    await page.getByRole('button', { name: 'Nova dieta', exact: true }).click()
    assert.equal(await page.locator('input[name="studentId"]').inputValue(), secondStudent.id, 'Nova fase mantém o paciente em edição')
    await page.getByRole('textbox', { name: 'Nome da dieta', exact: true }).fill('Nova fase Maria')
    await page.locator('.nutrition-template-chip').first().click()
    await page.getByRole('textbox', { name: 'Nome da dieta', exact: true }).fill('Nova fase Maria')
    await page.getByRole('button', { name: 'Salvar dieta', exact: true }).click()
    await page.waitForFunction(() => JSON.parse(localStorage.getItem('fitcoach-ai-pro-v2')).nutritionPlans.filter(p => p.studentId === 'nutrition-qa-b').length === 2)
    await page.getByRole('button', { name: 'Visão do aluno', exact: true }).click()
    const dietPreview = page.getByRole('dialog', { name: 'Visão do aluno da dieta' })
    assert.equal(await dietPreview.evaluate(e => e.scrollWidth > e.clientWidth + 1), false)
    await page.waitForTimeout(250)
    await page.screenshot({ path: resolve(output, `diet-preview-${width}.png`) })
    await page.getByRole('button', { name: 'Fechar visão do aluno', exact: true }).click()
    await page.goto(base + '?area=nutricao&nutricaoTab=questionario')
    await page.getByRole('button', { name: 'Pré-visualizar', exact: true }).click()
    const preview = page.getByRole('dialog', { name: 'Prévia do questionário nutricional' })
    for (const mode of ['Mobile', 'Desktop']) {
      await preview.getByRole('button', { name: mode, exact: true }).click()
      for (const theme of ['light', 'dark']) {
        const portal = page.locator('.questionnaire-preview-portal-v1')
        if (!(await portal.getAttribute('class')).includes('app-theme-' + theme)) await preview.locator('.questionnaire-student-head-toggle-v1').click()
        const layout = await preview.evaluate(el => {
          const stage = el.querySelector('.questionnaire-preview-stage-v1')
          const card = el.querySelector('.student-questionnaire-preview-card-v1')
          return { overflow: el.scrollWidth > el.clientWidth + 1 || stage.scrollWidth > stage.clientWidth + 1, padding: parseFloat(getComputedStyle(card).paddingLeft), bottom: el.getBoundingClientRect().bottom }
        })
        assert.equal(layout.overflow, false, `${width} ${mode} ${theme}: no clipped content`)
        assert.ok(layout.padding >= 16, 'Conteúdo afastado das bordas da simulação')
        assert.ok(layout.bottom <= 900, 'Modal dentro da viewport')
        await preview.getByRole('button', { name: 'Concluir questionário', exact: true }).scrollIntoViewIfNeeded()
        await preview.locator('.questionnaire-preview-stage-v1').evaluate(el => { el.scrollTop = 0 })
        await page.screenshot({ path: resolve(output, `questionnaire-${width}-${mode}-${theme}.png`) })
      }
    }
    await preview.getByRole('button', { name: 'Fechar', exact: true }).click()
    await page.goto(base + '?area=nutricao&nutricaoTab=prescritas')
    assert.equal(await cards.count(), 5, 'Nova dieta adicionada sem substituir outra fase')
    await page.screenshot({ path: resolve(output, `prescribed-${width}.png`), fullPage: true })
    await page.evaluate(() => {
      const data = JSON.parse(localStorage.getItem('fitcoach-ai-pro-v2'))
      data.nutritionPlans = data.nutritionPlans.map(plan => ({ ...plan, active: false }))
      localStorage.setItem('fitcoach-ai-pro-v2', JSON.stringify(data))
    })
    await page.goto(base + 'qa-nutrition?alunoTab=dieta')
    await page.getByText('Sua dieta ainda não foi liberada pelo coach.', { exact: true }).waitFor()
    assert.equal(await cards.count(), 0, 'Sem dietas disponíveis, nenhum plano oculto deve ser exibido')
    assert.deepEqual(errors, [])
    results.push({ width, multiplePatientPlans: true, search: true, hideRestoreReload: true, editPatientB: true, createSecondPhase: true, previewsBothThemes: true })
    await context.close()
  }
  writeFileSync(resolve(output, 'results.json'), JSON.stringify(results, null, 2))
  console.log(JSON.stringify(results, null, 2))
} finally { await browser.close(); await server.close() }

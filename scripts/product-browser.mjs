import assert from 'node:assert/strict'
import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createServer, transformWithEsbuild } from 'vite'

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright')
const output = resolve('__qa-output/product-audit-20260916')
mkdirSync(output, { recursive: true })
const student = { id: 'qa-student-a', name: 'Aluno de teste A', goal: 'Hipertrofia', level: 'Iniciante', payment: 'Pago', accessOverrideUntil: '2099-01-01', weight: '80 kg', height: '180 cm' }
const secondStudent = { ...student, id: 'qa-student-b', name: 'Aluno de teste B' }
const workout = { id: 'qa-workout', studentId: student.id, title: 'Treino de teste', active: true, exercises: [{ name: 'Supino reto com barra', sets: '2', reps: '10', load: '20', rest: '0s' }, { name: 'Remada baixa', sets: '1', reps: '12', load: '15', rest: '0s' }] }
const assignments = [1, 2].map(n => ({ id: 'qa-assignment-' + n, studentId: student.id, status: 'Pendente', questionSnapshot: { title: 'Questionário QA ' + n, questions: [{ id: 'q1', label: 'Restrições alimentares?', type: 'single', required: true, options: ['Não', 'Outra'] }] } }))
const studentFixture = `import React from 'react'; import {createRoot} from 'react-dom/client'; import {StudentMobileApp} from '/src/App.jsx'; import '/src/index.css';
const student=${JSON.stringify(student)};
function Harness(){
 const [logs,setLogs]=React.useState(()=>JSON.parse(localStorage.getItem('qa-logs')||'[]'));
 const [forms,setForms]=React.useState(()=>JSON.parse(localStorage.getItem('qa-forms')||'null')||${JSON.stringify(assignments)});
 const [theme,setTheme]=React.useState('light');
 return <StudentMobileApp student={student} checkins={[{id:'other',studentId:'qa-student-b',note:'PRIVATE_OTHER_STUDENT'}]} workouts={[${JSON.stringify(workout)}]} nutritionPlans={[]} workoutLogs={logs} messages={[]} appointments={[]} invoices={[]} assessments={[]} questionnaireAssignments={forms} coachId="qa-coach" theme={theme} toggleUiTheme={()=>setTheme(v=>v==='light'?'dark':'light')} onExit={()=>location.assign('/login?mode=signin')}
 onSubmitQuestionnaire={async(id,answers)=>{
  if(window.qaFailSubmit) throw new Error('Falha de conexão de teste');
  const saved={...forms.find(f=>f.id===id),answers,status:'Respondido',completedAt:new Date().toISOString(),xpAwarded:true};
  const next=forms.map(f=>f.id===id?saved:f);localStorage.setItem('qa-forms',JSON.stringify(next));setForms(next);return saved;
 }}
 onCompleteWorkout={async log=>{const saved={...log,id:log.completionToken,completedAt:new Date().toISOString()}; setLogs(prev=>{const next=[saved,...prev.filter(i=>i.id!==saved.id)];localStorage.setItem('qa-logs',JSON.stringify(next));return next});return saved}}/>
}
createRoot(document.getElementById('root')).render(<Harness/>);`
const server = await createServer({
  mode: 'test', envFile: false,
  define: { 'import.meta.env.VITE_SUPABASE_URL': 'undefined', 'import.meta.env.VITE_SUPABASE_ANON_KEY': 'undefined' },
  plugins: [{ name: 'student-test-harness', resolveId(id) { if (id === '/qa-fixture.jsx') return '\0qa-fixture.jsx' }, async load(id) { if (id === '\0qa-fixture.jsx') return await transformWithEsbuild(studentFixture, 'qa-fixture.jsx', { loader: 'jsx', jsx: 'transform' }) }, configureServer(server) { server.middlewares.use('/qa-student', async (_req, res) => { res.setHeader('Content-Type', 'text/html'); res.end(await server.transformIndexHtml('/qa-student', '<div id="root"></div><script type="module" src="/qa-fixture.jsx"></script>')) }) } }],
  server: { host: '127.0.0.1', port: 0, hmr: false },
})
await server.listen()
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_EXECUTABLE_PATH })
const base = server.resolvedUrls.local[0]
const results = []
const problems = []
try {
  for (const width of process.env.QA_WIDTHS ? process.env.QA_WIDTHS.split(',').map(Number) : [320, 360, 390, 430, 768, 1440]) {
    console.log(`Validando ${width}px`)
    const context = await browser.newContext({ viewport: { width, height: 900 } })
    await context.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.fulfill({ status: 204, body: '' }))
    const page = await context.newPage()
    let errors = []
    page.on('pageerror', e => errors.push(e.message))
    page.on('console', m => { if (m.type() === 'error' && !m.text().includes('net::ERR')) errors.push(m.text()) })
    await page.goto(base)
    await page.evaluate(data => localStorage.setItem('fitcoach-ai-pro-v2', JSON.stringify(data)), { user: { id: 'qa-coach', name: 'Profissional QA', email: 'qa@example.test' }, students: [student, secondStudent], workouts: [workout] })
    for (const area of ['visao','agenda','alunos','avaliacoes','treinos','nutricao','checkins','pagamentos','notificacoes','mensagens','aluno-app','configuracoes','assinatura']) {
      errors = []
      await page.goto(base + '?area=' + area)
      await page.locator('.coach-nav-item').first().waitFor()
      await page.waitForTimeout(200)
      const broken = await page.getByText('Algo saiu do lugar, mas seus dados continuam seguros.', { exact: true }).count()
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)
      if (broken || errors.length || overflow) problems.push({ role:'coach', width, area, errors:[...errors], overflow, broken })
      results.push(`coach ${width} ${area}`)
      if (width === 390 && ['agenda','alunos','nutricao','configuracoes'].includes(area)) await page.screenshot({ path: resolve(output, `${area}-${width}.png`), fullPage:true })
    }
    await page.goto(base + 'qa-student')
    for (const tab of ['inicio','treino','dieta','checkin','mensagens','pagamentos','agenda','progresso','historico']) {
      errors=[]
      await page.goto(base + 'qa-student?alunoTab=' + tab)
      try { await page.locator('.student-mobile-shell').waitFor() } catch(error) { console.log({errors,body:await page.locator('body').innerText()}); throw error }
      await page.waitForTimeout(200)
      const broken = await page.getByText('Algo saiu do lugar, mas seus dados continuam seguros.', { exact: true }).count()
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)
      if(broken || errors.length || overflow) problems.push({role:'student',width,tab,errors:[...errors],overflow,broken})
      results.push(`student ${width} ${tab}`)
      if(width===390 && ['inicio','treino'].includes(tab)) await page.screenshot({path:resolve(output,`student-${tab}-${width}.png`),fullPage:true})
    }
    if ([390,1440].includes(width)) {
      errors=[]
      await page.goto(base+'qa-student?alunoTab=inicio')
      await page.getByRole('button',{name:'Responder depois',exact:true}).click()
      assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('qa-forms')||'[]').filter(f=>f.status==='Respondido').length),0)
      await page.goto(base+'qa-student?alunoTab=dieta')
      const form=page.locator('.student-questionnaire-center')
      await form.getByRole('button',{name:'Concluir questionário',exact:true}).click()
      await form.locator('.has-error').waitFor()
      await form.getByRole('button',{name:/Outra/}).click()
      await form.getByLabel(/^Especifique$/i).fill('Alergia QA')
      await form.getByLabel(/^Observação opcional$/i).fill('Observação preservada')
      await form.getByRole('button',{name:'Questionário QA 2',exact:true}).click()
      assert.equal(await form.getByLabel(/^Especifique$/i).count(),0)
      await form.getByRole('button',{name:'Questionário QA 1',exact:true}).click()
      assert.equal(await form.getByLabel(/^Especifique$/i).inputValue(),'Alergia QA')
      await page.reload()
      assert.equal(await form.getByLabel(/^Observação opcional$/i).inputValue(),'Observação preservada')
      await page.evaluate(()=>window.qaFailSubmit=true)
      await form.getByRole('button',{name:'Concluir questionário',exact:true}).click()
      await form.getByText('Falha de conexão de teste',{exact:true}).waitFor()
      await page.evaluate(()=>window.qaFailSubmit=false)
      await form.getByRole('button',{name:'Concluir questionário',exact:true}).click()
      await form.getByRole('button',{name:'Questionário respondido',exact:true}).waitFor()
      const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('qa-forms'))[0])
      assert.equal(saved.answers.q1.otherText,'Alergia QA')
      assert.equal(saved.answers.q1.observation,'Observação preservada')
      await page.locator('.student-xp-gain').getByText('+60 XP', { exact: true }).waitFor()
      await page.goto(base+'qa-student?alunoTab=treino')
      await page.getByRole('button',{name:'Ver treino',exact:true}).first().click()
      await page.getByText('Modo de visualização',{exact:true}).waitFor()
      await page.getByRole('button',{name:'Iniciar treino',exact:true}).click()
      await page.getByRole('button',{name:'Finalizar treino',exact:true}).click()
      await page.getByText('Conclua ao menos uma série antes de finalizar o treino.',{exact:true}).waitFor()
      await page.getByLabel('Carga (kg)',{exact:true}).first().fill('25')
      await page.getByLabel('Repetições',{exact:true}).first().fill('10')
      await page.getByRole('button',{name:'Concluir série',exact:true}).first().click()
      await page.reload()
      assert.equal(await page.getByRole('button',{name:'✓ Série concluída',exact:true}).count(),1)
      await page.getByLabel('Repetições',{exact:true}).nth(1).fill('9')
      await page.getByRole('button',{name:'Concluir série',exact:true}).first().click()
      await page.getByRole('button',{name:'Concluir exercício e ir para o próximo →',exact:true}).click()
      await page.getByLabel('Repetições',{exact:true}).fill('12')
      await page.getByRole('button',{name:'Concluir série',exact:true}).click()
      await page.getByRole('button',{name:'Finalizar treino',exact:true}).click()
      await page.getByText('Treino concluído',{exact:true}).first().waitFor()
      await page.locator('.student-xp-gain').getByText('+80 XP', { exact: true }).waitFor()
      await page.reload()
      await page.getByText('Treino concluído',{exact:true}).first().waitFor()
      assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('qa-logs')).length),1)
      await page.goto(base+'qa-student?alunoTab=inicio')
      await page.getByText(/140 XP acumulados/).waitFor()
      assert.equal(await page.locator('.student-xp-gain').count(), 0, 'Refresh não deve anunciar nova recompensa')
      await page.getByText('Histórico de XP', { exact: true }).click()
      await page.locator('.student-reward-ranking-card details').getByText(/Questionário QA 1/).first().waitFor()
      await page.goto(base+'qa-student?alunoTab=treino')
      await page.getByRole('button',{name:'Ativar modo escuro',exact:true}).click()
      assert.equal(await page.locator('.student-mobile-shell').getAttribute('data-theme'),'dark')
      await page.screenshot({path:resolve(output,'student-completed-dark-'+width+'.png'),fullPage:true})
      await page.goto(base+'qa-student?alunoTab=historico')
      assert.equal(await page.getByText('PRIVATE_OTHER_STUDENT',{exact:true}).count(),0)
      assert.deepEqual(errors,[])
      results.push('actions '+width+': questionnaire validation/failure/Other/observation/switch/reload; workout sets/refresh/complete; dark theme; isolation')
    }
    for (const route of ['login?mode=signin','privacidade','termos']) {
      await page.evaluate(()=>localStorage.removeItem('fitcoach-ai-pro-v2'))
      errors=[]
      await page.goto(base+route)
      await page.waitForTimeout(200)
      if(errors.length) problems.push({width,route,errors:[...errors]})
      results.push(`public ${width} ${route}`)
    }
    await context.close()
  }
  writeFileSync(resolve(output,'results.json'), JSON.stringify({results,problems},null,2))
  console.log(JSON.stringify({checks:results.length,problems},null,2))
  assert.equal(problems.length,0,'Todas as telas principais devem renderizar sem exceções ou overflow')
} finally { await browser.close(); await server.close() }

import assert from 'node:assert/strict'
import { createServer } from 'vite'

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright')
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
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_EXECUTABLE_PATH })

try {
  for (const width of [390, 1440]) {
    for (const profile of [
      { role: 'Coach principal', audience: 'alunos', newLabel: 'Nova Importada' },
      { role: 'Nutricionista', audience: 'pacientes', newLabel: 'Nova Paciente' },
    ]) {
      const context = await browser.newContext({ viewport: { width, height: 900 } })
      await context.route('**/*', (route) => (
        new URL(route.request().url()).hostname === '127.0.0.1'
          ? route.continue()
          : route.fulfill({ status: 204, body: '' })
      ))
      const page = await context.newPage()
      const errors = []
      page.on('pageerror', (error) => errors.push(error.message))
      await page.addInitScript(({ role }) => {
        localStorage.setItem('fitcoach-ai-pro-v2', JSON.stringify({
          user: { id: 'qa-professional', name: 'Profissional QA', email: 'qa@example.test', role },
          students: [{
            id: 'existing-student',
            name: 'Cadastro Existente',
            email: 'existing@example.com',
            cpf: '',
            plan: 'Acompanhamento mensal',
            phase: 'Ativo',
            status: 'Em dia',
            payment: 'Pendente',
            adherence: 0,
            risk: 'Baixo',
          }],
          workouts: [],
        }))
      }, profile)

      await page.goto(`${server.resolvedUrls.local[0]}?area=alunos`)
      await page.getByRole('button', { name: 'Importar planilha', exact: true }).click()
      const dialog = page.getByRole('dialog', { name: `Importar ${profile.audience}` })
      await dialog.waitFor()
      await dialog.getByLabel('Colar dados da planilha').fill([
        'nome,email,telefone,cpf,objetivo,plano',
        'Cadastro Existente,existing@example.com,11999999999,,Manutenção,Acompanhamento mensal',
        `${profile.newLabel},nova@example.com,11988888888,12345678901,Condicionamento,Acompanhamento mensal`,
        'Sem email,,11977777777,,Saúde,Acompanhamento mensal',
      ].join('\n'))
      await dialog.getByRole('button', { name: 'Revisar importação', exact: true }).click()
      await dialog.getByText('1 prontos', { exact: true }).waitFor()
      await dialog.getByText('1 duplicados', { exact: true }).waitFor()
      await dialog.getByText('1 para corrigir', { exact: true }).waitFor()
      await dialog.getByRole('button', { name: 'Importar 1 válidos', exact: true }).click()
      await dialog.getByText('Importação concluída', { exact: true }).waitFor()
      await dialog.getByText(`1 ${profile.audience} importados e 0 não importados.`, { exact: true }).waitFor()
      await dialog.getByRole('button', { name: 'Concluir', exact: true }).click()
      await page.getByRole('button', { name: new RegExp(profile.newLabel) }).first().waitFor()

      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false)
      assert.deepEqual(errors, [])
      console.log(`PASS ${width}px ${profile.audience}: preview, duplicates, import and responsive layout`)
      await context.close()
    }
  }
} finally {
  await browser.close()
  await server.close()
}

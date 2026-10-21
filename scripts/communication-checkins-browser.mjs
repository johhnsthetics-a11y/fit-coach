import assert from 'node:assert/strict'
import { createServer, transformWithEsbuild } from 'vite'

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright')
const fixture = `
import React from 'react';
import { createRoot } from 'react-dom/client';
import * as AppModule from '/src/App.jsx';
import '/src/index.css';
const Missing = () => <p>Componente indisponível</p>;
const Checkins = AppModule.Checkins || Missing;
const IncomingMessageToast = AppModule.IncomingMessageToast || Missing;
const photo = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="320" height="240"><rect width="100%" height="100%" fill="#0f766e"/><text x="20" y="125" fill="white" font-size="24">Check-in</text></svg>');
function Harness() {
  const [reviewed, setReviewed] = React.useState('');
  const [alert, setAlert] = React.useState({ id: 'message-1', studentId: 'patient-1', title: 'Nova mensagem de Marina', body: 'Minha digestão melhorou.' });
  const [opened, setOpened] = React.useState('');
  return <div className="app-shell coach-auth-shell app-theme-dark min-h-screen bg-zinc-950 p-4 text-white">
    <Checkins
      nutritionist
      students={[{ id: 'patient-1', name: 'Marina Costa' }]}
      checkins={[{ id: 'checkin-1', studentId: 'patient-1', type: 'Semanal', due: 'Hoje', state: 'Pendente', weight: '62 kg', note: 'Boa evolução.', createdAt: '2026-10-21T12:00:00Z', photo }]}
      onReviewCheckin={async id => setReviewed(id)}
    />
    <output data-testid="reviewed">{reviewed}</output>
    {alert ? <IncomingMessageToast alert={alert} onOpen={id => { setOpened(id); setAlert(null); }} onDismiss={() => setAlert(null)} /> : null}
    <output data-testid="opened">{opened}</output>
  </div>;
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
    name: 'communication-checkins-qa',
    resolveId(id) {
      if (id === '/communication-checkins-fixture.jsx') return '\0communication-checkins-fixture.jsx'
    },
    async load(id) {
      if (id === '\0communication-checkins-fixture.jsx') {
        return transformWithEsbuild(fixture, 'communication-checkins-fixture.jsx', { loader: 'jsx', jsx: 'transform' })
      }
    },
    configureServer(viteServer) {
      viteServer.middlewares.use('/qa-communication-checkins', async (_request, response) => {
        response.setHeader('Content-Type', 'text/html')
        response.end(await viteServer.transformIndexHtml('/qa-communication-checkins', '<div id="root"></div><script type="module" src="/communication-checkins-fixture.jsx"></script>'))
      })
    },
  }],
  server: { host: '127.0.0.1', port: 0, hmr: false },
})

await server.listen()
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_EXECUTABLE_PATH })
const base = server.resolvedUrls.local[0]

try {
  for (const width of [390, 1440]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } })
    const errors = []
    page.on('pageerror', (error) => errors.push(error.message))
    await page.goto(`${base}qa-communication-checkins`)

    await page.getByText('Check-ins recebidos', { exact: true }).waitFor()
    assert.equal(await page.getByText('Novo check-in', { exact: true }).count(), 0)
    await page.getByRole('button', { name: 'Ampliar foto do check-in de Marina Costa' }).click()
    await page.getByRole('dialog', { name: 'Foto do check-in de Marina Costa' }).waitFor()
    await page.getByRole('button', { name: 'Fechar foto' }).click()
    await page.getByRole('button', { name: 'Marcar como revisado' }).click()
    assert.equal(await page.getByTestId('reviewed').textContent(), 'checkin-1')
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false)

    await page.getByRole('button', { name: /Nova mensagem de Marina/ }).click()
    assert.equal(await page.getByTestId('opened').textContent(), 'patient-1')
    assert.deepEqual(errors, [])
    await page.close()
  }

  const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
  await page.goto(`${base}qa-communication-checkins`)
  await page.getByRole('button', { name: /Nova mensagem de Marina/ }).waitFor()
  await page.waitForTimeout(3200)
  assert.equal(await page.getByRole('button', { name: /Nova mensagem de Marina/ }).count(), 0)
  await page.close()
} finally {
  await browser.close()
  await server.close()
}

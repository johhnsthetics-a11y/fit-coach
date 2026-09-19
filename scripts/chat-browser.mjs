import assert from 'node:assert/strict'
import { mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { createServer, transformWithEsbuild } from 'vite'

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright')
const output = resolve('__qa-output/readiness-chat')
mkdirSync(output, { recursive: true })
const studentFixture = `import React from 'react'; import {createRoot} from 'react-dom/client';
import {StudentMobileApp} from '/src/App.jsx'; import '/src/index.css';
import {installChatEnhancements} from '/chatEnhancements.js';
import {installChatWallpaperEnhancements} from '/chatWallpaperEnhancements.js';
import {installChatAudioEnhancements} from '/chatAudioEnhancements.js';
import '/chat-enhancements.css'; import '/chat-wallpaper.css'; import '/chat-wallpaper-theme.css'; import '/chat-audio.css';
function Harness(){
 const [messages,setMessages]=React.useState([]);
 return <StudentMobileApp student={{id:'qa-student',name:'Aluno QA',payment:'Pago'}} coachId="qa-coach"
 checkins={[]} workouts={[]} nutritionPlans={[]} workoutLogs={[]} messages={messages} appointments={[]} invoices={[]} assessments={[]}
 onSendMessage={async message=>{
  await new Promise(resolve=>setTimeout(resolve,150));
  if(window.qaFailSend) throw new Error('Falha de conexão de teste');
  const saved={...message,id:crypto.randomUUID(),createdAt:new Date().toISOString(),deliveryState:'sent'};
  setMessages(current=>[...current,saved]); return saved;
 }} />;
}
createRoot(document.getElementById('root')).render(<Harness/>);
installChatEnhancements(); installChatWallpaperEnhancements(); installChatAudioEnhancements();`
const server = await createServer({ mode: 'test', envFile: false,
  define: { 'import.meta.env.VITE_SUPABASE_URL': 'undefined', 'import.meta.env.VITE_SUPABASE_ANON_KEY': 'undefined' },
  plugins: [{ name: 'student-chat-test',
    resolveId(id) { if (id === '/qa-chat.jsx') return '\0qa-chat.jsx' },
    async load(id) { if (id === '\0qa-chat.jsx') return await transformWithEsbuild(studentFixture, 'qa-chat.jsx', { loader: 'jsx', jsx: 'transform' }) },
    configureServer(server) { server.middlewares.use('/qa-student-chat', async (_req, res) => {
      res.setHeader('Content-Type', 'text/html');
      res.end(await server.transformIndexHtml('/qa-student-chat', '<div id="root"></div><script type="module" src="/qa-chat.jsx"></script>'))
    }) },
  }],
  server: { host: '127.0.0.1', port: 0, hmr: false },
})
await server.listen()
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_EXECUTABLE_PATH,
  args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'],
})
try {
  for (const width of [390, 1440]) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, permissions: ['microphone'] })
    await context.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.fulfill({ status: 204, body: '' }))
    const page = await context.newPage()
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    await page.addInitScript(() => {
      if (localStorage.getItem('qa-seeded')) return
      localStorage.setItem('qa-seeded', 'true')
      localStorage.setItem('fitcoach-ai-pro-v2', JSON.stringify({ user: { id: 'qa-coach', name: 'QA' }, students: [
        { id: 'qa-a', name: 'Pessoa A', payment: 'Pago' }, { id: 'qa-b', name: 'Pessoa B', payment: 'Pago' },
      ], messages: [] }))
    })
    await page.goto(server.resolvedUrls.local[0] + '?area=mensagens')
    if (width < 761) await page.getByRole('button', { name: /Pessoa A/ }).first().click()
    const composer = page.locator('form').filter({ has: page.getByPlaceholder('Escreva a mensagem para o aluno...') })
    await composer.waitFor()
    const draft = composer.locator('textarea')
    await draft.fill('Mensagem QA de texto')
    await composer.locator('button[type="submit"]').click()
    await page.waitForFunction(() => JSON.parse(localStorage.getItem('fitcoach-ai-pro-v2')).messages.some(item => item.body === 'Mensagem QA de texto'))
    await page.reload()
    if (width < 761) await page.getByRole('button', { name: /Pessoa A/ }).first().click()
    await page.getByText('Mensagem QA de texto', { exact: true }).last().waitFor()
    await composer.locator('input[type="file"]').setInputFiles({ name: 'pixel.png', mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6lGQAAAAASUVORK5CYII=', 'base64') })
    await composer.getByAltText('Prévia da foto').waitFor()
    await composer.locator('button[type="submit"]').click()
    await page.waitForFunction(() => JSON.parse(localStorage.getItem('fitcoach-ai-pro-v2')).messages.some(item => item.attachmentType === 'image/png'))
    const record = composer.getByRole('button', { name: 'Gravar áudio', exact: true })
    await record.click()
    await composer.locator('[aria-pressed="true"]').waitFor()
    await page.waitForTimeout(1200)
    await composer.locator('[aria-pressed="true"]').click()
    await composer.locator('audio').waitFor()
    await composer.locator('button[type="submit"]').click()
    await page.waitForFunction(() => JSON.parse(localStorage.getItem('fitcoach-ai-pro-v2')).messages.some(item => item.attachmentType?.startsWith('audio/')))
    assert.equal(await draft.inputValue(), '')
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false)
    await page.screenshot({ path: resolve(output, `messages-${width}.png`) })
    const customize = page.getByRole('button', { name: 'Abrir personalização do chat', exact: true })
    await customize.click()
    await page.screenshot({ path: resolve(output, `chat-${width}.png`) })
    assert.deepEqual(errors, [])
    console.log(`PASS chat ${width}px: texto/refresh, imagem, gravar/finalizar/enviar audio, personalizacao, overflow`)
    await page.goto(server.resolvedUrls.local[0] + 'qa-student-chat?alunoTab=mensagens')
    await page.waitForTimeout(500)
    await page.screenshot({ path: resolve(output, `student-chat-entry-${width}.png`) })
    assert.deepEqual(errors, [], 'Entrada do chat do aluno deve renderizar sem excecoes')
    const studentComposer = page.locator('form').filter({ has: page.getByPlaceholder('Responder ao coach...') })
    const studentDraft = studentComposer.locator('textarea')
    await studentDraft.fill('Mensagem preservada para reenvio')
    await page.evaluate(() => { window.qaFailSend = true })
    await studentComposer.locator('button[type="submit"]').click()
    await page.getByText('Falha de conexão de teste', { exact: true }).waitFor()
    assert.equal(await studentDraft.inputValue(), 'Mensagem preservada para reenvio')
    await page.evaluate(() => { window.qaFailSend = false })
    await studentComposer.locator('button[type="submit"]').click()
    await page.getByText('Mensagem preservada para reenvio', { exact: true }).waitFor()
    assert.equal(await studentDraft.inputValue(), '')
    assert.equal(await page.getByText('Mensagem preservada para reenvio', { exact: true }).count(), 1)
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false)
    const composerBox = await studentComposer.boundingBox()
    const navBox = await page.locator('.student-bottom-nav').boundingBox()
    assert.ok(composerBox && composerBox.y >= 0 && composerBox.y + composerBox.height <= (navBox?.y ?? 900) + 1, 'Composer do aluno deve ficar dentro da viewport, acima da navegacao')
    const chatBox = await page.locator('.student-chat-screen').boundingBox()
    if (navBox) assert.ok(navBox.y - (chatBox.y + chatBox.height) <= 16, 'Chat deve aproveitar a altura disponivel sem espaco reservado duplicado para a navbar')
    await page.setViewportSize({ width, height: 560 })
    await page.waitForTimeout(200)
    const compactComposer = await studentComposer.boundingBox()
    const compactNav = await page.locator('.student-bottom-nav').boundingBox()
    assert.ok(compactComposer && compactComposer.y >= 0 && compactComposer.y + compactComposer.height <= (compactNav?.y ?? 560) + 1, 'Composer deve continuar acessivel com altura reduzida')
    await page.setViewportSize({ width, height: 900 })
    await page.waitForTimeout(200)
    await page.screenshot({ path: resolve(output, `student-chat-${width}.png`) })
    assert.deepEqual(errors, [])
    console.log(`PASS aluno ${width}px: falha de envio, rascunho preservado, reenvio unico, overflow`)
    await context.close()
  }
} finally { await browser.close(); await server.close() }

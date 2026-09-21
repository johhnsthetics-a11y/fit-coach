import assert from 'node:assert/strict'
import { mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { createServer, transformWithEsbuild } from 'vite'

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright')
const output = resolve('__qa-output/readiness-chat')
mkdirSync(output, { recursive: true })
const viewports = (process.env.CHAT_BROWSER_WIDTHS || '320,360,375,390,414,768,1440')
  .split(',')
  .map(Number)
  .filter((value) => Number.isFinite(value) && value > 0)
const longContactName = 'Pessoa com nome profissional muito extenso para validar truncamento responsivo'
const studentFixture = `import React from 'react'; import {createRoot} from 'react-dom/client';
import {StudentMobileApp} from '/src/App.jsx'; import '/src/index.css'; import '/src/chat/chat.css';
import {installChatWallpaperEnhancements} from '/chatWallpaperEnhancements.js';
import '/chat-wallpaper.css'; import '/chat-wallpaper-theme.css';
function Harness(){
 const [messages,setMessages]=React.useState(()=>{
  const history=Array.from({length:120},(_,index)=>({
   id:'history-'+index,studentId:'qa-student',sender:index%4<2?'coach':'student',
   body:index===112?'TOKEN_'+('X'.repeat(300)):index===113?'Treino concluído com energia 💪🏽🔥':'Mensagem de histórico '+(index+1),
   createdAt:new Date(Date.now()-(index<60?86400000:0)-(120-index)*60000).toISOString(),deliveryState:'sent'
  }));
  return [...history,
   {id:'seed-deleted',studentId:'qa-student',sender:'coach',body:'conteúdo removido',deletedAt:new Date().toISOString(),createdAt:new Date(Date.now()-50000).toISOString(),deliveryState:'sent'},
   {id:'seed-sending',studentId:'qa-student',sender:'student',body:'Mensagem sincronizando',createdAt:new Date(Date.now()-40000).toISOString(),deliveryState:'sending'},
   {id:'seed-failed',studentId:'qa-student',sender:'student',body:'Mensagem com falha preservada',createdAt:new Date(Date.now()-30000).toISOString(),deliveryState:'failed'},
   {id:'seed-image',studentId:'qa-student',sender:'coach',body:'Imagem do plano',attachmentUrl:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6lGQAAAAASUVORK5CYII=',attachmentType:'image/png',attachmentName:'plano.png',createdAt:new Date(Date.now()-20000).toISOString(),deliveryState:'sent'},
   {id:'seed-audio',studentId:'qa-student',sender:'coach',body:'Orientação em áudio',attachmentUrl:'data:audio/webm;base64,GkXf',attachmentType:'audio/webm',attachmentName:'audio-fitcoach-qa.webm',createdAt:new Date(Date.now()-10000).toISOString(),deliveryState:'sent'},
  ];
 });
 React.useEffect(()=>{ window.qaAppendMessage=(message)=>setMessages(current=>[...current,message]); return ()=>{ delete window.qaAppendMessage } },[]);
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
installChatWallpaperEnhancements();`
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
  for (const width of viewports) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, permissions: ['microphone'] })
    await context.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.fulfill({ status: 204, body: '' }))
    const page = await context.newPage()
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()) })
    await page.addInitScript((contactName) => {
      if (localStorage.getItem('qa-seeded')) return
      localStorage.setItem('qa-seeded', 'true')
      localStorage.setItem('fitcoach-ai-pro-v2', JSON.stringify({ user: { id: 'qa-coach', name: 'QA' }, students: [
        { id: 'student-a', name: 'Pessoa A', payment: 'Pago' },
        { id: 'student-b', name: contactName, payment: 'Pago' },
        { id: 'student-empty', name: 'Aluno sem histórico', payment: 'Pago' },
      ], messages: [
        { id: 'coach-seed-a', studentId: 'student-a', sender: 'coach', body: 'Mensagem anterior', createdAt: new Date(Date.now() - 7200000).toISOString(), read: true },
        { id: 'student-seed-b', studentId: 'student-b', sender: 'student', body: 'Mensagem mais recente', createdAt: new Date().toISOString(), read: false },
      ] }))
    }, longContactName)
    if (process.env.CHAT_BROWSER_SCOPE !== 'student') {
      await page.goto(server.resolvedUrls.local[0] + '?area=mensagens')
      const rows = page.locator('[data-conversation-id]')
      try {
        await rows.first().waitFor({ state: 'visible', timeout: 15000 })
      } catch (error) {
        const diagnostic = await page.evaluate(() => ({
          body: document.body?.innerText?.slice(0, 1200) || '',
          stored: window.localStorage.getItem('fitcoach-ai-pro-v2'),
          url: window.location.href,
        }))
        throw new Error(`Chat do treinador não abriu em ${width}px. ${JSON.stringify({ ...diagnostic, errors })}`, { cause: error })
      }
      assert.equal(await rows.nth(0).getAttribute('data-conversation-id'), 'student-b')
      assert.equal(await rows.nth(0).getByText('Mensagem mais recente').isVisible(), true)
      assert.equal(await rows.count(), 3)
      assert.equal(await page.locator('[data-conversation-id="student-b"] strong').textContent(), longContactName)
      await page.locator('[data-conversation-id="student-empty"]').click()
      await page.getByText('Inicie a conversa', { exact: true }).waitFor()
      if (width < 761) await page.getByRole('button', { name: 'Voltar' }).click()
      await page.locator('[data-conversation-id="student-b"]').click()
      assert.equal(await page.locator('[data-chat-role="coach"]').isVisible(), true)
      if (width < 761) assert.equal(await page.getByRole('button', { name: 'Voltar' }).isVisible(), true)
      if (width >= 761) assert.equal(await rows.nth(0).isVisible(), true)
      const composer = page.locator('[data-chat-role="coach"] .chat-compose')
      await composer.waitFor()
      const draft = composer.locator('textarea')
      await draft.fill('Mensagem QA de texto')
      await composer.locator('button[type="submit"]').click()
      await page.waitForFunction(() => JSON.parse(localStorage.getItem('fitcoach-ai-pro-v2')).messages.some(item => item.body === 'Mensagem QA de texto'))
      for (const body of ['Mensagem rápida 1', 'Mensagem rápida 2', 'Mensagem rápida 3']) {
        await draft.fill(body)
        await composer.locator('button[type="submit"]').click()
        await page.getByText(body, { exact: true }).last().waitFor()
      }
      await draft.fill('Rascunho preservado após recarregar')
      await page.reload()
      await page.locator('[data-conversation-id="student-b"]').click()
      await page.getByText('Mensagem QA de texto', { exact: true }).last().waitFor()
      assert.equal(await draft.inputValue(), 'Rascunho preservado após recarregar')
      await draft.fill('')
      await composer.locator('input[type="file"]').setInputFiles({ name: 'pixel.png', mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6lGQAAAAASUVORK5CYII=', 'base64') })
      await composer.getByAltText('Prévia da imagem selecionada').waitFor()
      if (width < 761) {
        await page.getByRole('button', { name: 'Voltar' }).click()
        await page.locator('[data-conversation-id="student-a"]').click()
        await page.getByRole('button', { name: 'Voltar' }).click()
        await page.locator('[data-conversation-id="student-b"]').click()
      } else {
        await page.locator('[data-conversation-id="student-a"]').click()
        await page.locator('[data-conversation-id="student-b"]').click()
      }
      await composer.getByAltText('Prévia da imagem selecionada').waitFor()
      await composer.locator('button[type="submit"]').click()
      await page.waitForFunction(() => JSON.parse(localStorage.getItem('fitcoach-ai-pro-v2')).messages.some(item => item.attachmentType === 'image/png'))
      assert.match(await page.locator('[data-chat-role="coach"] .chat-image-attachment').last().getAttribute('href'), /^(blob:|data:image\/)/)
      const record = composer.getByRole('button', { name: 'Gravar áudio', exact: true })
      await record.click()
      await page.waitForTimeout(300)
      await composer.getByRole('button', { name: 'Cancelar gravação' }).click()
      assert.equal(await composer.locator('.chat-attachment-preview').count(), 0)
      await record.click()
      await page.waitForTimeout(1200)
      const recordingStatus = composer.getByRole('status', { name: 'Gravação de áudio em andamento' })
      assert.equal(await recordingStatus.isVisible(), true, `Gravador deve iniciar: ${await composer.innerText()}`)
      await page.waitForTimeout(1200)
      await composer.getByRole('button', { name: 'Finalizar gravação' }).click()
      await composer.locator('.chat-audio-message').waitFor()
      await composer.locator('button[type="submit"]').click()
      await page.waitForFunction(() => JSON.parse(localStorage.getItem('fitcoach-ai-pro-v2')).messages.some(item => item.attachmentType?.startsWith('audio/')))
      assert.equal(await draft.inputValue(), '')
      await page.emulateMedia({ reducedMotion: 'reduce' })
      await page.evaluate(() => {
        document.documentElement.dataset.theme = 'dark'
        document.querySelector('.coach-auth-shell')?.classList.replace('app-theme-light', 'app-theme-dark')
      })
      assert.match(await page.locator('[data-chat-role="coach"]').evaluate(element => getComputedStyle(element).color), /rgb\(/)
      const headerContrast = await page.locator('[data-chat-role="coach"] .chat-contact-copy h2').evaluate((element) => {
        const parse = (value) => (value.match(/[\d.]+/g) || []).slice(0, 3).map(Number)
        const luminance = (rgb) => rgb.map((value) => {
          const channel = value / 255
          return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
        }).reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0)
        const foregroundColor = getComputedStyle(element).color
        const backgroundColor = getComputedStyle(element.closest('.chat-header')).backgroundColor
        const foreground = luminance(parse(foregroundColor))
        const background = luminance(parse(backgroundColor))
        return { foregroundColor, backgroundColor, ratio: (Math.max(foreground, background) + 0.05) / (Math.min(foreground, background) + 0.05) }
      })
      assert.ok(headerContrast.ratio >= 4.5, `Cabeçalho escuro precisa de contraste AA: ${JSON.stringify(headerContrast)}`)
      assert.equal(await composer.getByLabel('Anexar foto ou áudio').isVisible(), true)
      assert.equal(await composer.getByRole('button', { name: 'Gravar áudio', exact: true }).isVisible(), true)
      await draft.focus()
      await page.keyboard.press('Tab')
      assert.equal(await page.evaluate(() => document.activeElement?.getAttribute('aria-label')), 'Gravar áudio')
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false)
      await page.screenshot({ path: resolve(output, `messages-${width}.png`) })
      if (width < 761) {
        const conversationHeaderBox = await page.locator('[data-chat-role="coach"] .chat-header').boundingBox()
        const appHeaderBox = await page.locator('.coach-mobile-header').boundingBox()
        const appNavBox = await page.locator('.coach-mobile-bottom-nav').boundingBox()
        const coachComposerBox = await composer.boundingBox()
        const coachConversationBox = await page.locator('[data-chat-role="coach"]').boundingBox()
        assert.ok(conversationHeaderBox && appHeaderBox && conversationHeaderBox.y >= appHeaderBox.y + appHeaderBox.height - 1, `Cabeçalho da conversa deve permanecer abaixo do cabeçalho do app: ${JSON.stringify({ conversationHeaderBox, appHeaderBox })}`)
        assert.ok(coachComposerBox && appNavBox && coachComposerBox.y + coachComposerBox.height <= appNavBox.y + 1, 'Composer do treinador deve permanecer acima da navegação do app')
        assert.ok(coachConversationBox && appHeaderBox && appNavBox && coachConversationBox.height >= appNavBox.y - (appHeaderBox.y + appHeaderBox.height) - 40, `Conversa deve ocupar a altura útil: ${JSON.stringify({ coachConversationBox, appHeaderBox, appNavBox })}`)
        if (width <= 360) {
          const avatarBox = await page.locator('[data-chat-role="coach"] .chat-contact-avatar').boundingBox()
          const copyBox = await page.locator('[data-chat-role="coach"] .chat-contact-copy').boundingBox()
          const personalizationBox = await page.getByRole('button', { name: 'Abrir personalização do chat', exact: true }).boundingBox()
          assert.ok(avatarBox?.width >= 40 && copyBox?.width >= 72 && personalizationBox?.width <= 52, `Cabeçalho estreito deve preservar avatar/nome e compactar personalização: ${JSON.stringify({ avatarBox, copyBox, personalizationBox })}`)
        }
        await page.setViewportSize({ width, height: 560 })
        await page.waitForTimeout(120)
        const visualHeight = await page.evaluate(() => parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--chat-pro-visual-height')))
        assert.ok(visualHeight > 0 && visualHeight <= 560, `Altura visual deve acompanhar teclado/viewport: ${visualHeight}`)
        const compactCoachComposer = await composer.boundingBox()
        assert.ok(compactCoachComposer && compactCoachComposer.y >= 0 && compactCoachComposer.y + compactCoachComposer.height <= 561)
        await page.setViewportSize({ width, height: 900 })
      }
      const customize = page.getByRole('button', { name: 'Abrir personalização do chat', exact: true })
      await customize.click()
      await page.screenshot({ path: resolve(output, `chat-${width}.png`) })
      assert.deepEqual(errors, [])
      console.log(`PASS chat ${width}px: vazio/nome longo, texto rápido/rascunho, imagem, cancelar/enviar áudio, tema, personalização, overflow`)
    }
    await page.goto(server.resolvedUrls.local[0] + 'qa-student-chat?alunoTab=mensagens')
    await page.waitForTimeout(500)
    await page.screenshot({ path: resolve(output, `student-chat-entry-${width}.png`) })
    assert.deepEqual(errors, [], 'Entrada do chat do aluno deve renderizar sem excecoes')
    assert.equal(await page.locator('[data-chat-role="student"]').isVisible(), true)
    assert.equal(await page.getByRole('heading', { name: 'Seu treinador' }).isVisible(), true)
    assert.equal(await page.getByRole('button', { name: 'Voltar' }).isVisible(), true)
    assert.equal(await page.locator('.chat-compose').isVisible(), true)
    assert.equal(await page.locator('audio[controls]').count(), 0)
    assert.ok(await page.locator('.chat-message-bubble').count() >= 125, 'Histórico grande deve permanecer disponível')
    const regularBubbleHeight = await page.getByText('Mensagem de histórico 1', { exact: true }).locator('..').evaluate(element => element.getBoundingClientRect().height)
    assert.ok(regularBubbleHeight >= 40, `Bolhas não podem encolher no histórico longo: ${regularBubbleHeight}`)
    assert.ok(await page.locator('.chat-date-separator').count() >= 2)
    assert.ok(await page.locator('.chat-message-bubble:not(.chat-group-first)').count() >= 1, 'Mensagens consecutivas devem formar grupo visual')
    assert.equal(await page.getByText('Mensagem apagada', { exact: true }).isVisible(), true)
    assert.equal(await page.getByText('Enviando', { exact: true }).isVisible(), true)
    assert.equal(await page.getByText('Falha no envio', { exact: true }).isVisible(), true)
    assert.equal(await page.locator('.chat-image-attachment').count(), 1)
    assert.equal(await page.locator('.chat-audio-message').count(), 1)
    assert.equal(await page.getByText(/TOKEN_X{40}/).isVisible(), true)
    const messageList = page.locator('.chat-message-list')
    await messageList.evaluate(element => { element.scrollTop = 0; element.dispatchEvent(new Event('scroll')) })
    await page.waitForTimeout(80)
    await page.evaluate(() => window.qaAppendMessage({ id: 'unseen-message', studentId: 'qa-student', sender: 'coach', body: 'Nova orientação recebida', createdAt: new Date().toISOString(), deliveryState: 'sent' }))
    const unseenButton = page.getByRole('button', { name: /Ir para 1 nova mensagem/ })
    await unseenButton.waitFor()
    await unseenButton.click()
    await page.getByText('Nova orientação recebida', { exact: true }).waitFor()
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
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.evaluate(() => {
      document.documentElement.dataset.theme = 'dark'
      document.querySelector('.student-mobile-shell')?.classList.replace('app-theme-light', 'app-theme-dark')
    })
    assert.equal(await page.locator('.chat-message-bubble').last().evaluate(element => getComputedStyle(element).animationName), 'none')
    assert.equal(await studentComposer.getByLabel('Anexar foto ou áudio').isVisible(), true)
    assert.equal(await studentComposer.getByRole('button', { name: 'Gravar áudio', exact: true }).isVisible(), true)
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false)
    const composerBox = await studentComposer.boundingBox()
    const navBox = await page.locator('.student-bottom-nav').boundingBox()
    assert.ok(composerBox && composerBox.y >= 0 && composerBox.y + composerBox.height <= 901, 'Composer do aluno deve ficar integralmente dentro da viewport imersiva')
    const chatBox = await page.locator('.student-chat-screen').boundingBox()
    if (width >= 768 && navBox) assert.ok(navBox.y - (chatBox.y + chatBox.height) <= 16, 'Chat deve aproveitar a altura disponivel sem espaco reservado duplicado para a navbar')
    await page.setViewportSize({ width, height: 560 })
    await page.waitForTimeout(200)
    const compactComposer = await studentComposer.boundingBox()
    assert.ok(compactComposer && compactComposer.y >= 0 && compactComposer.y + compactComposer.height <= 561, 'Composer deve continuar acessivel com altura reduzida')
    const compactVisualHeight = await page.evaluate(() => parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--chat-pro-visual-height')))
    assert.ok(compactVisualHeight > 0 && compactVisualHeight <= 560, `Viewport visual do aluno deve ser atualizada: ${compactVisualHeight}`)
    if (width < 768) {
      await page.evaluate(() => document.documentElement.style.setProperty('--chat-pro-visual-offset-top', '32px'))
      await page.waitForTimeout(60)
      const shiftedChatBox = await page.locator('[data-chat-role="student"]').boundingBox()
      assert.ok(shiftedChatBox && Math.abs(shiftedChatBox.y - 32) <= 1, `Chat imersivo deve acompanhar o deslocamento do teclado: ${JSON.stringify(shiftedChatBox)}`)
      await page.evaluate(() => document.documentElement.style.setProperty('--chat-pro-visual-offset-top', '0px'))
    }
    const lastMessageBox = await page.getByText('Mensagem preservada para reenvio', { exact: true }).boundingBox()
    const compactListBox = await messageList.boundingBox()
    const compactScroll = await messageList.evaluate(element => ({ scrollTop: element.scrollTop, scrollHeight: element.scrollHeight, clientHeight: element.clientHeight }))
    assert.ok(lastMessageBox && compactComposer && lastMessageBox.y + lastMessageBox.height <= compactComposer.y + 1, `Última mensagem deve poder ficar acima do composer: ${JSON.stringify({ lastMessageBox, compactComposer, compactListBox, compactScroll })}`)
    await page.setViewportSize({ width, height: 900 })
    await page.waitForTimeout(200)
    await page.screenshot({ path: resolve(output, `student-chat-${width}.png`) })
    await page.getByRole('button', { name: 'Voltar' }).click()
    assert.equal(await page.locator('[data-chat-role="student"]').count(), 0, 'Voltar deve sair da conversa e retornar ao portal do aluno')
    assert.deepEqual(errors, [])
    console.log(`PASS aluno ${width}px: 120+ mensagens, datas/grupos, estados, indicador, retry único, tema, viewport e overflow`)
    await context.close()
  }
} finally { await browser.close(); await server.close() }

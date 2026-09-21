import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'

import * as chatEnhancements from '../chatEnhancements.js'
import * as chatWallpaper from '../chatWallpaperEnhancements.js'

const {
  CHAT_COMPOSER_SELECTORS,
  isNearChatBottom,
  shouldSubmitChatOnKeydown,
} = chatEnhancements
const {
  CHAT_WALLPAPER_PRESETS,
  CHAT_WALLPAPER_STORAGE_KEY,
  isSafeWallpaperDataUrl,
  getWallpaperTargetDimensions,
  estimateWallpaperDataUrlBytes,
  loadChatWallpaperPreference,
  saveChatWallpaperPreference,
} = chatWallpaper

const indexHtml = readFileSync(new URL('../index.html', import.meta.url), 'utf8')
const productionMain = readFileSync(new URL('../src/main.jsx', import.meta.url), 'utf8')
const legacyMain = readFileSync(new URL('../main.jsx', import.meta.url), 'utf8')
const chatCss = readFileSync(new URL('../src/chat/chat.css', import.meta.url), 'utf8')
const chatSource = readFileSync(new URL('../chatEnhancements.js', import.meta.url), 'utf8')
const conversationSource = readFileSync(new URL('../src/chat/ChatConversation.jsx', import.meta.url), 'utf8')
const wallpaperSource = readFileSync(new URL('../chatWallpaperEnhancements.js', import.meta.url), 'utf8')
const wallpaperCss = readFileSync(new URL('../chat-wallpaper.css', import.meta.url), 'utf8')
const wallpaperThemeCss = readFileSync(new URL('../chat-wallpaper-theme.css', import.meta.url), 'utf8')

test('chat identifica os composers reais do coach e do aluno', () => {
  assert.equal(CHAT_COMPOSER_SELECTORS.length, 2)
  assert.ok(CHAT_COMPOSER_SELECTORS.includes('textarea[placeholder="Escreva a mensagem para o aluno..."]'))
  assert.ok(CHAT_COMPOSER_SELECTORS.includes('textarea[placeholder="Responder ao coach..."]'))
})

test('produção carrega os entrypoints de messenger e wallpaper do chat', () => {
  assert.match(indexHtml, /src\/main\.jsx/)
  assert.doesNotMatch(productionMain, /installChatEnhancements/)
  assert.match(productionMain, /installChatWallpaperEnhancements/)
  assert.doesNotMatch(productionMain, /chat-enhancements\.css/)
  assert.match(productionMain, /chat-wallpaper\.css/)
  assert.match(productionMain, /chat-wallpaper-theme\.css/)
  assert.doesNotMatch(chatSource, /decorateMessageBubbles/)
  assert.doesNotMatch(chatSource, /MutationObserver/)
  assert.doesNotMatch(legacyMain, /installChatEnhancements|chat-enhancements\.css/)
  assert.equal(existsSync(new URL('../chat-enhancements.css', import.meta.url)), false)
  assert.equal(existsSync(new URL('../chat-audio.css', import.meta.url)), false)
})

test('scroll inteligente considera o usuario perto do fim sem exigir pixel exato', () => {
  assert.equal(isNearChatBottom({ scrollHeight: 1000, scrollTop: 590, clientHeight: 320 }), true)
  assert.equal(isNearChatBottom({ scrollHeight: 1000, scrollTop: 300, clientHeight: 320 }), false)
})

test('Enter envia e Shift+Enter preserva quebra de linha', () => {
  assert.equal(shouldSubmitChatOnKeydown({ key: 'Enter', shiftKey: false, isComposing: false }), true)
  assert.equal(shouldSubmitChatOnKeydown({ key: 'Enter', shiftKey: true, isComposing: false }), false)
  assert.equal(shouldSubmitChatOnKeydown({ key: 'Enter', shiftKey: false, isComposing: true }), false)
  assert.equal(shouldSubmitChatOnKeydown({ key: 'a', shiftKey: false, isComposing: false }), false)
})

test('messenger exporta contrato semantico estavel para o layout profissional', () => {
  const classes = chatEnhancements.CHAT_MESSENGER_CLASSES
  assert.ok(classes, 'CHAT_MESSENGER_CLASSES deve existir')
  assert.deepEqual(Object.keys(classes).sort(), [
    'attachmentButton',
    'audioButton',
    'composer',
    'conversationPane',
    'conversationPanel',
    'header',
    'sendButton',
    'suggestion',
    'thread',
    'viewport',
    'workspace',
  ])
  assert.equal(classes.workspace, 'chat-pro-workspace')
  assert.equal(classes.conversationPane, 'chat-pro-conversations-pane')
  assert.equal(classes.conversationPanel, 'chat-pro-conversation-panel')
})

test('wallpaper oferece presets profissionais e chave de persistencia dedicada ao chat', () => {
  assert.equal(CHAT_WALLPAPER_STORAGE_KEY, 'coachfit.chat.wallpaper.v1')
  assert.ok(Array.isArray(CHAT_WALLPAPER_PRESETS))
  assert.ok(CHAT_WALLPAPER_PRESETS.length >= 5)
  assert.deepEqual(CHAT_WALLPAPER_PRESETS.map((preset) => preset.id).slice(0, 4), ['aurora', 'sage', 'horizon', 'texture'])
  assert.ok(CHAT_WALLPAPER_PRESETS.some((preset) => preset.id === 'solid'), 'deve oferecer opção sólida além dos gradientes')
})

test('preferencia de wallpaper persiste e normaliza preset, overlay e imagem customizada', () => {
  const state = new Map()
  const storage = {
    getItem(key) { return state.get(key) ?? null },
    setItem(key, value) { state.set(key, String(value)) },
  }

  const saved = saveChatWallpaperPreference(storage, {
    presetId: 'horizon',
    overlay: 0.42,
    customDataUrl: '',
  })
  assert.deepEqual(saved, { presetId: 'horizon', overlay: 0.42, customDataUrl: '' })
  assert.deepEqual(loadChatWallpaperPreference(storage), saved)

  const custom = saveChatWallpaperPreference(storage, {
    presetId: 'custom',
    overlay: 0.33,
    customDataUrl: 'data:image/png;base64,AAAA',
  })
  assert.equal(loadChatWallpaperPreference(storage).presetId, 'custom')
  assert.equal(custom.customDataUrl, 'data:image/png;base64,AAAA')
})

test('wallpaper customizado aceita somente data URL de imagem', () => {
  assert.equal(isSafeWallpaperDataUrl('data:image/png;base64,AAAA'), true)
  assert.equal(isSafeWallpaperDataUrl('data:image/jpeg;base64,AAAA'), true)
  assert.equal(isSafeWallpaperDataUrl('data:text/html;base64,AAAA'), false)
  assert.equal(isSafeWallpaperDataUrl('https://example.com/background.jpg'), false)
})

test('CSS do messenger cobre workspace, sugestao, composer, wallpaper e mobile', () => {
  assert.match(chatCss, /\.chat-workspace\.chat-pro-workspace\s*\{/)
  assert.match(chatCss, /\.chat-conversation-list\s*\{/)
  assert.match(chatCss, /\.chat-conversation\s*\{/)
  assert.match(chatCss, /\.chat-suggestion\s*\{/)
  assert.match(chatCss, /\.chat-record-button/)
  assert.match(chatCss, /@media \(max-width: 760px\)/)
  assert.match(wallpaperCss, /\.chat-pro-wallpaper-button/)
  assert.match(wallpaperCss, /\.chat-pro-wallpaper-modal/)
  assert.match(wallpaperCss, /data-chat-wallpaper="custom"/)
  assert.match(wallpaperThemeCss, /data-chat-wallpaper="solid"/)
  assert.match(wallpaperCss, /@media \(max-width: 760px\)/)
})

test('modal de wallpaper preserva contraste no tema escuro fora do workspace', () => {
  assert.match(wallpaperThemeCss, /html\[data-theme="dark"\] \.chat-pro-wallpaper-modal/)
  assert.match(wallpaperThemeCss, /--chat-pro-text:\s*#eef7f4/)
  assert.match(wallpaperThemeCss, /--chat-pro-surface:\s*#111816/)
})


test('wallpaper preserva a imagem personalizada ao experimentar presets e permite voltar sem reupload', () => {
  const state = new Map()
  const storage = {
    getItem(key) { return state.get(key) ?? null },
    setItem(key, value) { state.set(key, String(value)) },
  }
  const customDataUrl = 'data:image/jpeg;base64,AAAA'
  const preset = saveChatWallpaperPreference(storage, {
    presetId: 'horizon',
    overlay: 0.4,
    customDataUrl,
  })

  assert.equal(preset.presetId, 'horizon')
  assert.equal(preset.customDataUrl, customDataUrl)

  const restoredCustom = saveChatWallpaperPreference(storage, {
    ...preset,
    presetId: 'custom',
  })
  assert.equal(restoredCustom.presetId, 'custom')
  assert.equal(restoredCustom.customDataUrl, customDataUrl)
})

test('otimizacao de wallpaper calcula dimensoes proporcionais e tamanho real aproximado do data URL', () => {
  assert.deepEqual(getWallpaperTargetDimensions(4032, 3024, 1800), { width: 1800, height: 1350 })
  assert.deepEqual(getWallpaperTargetDimensions(900, 1200, 1800), { width: 900, height: 1200 })
  assert.ok(estimateWallpaperDataUrlBytes('data:image/jpeg;base64,AAAA') > 0)
})

test('modal de wallpaper oferece trocar, remover, reaproveitar imagem e compressao automatica', () => {
  assert.match(wallpaperSource, /Trocar imagem/)
  assert.match(wallpaperSource, /Remover imagem/)
  assert.match(wallpaperSource, /prepareWallpaperImage/)
  assert.match(wallpaperSource, /createImageBitmap|Image\(/)
  assert.match(wallpaperSource, /uploadInput\.value = ''/)
  assert.match(wallpaperCss, /\.chat-pro-wallpaper-remove-image/)
  assert.match(wallpaperCss, /\.chat-pro-wallpaper-custom-preview:focus-visible/)
})


test('layout mobile do chat usa uma única coluna flexível estável com visualViewport', () => {
  assert.match(chatCss, /\.coach-auth-shell \.chat-workspace\.chat-pro-workspace\.chat-pro-mobile-conversation-open[\s\S]*?height:\s*calc\(/)
  assert.match(chatCss, /\.coach-auth-shell \.chat-workspace\.chat-pro-workspace\.chat-pro-mobile-conversation-open[\s\S]*?min-height:\s*0/)
  assert.match(chatCss, /\.chat-message-list[\s\S]*?flex:\s*1 1 0/)
  assert.match(chatCss, /\.chat-message-list[\s\S]*?min-height:\s*0/)
  assert.match(chatCss, /\.chat-compose[\s\S]*?flex:\s*0 0 auto/)
  assert.match(conversationSource, /visualViewport/)
})

test('chat do aluno recebe shell dedicado para a mesma responsividade do coach', () => {
  assert.match(conversationSource, /chat-pro-student-shell/)
  assert.match(conversationSource, /chat-conversation-immersive/)
  assert.match(chatCss, /\.student-mobile-shell \.chat-conversation\.chat-conversation-immersive/)
})

test('controle de wallpaper não ocupa espaço do histórico de mensagens', () => {
  assert.match(wallpaperSource, /chat-pro-header/)
  assert.match(wallpaperSource, /chat-pro-wallpaper-toolbar-in-header/)
  assert.match(wallpaperCss, /\.chat-pro-wallpaper-toolbar-in-header/)
})

test('wallpaper customizado não usa background-attachment local no mobile', () => {
  assert.doesNotMatch(wallpaperCss, /background-attachment:\s*local/)
  assert.match(wallpaperCss, /data-chat-wallpaper="custom"[\s\S]*?background-size:\s*100% 100%, cover/)
})


test('foto de fundo ativa modo de contraste profissional no shell da conversa', () => {
  assert.match(wallpaperSource, /chatWallpaperActive/)
  assert.match(wallpaperSource, /chat-pro-conversation-panel|chat-pro-student-shell/)
  assert.match(wallpaperCss, /data-chat-wallpaper-active="custom"[\s\S]*?\.chat-pro-header/)
  assert.match(wallpaperCss, /data-chat-wallpaper="custom"[\s\S]*?\.chat-pro-bubble-own/)
  assert.match(wallpaperCss, /data-chat-wallpaper="custom"[\s\S]*?\.chat-pro-bubble-other/)
  assert.match(wallpaperCss, /#d9fdd3/i)
  assert.match(wallpaperCss, /#005c4b/i)
})

test('foto de fundo preserva composer e sugestoes legiveis sem transparência excessiva', () => {
  assert.match(wallpaperCss, /data-chat-wallpaper-active="custom"[\s\S]*?\.chat-pro-composer/)
  assert.match(wallpaperCss, /data-chat-wallpaper-active="custom"[\s\S]*?\.chat-pro-suggestion/)
})


test('preferência customizada legada com overlay padrão antigo migra para foto natural', () => {
  const storage = {
    getItem() {
      return JSON.stringify({
        presetId: 'custom',
        overlay: 0.36,
        customDataUrl: 'data:image/jpeg;base64,AAAA',
      })
    },
    setItem() {},
  }
  const migrated = loadChatWallpaperPreference(storage)
  assert.equal(migrated.presetId, 'custom')
  assert.equal(migrated.overlay, 0)
})

test('foto personalizada entra sem branqueamento por padrão mas mantém controle ajustável', () => {
  assert.match(wallpaperSource, /CUSTOM_WALLPAPER_DEFAULT_OVERLAY\s*=\s*0/)
  assert.match(wallpaperSource, /overlayInput\.min\s*=\s*'0'/)
  assert.match(wallpaperSource, /overlayTouched/)
  assert.match(wallpaperSource, /presetId:\s*'custom'[\s\S]*?overlay:/)
})

test('chat mobile aberto ocupa praticamente toda a viewport como mensageiro nativo', () => {
  assert.match(chatCss, /\.student-mobile-shell \.chat-conversation\.chat-conversation-immersive[\s\S]*?position:\s*fixed/)
  assert.match(chatCss, /\.student-mobile-shell \.chat-conversation\.chat-conversation-immersive[\s\S]*?top:\s*var\(--chat-pro-visual-offset-top/)
  assert.match(chatCss, /\.student-mobile-shell \.chat-conversation\.chat-conversation-immersive[\s\S]*?bottom:\s*auto/)
  assert.match(chatCss, /\.student-mobile-shell \.chat-conversation\.chat-conversation-immersive[\s\S]*?height:\s*var\(--chat-pro-visual-height/)
  assert.match(chatCss, /\.coach-auth-shell \.chat-workspace\.chat-pro-workspace\.chat-pro-mobile-conversation-open[\s\S]*?height:\s*calc\(/)
  assert.match(chatCss, /padding-top:\s*env\(safe-area-inset-top/)
})

test('personalização do chat ganha CTA destacado no header', () => {
  assert.match(wallpaperSource, /Personalização/)
  assert.match(wallpaperSource, /chat-pro-wallpaper-button-emphasis/)
  assert.match(wallpaperCss, /\.chat-pro-wallpaper-button-emphasis/)
  assert.match(wallpaperCss, /box-shadow:/)
})

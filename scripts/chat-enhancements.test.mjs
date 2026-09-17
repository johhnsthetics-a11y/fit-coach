import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

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
  loadChatWallpaperPreference,
  saveChatWallpaperPreference,
} = chatWallpaper

const indexHtml = readFileSync(new URL('../index.html', import.meta.url), 'utf8')
const productionMain = readFileSync(new URL('../src/main.jsx', import.meta.url), 'utf8')
const chatCss = readFileSync(new URL('../chat-enhancements.css', import.meta.url), 'utf8')
const wallpaperCss = readFileSync(new URL('../chat-wallpaper.css', import.meta.url), 'utf8')

test('chat identifica os composers reais do coach e do aluno', () => {
  assert.equal(CHAT_COMPOSER_SELECTORS.length, 2)
  assert.ok(CHAT_COMPOSER_SELECTORS.includes('textarea[placeholder="Escreva a mensagem para o aluno..."]'))
  assert.ok(CHAT_COMPOSER_SELECTORS.includes('textarea[placeholder="Responder ao coach..."]'))
})

test('produção carrega os entrypoints de messenger e wallpaper do chat', () => {
  assert.match(indexHtml, /src\/main\.jsx/)
  assert.match(productionMain, /installChatEnhancements/)
  assert.match(productionMain, /installChatWallpaperEnhancements/)
  assert.match(productionMain, /chat-enhancements\.css/)
  assert.match(productionMain, /chat-wallpaper\.css/)
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
  assert.ok(CHAT_WALLPAPER_PRESETS.length >= 4)
  assert.deepEqual(CHAT_WALLPAPER_PRESETS.map((preset) => preset.id).slice(0, 4), ['aurora', 'sage', 'horizon', 'texture'])
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
  assert.match(chatCss, /\.chat-pro-workspace\s*\{/)
  assert.match(chatCss, /\.chat-pro-conversations-pane\s*\{/)
  assert.match(chatCss, /\.chat-pro-conversation-panel\s*\{/)
  assert.match(chatCss, /\.chat-pro-suggestion\s*\{/)
  assert.match(chatCss, /\.chat-pro-audio-button/)
  assert.match(chatCss, /@media \(max-width: 760px\)/)
  assert.match(wallpaperCss, /\.chat-pro-wallpaper-button/)
  assert.match(wallpaperCss, /\.chat-pro-wallpaper-modal/)
  assert.match(wallpaperCss, /data-chat-wallpaper="custom"/)
  assert.match(wallpaperCss, /@media \(max-width: 760px\)/)
})

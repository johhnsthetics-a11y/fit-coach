import { CHAT_COMPOSER_SELECTORS } from './chatEnhancements.js'

export const CHAT_WALLPAPER_STORAGE_KEY = 'coachfit.chat.wallpaper.v1'
export const CHAT_WALLPAPER_PRESETS = Object.freeze([
  { id: 'aurora', label: 'Aurora', description: 'Verde suave e luminoso' },
  { id: 'sage', label: 'Sálvia', description: 'Natural e discreto' },
  { id: 'horizon', label: 'Horizonte', description: 'Azul com profundidade' },
  { id: 'texture', label: 'Textura', description: 'Padrão minimalista' },
])

const DEFAULT_CHAT_WALLPAPER = Object.freeze({
  presetId: 'aurora',
  overlay: 0.36,
  customDataUrl: '',
})
const MAX_CUSTOM_WALLPAPER_BYTES = 1_800_000
const enhancedWallpaperViewports = new WeakSet()
const modalByDocument = new WeakMap()

export function isSafeWallpaperDataUrl(value) {
  return /^data:image\/(?:png|jpe?g|webp|gif|avif);base64,[a-z0-9+/=\s]+$/i.test(String(value || ''))
}

function clampOverlay(value) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return DEFAULT_CHAT_WALLPAPER.overlay
  return Math.min(Math.max(parsed, 0.15), 0.75)
}

export function normalizeChatWallpaperPreference(preference = {}) {
  const presetIds = new Set(CHAT_WALLPAPER_PRESETS.map((preset) => preset.id))
  const customDataUrl = isSafeWallpaperDataUrl(preference.customDataUrl) ? preference.customDataUrl : ''
  const requestedPreset = String(preference.presetId || '')
  const presetId = requestedPreset === 'custom' && customDataUrl
    ? 'custom'
    : presetIds.has(requestedPreset)
      ? requestedPreset
      : DEFAULT_CHAT_WALLPAPER.presetId

  return {
    presetId,
    overlay: Number(clampOverlay(preference.overlay).toFixed(2)),
    customDataUrl: presetId === 'custom' ? customDataUrl : '',
  }
}

export function loadChatWallpaperPreference(storage = globalThis.localStorage) {
  if (!storage?.getItem) return { ...DEFAULT_CHAT_WALLPAPER }
  try {
    const raw = storage.getItem(CHAT_WALLPAPER_STORAGE_KEY)
    return raw ? normalizeChatWallpaperPreference(JSON.parse(raw)) : { ...DEFAULT_CHAT_WALLPAPER }
  } catch {
    return { ...DEFAULT_CHAT_WALLPAPER }
  }
}

export function saveChatWallpaperPreference(storage = globalThis.localStorage, preference = {}) {
  const normalized = normalizeChatWallpaperPreference(preference)
  storage?.setItem?.(CHAT_WALLPAPER_STORAGE_KEY, JSON.stringify(normalized))
  return normalized
}

function findMessageViewport(form) {
  const root = form?.parentElement
  if (!root) return null
  return [...root.children].find((child) => (
    child instanceof HTMLElement
      && child !== form
      && child.classList.contains('overflow-y-auto')
  )) || null
}

function collectChatViewports(documentRoot) {
  const viewports = new Set(documentRoot.querySelectorAll('.chat-pro-viewport'))
  CHAT_COMPOSER_SELECTORS.forEach((selector) => {
    documentRoot.querySelectorAll(selector).forEach((textarea) => {
      const viewport = findMessageViewport(textarea.closest('form'))
      if (viewport) viewports.add(viewport)
    })
  })
  return [...viewports]
}

function applyWallpaperToViewport(viewport, preference) {
  if (!(viewport instanceof HTMLElement)) return
  const normalized = normalizeChatWallpaperPreference(preference)
  viewport.dataset.chatWallpaper = normalized.presetId
  viewport.style.setProperty('--chat-pro-wallpaper-overlay', String(normalized.overlay))
  if (normalized.presetId === 'custom') {
    viewport.style.setProperty('--chat-pro-wallpaper-custom', `url("${normalized.customDataUrl}")`)
  } else {
    viewport.style.removeProperty('--chat-pro-wallpaper-custom')
  }
}

function applyWallpaperToDocument(documentRoot, preference) {
  collectChatViewports(documentRoot).forEach((viewport) => applyWallpaperToViewport(viewport, preference))
}

function readWallpaperFile(file) {
  return new Promise((resolve, reject) => {
    if (!file || !String(file.type || '').startsWith('image/')) {
      reject(new Error('Escolha uma imagem válida.'))
      return
    }
    if (file.size > MAX_CUSTOM_WALLPAPER_BYTES) {
      reject(new Error('Use uma imagem de até 1,8 MB para manter o app leve.'))
      return
    }
    if (typeof FileReader === 'undefined') {
      reject(new Error('Este dispositivo não suporta a leitura da imagem.'))
      return
    }

    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Não foi possível ler esta imagem.'))
    reader.onload = () => {
      const dataUrl = String(reader.result || '')
      if (!isSafeWallpaperDataUrl(dataUrl)) {
        reject(new Error('Formato de imagem não suportado.'))
        return
      }
      resolve(dataUrl)
    }
    reader.readAsDataURL(file)
  })
}

function createWallpaperModal(documentRoot, storage) {
  const existing = modalByDocument.get(documentRoot)
  if (existing) return existing

  const modal = documentRoot.createElement('div')
  modal.className = 'chat-pro-wallpaper-modal'
  modal.setAttribute('role', 'dialog')
  modal.setAttribute('aria-modal', 'true')
  modal.setAttribute('aria-label', 'Personalizar plano de fundo da conversa')
  modal.setAttribute('aria-hidden', 'true')

  const card = documentRoot.createElement('div')
  card.className = 'chat-pro-wallpaper-card'

  const header = documentRoot.createElement('div')
  header.className = 'chat-pro-wallpaper-card-header'
  header.innerHTML = '<div><p>Personalização</p><h3>Plano de fundo</h3></div>'

  const closeButton = documentRoot.createElement('button')
  closeButton.type = 'button'
  closeButton.className = 'chat-pro-wallpaper-close'
  closeButton.setAttribute('aria-label', 'Fechar personalização')
  closeButton.textContent = '×'
  header.appendChild(closeButton)

  const helper = documentRoot.createElement('p')
  helper.className = 'chat-pro-wallpaper-helper'
  helper.textContent = 'Escolha um estilo ou envie uma imagem. A alteração fica salva somente neste dispositivo.'

  const presetGrid = documentRoot.createElement('div')
  presetGrid.className = 'chat-pro-wallpaper-presets'
  const presetButtons = new Map()

  CHAT_WALLPAPER_PRESETS.forEach((preset) => {
    const button = documentRoot.createElement('button')
    button.type = 'button'
    button.className = 'chat-pro-wallpaper-preset'
    button.dataset.wallpaperPreset = preset.id
    button.innerHTML = `<span class="chat-pro-wallpaper-swatch" data-wallpaper-swatch="${preset.id}" aria-hidden="true"></span><strong>${preset.label}</strong><small>${preset.description}</small>`
    presetGrid.appendChild(button)
    presetButtons.set(preset.id, button)
  })

  const uploadSection = documentRoot.createElement('div')
  uploadSection.className = 'chat-pro-wallpaper-upload-section'

  const customPreview = documentRoot.createElement('div')
  customPreview.className = 'chat-pro-wallpaper-custom-preview'
  customPreview.innerHTML = '<span>Imagem própria</span>'

  const uploadLabel = documentRoot.createElement('label')
  uploadLabel.className = 'chat-pro-wallpaper-upload'
  uploadLabel.innerHTML = '<span aria-hidden="true">＋</span><span><strong>Enviar imagem</strong><small>PNG, JPG, WebP ou AVIF · até 1,8 MB</small></span>'
  const uploadInput = documentRoot.createElement('input')
  uploadInput.type = 'file'
  uploadInput.accept = 'image/png,image/jpeg,image/webp,image/gif,image/avif'
  uploadInput.className = 'chat-pro-wallpaper-file-input'
  uploadLabel.appendChild(uploadInput)
  uploadSection.append(customPreview, uploadLabel)

  const overlayRow = documentRoot.createElement('label')
  overlayRow.className = 'chat-pro-wallpaper-overlay-control'
  overlayRow.innerHTML = '<span><strong>Legibilidade</strong><small>Ajuste a proteção sobre o fundo</small></span>'
  const overlayInput = documentRoot.createElement('input')
  overlayInput.type = 'range'
  overlayInput.min = '0.15'
  overlayInput.max = '0.75'
  overlayInput.step = '0.05'
  overlayInput.setAttribute('aria-label', 'Opacidade da proteção do plano de fundo')
  overlayRow.appendChild(overlayInput)

  const status = documentRoot.createElement('p')
  status.className = 'chat-pro-wallpaper-status'
  status.setAttribute('role', 'status')

  const actions = documentRoot.createElement('div')
  actions.className = 'chat-pro-wallpaper-actions'
  const resetButton = documentRoot.createElement('button')
  resetButton.type = 'button'
  resetButton.className = 'chat-pro-wallpaper-reset'
  resetButton.textContent = 'Restaurar padrão'
  const cancelButton = documentRoot.createElement('button')
  cancelButton.type = 'button'
  cancelButton.className = 'chat-pro-wallpaper-cancel'
  cancelButton.textContent = 'Cancelar'
  const applyButton = documentRoot.createElement('button')
  applyButton.type = 'button'
  applyButton.className = 'chat-pro-wallpaper-apply'
  applyButton.textContent = 'Aplicar'
  actions.append(resetButton, cancelButton, applyButton)

  card.append(header, helper, presetGrid, uploadSection, overlayRow, status, actions)
  modal.appendChild(card)
  documentRoot.body.appendChild(modal)

  let saved = loadChatWallpaperPreference(storage)
  let draft = { ...saved }

  function renderDraft() {
    applyWallpaperToDocument(documentRoot, draft)
    overlayInput.value = String(draft.overlay)
    presetButtons.forEach((button, id) => button.classList.toggle('chat-pro-wallpaper-selected', draft.presetId === id))
    customPreview.classList.toggle('chat-pro-wallpaper-selected', draft.presetId === 'custom')
    if (draft.customDataUrl) {
      customPreview.style.backgroundImage = `linear-gradient(rgba(10,20,18,.22), rgba(10,20,18,.22)), url("${draft.customDataUrl}")`
      customPreview.innerHTML = '<span>Imagem própria selecionada</span>'
    } else {
      customPreview.style.removeProperty('background-image')
      customPreview.innerHTML = '<span>Nenhuma imagem enviada</span>'
    }
  }

  function close({ restore = false } = {}) {
    if (restore) applyWallpaperToDocument(documentRoot, saved)
    modal.classList.remove('chat-pro-wallpaper-open')
    modal.setAttribute('aria-hidden', 'true')
    status.textContent = ''
    uploadInput.value = ''
  }

  function open() {
    saved = loadChatWallpaperPreference(storage)
    draft = { ...saved }
    renderDraft()
    modal.classList.add('chat-pro-wallpaper-open')
    modal.setAttribute('aria-hidden', 'false')
    requestAnimationFrame(() => closeButton.focus())
  }

  presetButtons.forEach((button, presetId) => {
    button.addEventListener('click', () => {
      draft = normalizeChatWallpaperPreference({ ...draft, presetId, customDataUrl: '' })
      status.textContent = 'Prévia aplicada. Toque em Aplicar para salvar.'
      renderDraft()
    })
  })

  uploadInput.addEventListener('change', async () => {
    status.textContent = 'Preparando imagem…'
    try {
      const customDataUrl = await readWallpaperFile(uploadInput.files?.[0])
      draft = normalizeChatWallpaperPreference({ ...draft, presetId: 'custom', customDataUrl })
      status.textContent = 'Prévia aplicada. Toque em Aplicar para salvar.'
      renderDraft()
    } catch (error) {
      status.textContent = error?.message || 'Não foi possível usar esta imagem.'
      uploadInput.value = ''
    }
  })

  overlayInput.addEventListener('input', () => {
    draft = normalizeChatWallpaperPreference({ ...draft, overlay: overlayInput.value })
    status.textContent = 'Prévia aplicada. Toque em Aplicar para salvar.'
    renderDraft()
  })

  resetButton.addEventListener('click', () => {
    draft = { ...DEFAULT_CHAT_WALLPAPER }
    status.textContent = 'Padrão restaurado na prévia. Toque em Aplicar para salvar.'
    renderDraft()
  })

  cancelButton.addEventListener('click', () => close({ restore: true }))
  closeButton.addEventListener('click', () => close({ restore: true }))
  modal.addEventListener('click', (event) => {
    if (event.target === modal) close({ restore: true })
  })

  applyButton.addEventListener('click', () => {
    try {
      saved = saveChatWallpaperPreference(storage, draft)
      draft = { ...saved }
      applyWallpaperToDocument(documentRoot, saved)
      close()
    } catch {
      status.textContent = 'Não foi possível salvar este fundo. Tente uma imagem menor.'
    }
  })

  const api = { open, close }
  modalByDocument.set(documentRoot, api)
  return api
}

function createWallpaperToolbar(viewport, storage) {
  const root = viewport.parentElement
  if (!root) return

  let toolbar = root.querySelector(':scope > .chat-pro-wallpaper-toolbar')
  if (toolbar) return

  toolbar = viewport.ownerDocument.createElement('div')
  toolbar.className = 'chat-pro-wallpaper-toolbar'

  const button = viewport.ownerDocument.createElement('button')
  button.type = 'button'
  button.className = 'chat-pro-wallpaper-button'
  button.setAttribute('aria-label', 'Alterar plano de fundo da conversa')
  button.innerHTML = '<span aria-hidden="true">◫</span><span>Plano de fundo</span>'
  button.addEventListener('click', () => createWallpaperModal(viewport.ownerDocument, storage).open())

  toolbar.appendChild(button)
  root.insertBefore(toolbar, viewport)
}

function enhanceWallpaperViewport(viewport, storage) {
  if (!(viewport instanceof HTMLElement)) return
  applyWallpaperToViewport(viewport, loadChatWallpaperPreference(storage))
  if (enhancedWallpaperViewports.has(viewport)) return
  enhancedWallpaperViewports.add(viewport)
  createWallpaperToolbar(viewport, storage)
}

function enhanceCurrentWallpaperChats(documentRoot, storage) {
  collectChatViewports(documentRoot).forEach((viewport) => enhanceWallpaperViewport(viewport, storage))
}

export function installChatWallpaperEnhancements(
  documentRoot = globalThis.document,
  storage = globalThis.localStorage,
) {
  if (!documentRoot?.body || typeof MutationObserver === 'undefined') return () => {}

  enhanceCurrentWallpaperChats(documentRoot, storage)

  let queued = false
  const observer = new MutationObserver(() => {
    if (queued) return
    queued = true
    requestAnimationFrame(() => {
      queued = false
      enhanceCurrentWallpaperChats(documentRoot, storage)
    })
  })
  observer.observe(documentRoot.body, { childList: true, subtree: true })

  return () => observer.disconnect()
}

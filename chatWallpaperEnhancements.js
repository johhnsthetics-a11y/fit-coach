import { CHAT_COMPOSER_SELECTORS } from './chatEnhancements.js'

export const CHAT_WALLPAPER_STORAGE_KEY = 'coachfit.chat.wallpaper.v1'
export const CHAT_WALLPAPER_PRESETS = Object.freeze([
  { id: 'aurora', label: 'Aurora', description: 'Verde suave e luminoso' },
  { id: 'sage', label: 'Sálvia', description: 'Natural e discreto' },
  { id: 'horizon', label: 'Horizonte', description: 'Azul com profundidade' },
  { id: 'texture', label: 'Textura', description: 'Padrão minimalista' },
  { id: 'solid', label: 'Sólido', description: 'Limpo, uniforme e discreto' },
])

const DEFAULT_CHAT_WALLPAPER = Object.freeze({
  presetId: 'aurora',
  overlay: 0.36,
  customDataUrl: '',
})
const CUSTOM_WALLPAPER_DEFAULT_OVERLAY = 0
const MAX_SOURCE_WALLPAPER_BYTES = 12 * 1024 * 1024
const MAX_STORED_WALLPAPER_BYTES = 1_250_000
const MAX_WALLPAPER_EDGE = 1800
const enhancedWallpaperViewports = new WeakSet()
const modalByDocument = new WeakMap()

export function isSafeWallpaperDataUrl(value) {
  return /^data:image\/(?:png|jpe?g|webp|gif|avif);base64,[a-z0-9+/=\s]+$/i.test(String(value || ''))
}


export function estimateWallpaperDataUrlBytes(value = '') {
  const text = String(value || '')
  const commaIndex = text.indexOf(',')
  if (commaIndex < 0) return 0
  const base64 = text.slice(commaIndex + 1).replace(/\s/g, '')
  if (!base64) return 0
  const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0
  return Math.max(0, Math.floor((base64.length * 3) / 4) - padding)
}

export function getWallpaperTargetDimensions(width, height, maxEdge = MAX_WALLPAPER_EDGE) {
  const safeWidth = Math.max(1, Number(width) || 1)
  const safeHeight = Math.max(1, Number(height) || 1)
  const safeMaxEdge = Math.max(1, Number(maxEdge) || MAX_WALLPAPER_EDGE)
  const scale = Math.min(1, safeMaxEdge / Math.max(safeWidth, safeHeight))
  return {
    width: Math.max(1, Math.round(safeWidth * scale)),
    height: Math.max(1, Math.round(safeHeight * scale)),
  }
}

function fileLooksLikeImage(file) {
  const type = String(file?.type || '').toLowerCase()
  const name = String(file?.name || '').toLowerCase()
  return type.startsWith('image/')
    || /\.(?:png|jpe?g|webp|gif|avif|heic|heif)$/i.test(name)
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    if (typeof FileReader === 'undefined') {
      reject(new Error('Este dispositivo não suporta a leitura da imagem.'))
      return
    }
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Não foi possível ler esta imagem.'))
    reader.onload = () => resolve(String(reader.result || ''))
    reader.readAsDataURL(file)
  })
}

async function decodeWallpaperImage(file, documentRoot) {
  const view = documentRoot?.defaultView || globalThis
  const bitmapFactory = view?.createImageBitmap || globalThis.createImageBitmap
  if (typeof bitmapFactory === 'function') {
    try {
      const bitmap = await bitmapFactory(file)
      return {
        source: bitmap,
        width: bitmap.width,
        height: bitmap.height,
        cleanup: () => {
          try { bitmap.close?.() } catch {}
        },
      }
    } catch {
      // Safari/older browsers may fail createImageBitmap for formats they can
      // still decode through an <img>.
    }
  }

  const ImageCtor = view?.Image || globalThis.Image
  if (typeof ImageCtor !== 'function') throw new Error('Este navegador não conseguiu abrir esta imagem.')

  const sourceUrl = await readFileAsDataUrl(file)
  return new Promise((resolve, reject) => {
    const image = new ImageCtor()
    image.onload = () => resolve({
      source: image,
      width: image.naturalWidth || image.width,
      height: image.naturalHeight || image.height,
      cleanup: () => {},
    })
    image.onerror = () => reject(new Error('Formato de imagem não suportado neste dispositivo.'))
    image.src = sourceUrl
  })
}

export async function prepareWallpaperImage(file, documentRoot = globalThis.document) {
  if (!file || !fileLooksLikeImage(file)) throw new Error('Escolha uma imagem válida.')
  if (Number(file.size || 0) > MAX_SOURCE_WALLPAPER_BYTES) {
    throw new Error('A imagem original deve ter no máximo 12 MB.')
  }

  const fallbackToOriginal = async () => {
    const raw = await readFileAsDataUrl(file)
    if (!isSafeWallpaperDataUrl(raw)) throw new Error('Formato de imagem não suportado neste dispositivo.')
    if (estimateWallpaperDataUrlBytes(raw) > MAX_STORED_WALLPAPER_BYTES) {
      throw new Error('Não foi possível otimizar esta imagem. Escolha outra foto.')
    }
    return raw
  }

  if (!documentRoot?.createElement) return fallbackToOriginal()

  let decoded
  try {
    decoded = await decodeWallpaperImage(file, documentRoot)
  } catch (error) {
    if (Number(file.size || 0) <= MAX_STORED_WALLPAPER_BYTES) return fallbackToOriginal()
    throw error
  }

  try {
    const dimensions = getWallpaperTargetDimensions(decoded.width, decoded.height)
    const canvas = documentRoot.createElement('canvas')
    const context = canvas?.getContext?.('2d', { alpha: false })
    if (!context || typeof canvas.toDataURL !== 'function') return fallbackToOriginal()

    canvas.width = dimensions.width
    canvas.height = dimensions.height
    context.fillStyle = '#eef3f1'
    context.fillRect(0, 0, canvas.width, canvas.height)
    context.drawImage(decoded.source, 0, 0, canvas.width, canvas.height)

    for (const quality of [0.82, 0.72, 0.62, 0.52]) {
      const dataUrl = canvas.toDataURL('image/jpeg', quality)
      if (isSafeWallpaperDataUrl(dataUrl) && estimateWallpaperDataUrlBytes(dataUrl) <= MAX_STORED_WALLPAPER_BYTES) {
        return dataUrl
      }
    }

    throw new Error('Não foi possível reduzir esta imagem o suficiente. Escolha outra foto.')
  } finally {
    decoded?.cleanup?.()
  }
}

function clampOverlay(value) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return DEFAULT_CHAT_WALLPAPER.overlay
  return Math.min(Math.max(parsed, 0), 0.75)
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
    // Preserve the last custom image even while previewing/saving a preset so the
    // user can switch back without selecting the file again.
    customDataUrl,
  }
}

export function loadChatWallpaperPreference(storage = globalThis.localStorage) {
  if (!storage?.getItem) return { ...DEFAULT_CHAT_WALLPAPER }
  try {
    const raw = storage.getItem(CHAT_WALLPAPER_STORAGE_KEY)
    if (!raw) return { ...DEFAULT_CHAT_WALLPAPER }

    const parsed = JSON.parse(raw)
    const normalized = normalizeChatWallpaperPreference(parsed)
    const isLegacyCustomDefault = normalized.presetId === 'custom'
      && Number(parsed?.overlay) === DEFAULT_CHAT_WALLPAPER.overlay

    return isLegacyCustomDefault
      ? { ...normalized, overlay: CUSTOM_WALLPAPER_DEFAULT_OVERLAY }
      : normalized
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

  const shell = viewport.closest('.chat-pro-conversation-panel, .chat-pro-student-shell')
  if (shell instanceof HTMLElement) {
    shell.dataset.chatWallpaperActive = normalized.presetId
  }

  if (normalized.presetId === 'custom') {
    viewport.style.setProperty('--chat-pro-wallpaper-custom', `url("${normalized.customDataUrl}")`)
  } else {
    viewport.style.removeProperty('--chat-pro-wallpaper-custom')
  }
}

function applyWallpaperToDocument(documentRoot, preference) {
  collectChatViewports(documentRoot).forEach((viewport) => applyWallpaperToViewport(viewport, preference))
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
  helper.textContent = 'Escolha um estilo ou use uma foto sua. Você pode trocar, remover e voltar para a última imagem sem precisar selecionar o arquivo novamente.'

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

  const customPreview = documentRoot.createElement('button')
  customPreview.type = 'button'
  customPreview.className = 'chat-pro-wallpaper-custom-preview'
  customPreview.setAttribute('aria-label', 'Usar imagem personalizada')
  customPreview.innerHTML = '<span>Imagem própria</span>'

  const uploadControls = documentRoot.createElement('div')
  uploadControls.className = 'chat-pro-wallpaper-upload-controls'

  const uploadLabel = documentRoot.createElement('label')
  uploadLabel.className = 'chat-pro-wallpaper-upload'
  uploadLabel.innerHTML = '<span aria-hidden="true">＋</span><span><strong class="chat-pro-wallpaper-upload-title">Enviar imagem</strong><small>Foto do celular ou arquivo · até 12 MB · otimização automática</small></span>'
  const uploadTitle = uploadLabel.querySelector('.chat-pro-wallpaper-upload-title')
  const uploadInput = documentRoot.createElement('input')
  uploadInput.type = 'file'
  uploadInput.accept = 'image/*,.heic,.heif'
  uploadInput.className = 'chat-pro-wallpaper-file-input'
  uploadLabel.appendChild(uploadInput)

  const removeImageButton = documentRoot.createElement('button')
  removeImageButton.type = 'button'
  removeImageButton.className = 'chat-pro-wallpaper-remove-image'
  removeImageButton.textContent = 'Remover imagem'

  uploadControls.append(uploadLabel, removeImageButton)
  uploadSection.append(customPreview, uploadControls)

  const overlayRow = documentRoot.createElement('label')
  overlayRow.className = 'chat-pro-wallpaper-overlay-control'
  overlayRow.innerHTML = '<span><strong>Legibilidade</strong><small>0% mantém a foto original; aumente somente se quiser mais proteção</small></span>'
  const overlayInput = documentRoot.createElement('input')
  overlayInput.type = 'range'
  overlayInput.min = '0'
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
  let processingImage = false
  let previousFocus = null
  let overlayTouched = false

  function renderDraft() {
    applyWallpaperToDocument(documentRoot, draft)
    overlayInput.value = String(draft.overlay)
    presetButtons.forEach((button, id) => button.classList.toggle('chat-pro-wallpaper-selected', draft.presetId === id))
    const hasCustomImage = Boolean(draft.customDataUrl)
    customPreview.classList.toggle('chat-pro-wallpaper-selected', draft.presetId === 'custom')
    customPreview.setAttribute('aria-pressed', draft.presetId === 'custom' ? 'true' : 'false')
    customPreview.disabled = processingImage
    removeImageButton.hidden = !hasCustomImage
    removeImageButton.disabled = processingImage
    uploadInput.disabled = processingImage
    applyButton.disabled = processingImage
    uploadTitle.textContent = hasCustomImage ? 'Trocar imagem' : 'Enviar imagem'
    if (hasCustomImage) {
      customPreview.style.backgroundImage = `linear-gradient(rgba(10,20,18,.22), rgba(10,20,18,.22)), url("${draft.customDataUrl}")`
      customPreview.innerHTML = `<span>${draft.presetId === 'custom' ? 'Imagem própria em uso' : 'Usar imagem própria'}</span>`
    } else {
      customPreview.style.removeProperty('background-image')
      customPreview.innerHTML = '<span>Nenhuma imagem enviada</span>'
    }
  }

  function close({ restore = false } = {}) {
    if (processingImage) return
    if (restore) applyWallpaperToDocument(documentRoot, saved)
    modal.classList.remove('chat-pro-wallpaper-open')
    modal.setAttribute('aria-hidden', 'true')
    status.textContent = ''
    uploadInput.value = ''
    previousFocus?.focus?.()
    previousFocus = null
  }

  function open() {
    saved = loadChatWallpaperPreference(storage)
    draft = { ...saved }
    overlayTouched = false
    previousFocus = documentRoot.activeElement
    renderDraft()
    modal.classList.add('chat-pro-wallpaper-open')
    modal.setAttribute('aria-hidden', 'false')
    requestAnimationFrame(() => closeButton.focus())
  }

  presetButtons.forEach((button, presetId) => {
    button.addEventListener('click', () => {
      draft = normalizeChatWallpaperPreference({ ...draft, presetId })
      status.textContent = 'Prévia aplicada. Toque em Aplicar para salvar.'
      renderDraft()
    })
  })

  async function useWallpaperFile(file) {
    if (!file) return
    processingImage = true
    modal.setAttribute('aria-busy', 'true')
    status.textContent = 'Otimizando imagem…'
    renderDraft()
    try {
      const customDataUrl = await prepareWallpaperImage(file, documentRoot)
      const nextOverlay = draft.presetId === 'custom' || overlayTouched
        ? draft.overlay
        : CUSTOM_WALLPAPER_DEFAULT_OVERLAY
      draft = normalizeChatWallpaperPreference({
        ...draft,
        presetId: 'custom',
        customDataUrl,
        overlay: nextOverlay,
      })
      status.textContent = nextOverlay === 0
        ? 'Imagem pronta, sem branqueamento. Ajuste a legibilidade se quiser e toque em Aplicar.'
        : 'Imagem pronta. Toque em Aplicar para salvar.'
    } catch (error) {
      status.textContent = error?.message || 'Não foi possível usar esta imagem.'
    } finally {
      processingImage = false
      modal.setAttribute('aria-busy', 'false')
      uploadInput.value = ''
      renderDraft()
    }
  }

  uploadInput.addEventListener('change', () => useWallpaperFile(uploadInput.files?.[0]))

  customPreview.addEventListener('click', () => {
    if (processingImage) return
    if (draft.customDataUrl) {
      const nextOverlay = draft.presetId === 'custom' || overlayTouched
        ? draft.overlay
        : CUSTOM_WALLPAPER_DEFAULT_OVERLAY
      draft = normalizeChatWallpaperPreference({ ...draft, presetId: 'custom', overlay: nextOverlay })
      status.textContent = nextOverlay === 0
        ? 'Imagem própria selecionada sem branqueamento. Toque em Aplicar para salvar.'
        : 'Imagem própria selecionada. Toque em Aplicar para salvar.'
      renderDraft()
      return
    }
    uploadInput.click()
  })

  removeImageButton.addEventListener('click', () => {
    if (processingImage) return
    const nextPresetId = draft.presetId === 'custom' ? DEFAULT_CHAT_WALLPAPER.presetId : draft.presetId
    draft = normalizeChatWallpaperPreference({ ...draft, presetId: nextPresetId, customDataUrl: '' })
    status.textContent = 'Imagem removida da prévia. Toque em Aplicar para salvar.'
    renderDraft()
  })

  uploadLabel.addEventListener('dragover', (event) => {
    event.preventDefault()
    uploadLabel.classList.add('chat-pro-wallpaper-dragging')
  })
  uploadLabel.addEventListener('dragleave', () => uploadLabel.classList.remove('chat-pro-wallpaper-dragging'))
  uploadLabel.addEventListener('drop', (event) => {
    event.preventDefault()
    uploadLabel.classList.remove('chat-pro-wallpaper-dragging')
    useWallpaperFile(event.dataTransfer?.files?.[0])
  })

  overlayInput.addEventListener('input', () => {
    overlayTouched = true
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
  documentRoot.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && modal.classList.contains('chat-pro-wallpaper-open')) {
      close({ restore: true })
    }
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

  const shell = viewport.closest('.chat-pro-conversation-panel, .chat-pro-student-shell, section') || root
  if (shell.querySelector('.chat-pro-wallpaper-toolbar')) return

  const toolbar = viewport.ownerDocument.createElement('div')
  toolbar.className = 'chat-pro-wallpaper-toolbar'

  const button = viewport.ownerDocument.createElement('button')
  button.type = 'button'
  button.className = 'chat-pro-wallpaper-button chat-pro-wallpaper-button-emphasis'
  button.setAttribute('aria-label', 'Abrir personalização do chat')
  button.innerHTML = '<span aria-hidden="true">✦</span><span>Personalização</span>'
  button.addEventListener('click', () => createWallpaperModal(viewport.ownerDocument, storage).open())

  toolbar.appendChild(button)

  const header = shell.querySelector('.chat-pro-header')
  if (header) {
    toolbar.classList.add('chat-pro-wallpaper-toolbar-in-header')
    header.appendChild(toolbar)
    return
  }

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

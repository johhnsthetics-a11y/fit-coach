export const CHAT_COMPOSER_SELECTORS = [
  'textarea[placeholder="Escreva a mensagem para o aluno..."]',
  'textarea[placeholder="Responder ao coach..."]',
]

export const CHAT_MESSENGER_CLASSES = Object.freeze({
  workspace: 'chat-pro-workspace',
  conversationPane: 'chat-pro-conversations-pane',
  conversationPanel: 'chat-pro-conversation-panel',
  thread: 'chat-pro-thread',
  header: 'chat-pro-header',
  suggestion: 'chat-pro-suggestion',
  viewport: 'chat-pro-viewport',
  composer: 'chat-pro-composer',
  sendButton: 'chat-pro-send-button',
  attachmentButton: 'chat-pro-attachment-button',
  audioButton: 'chat-pro-audio-button',
})

const CHAT_SCROLL_THRESHOLD = 120
const enhancedComposers = new WeakSet()
const enhancedViewports = new WeakSet()
const enhancedThreads = new WeakSet()
const viewportStates = new WeakMap()

export function isNearChatBottom({ scrollHeight = 0, scrollTop = 0, clientHeight = 0 } = {}, threshold = CHAT_SCROLL_THRESHOLD) {
  return Math.max(Number(scrollHeight) - Number(scrollTop) - Number(clientHeight), 0) <= threshold
}

export function shouldSubmitChatOnKeydown(event) {
  const composing = Boolean(event?.isComposing || event?.nativeEvent?.isComposing)
  return event?.key === 'Enter' && !event?.shiftKey && !composing
}

function requestFrame(callback) {
  if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
    return window.requestAnimationFrame(callback)
  }
  return setTimeout(callback, 0)
}

function scrollChatToBottom(viewport, behavior = 'smooth') {
  if (!viewport) return
  const state = viewportStates.get(viewport)
  viewport.scrollTo({ top: viewport.scrollHeight, behavior })
  if (state) {
    state.nearBottom = true
    state.forceNextScroll = false
    state.newMessagesButton?.classList.remove('chat-pro-new-visible')
  }
}

function getMessageElements(viewport) {
  return [...viewport.children].filter((child) => (
    child instanceof HTMLElement
      && (child.classList.contains('ml-auto') || child.classList.contains('mr-auto'))
      && [...child.classList].some((className) => className.includes('max-w-'))
  ))
}

function decorateMessageBubbles(viewport) {
  getMessageElements(viewport).forEach((message) => {
    message.classList.add('chat-pro-bubble')
    if (message.classList.contains('ml-auto')) {
      message.classList.add('chat-pro-bubble-own')
    } else {
      message.classList.add('chat-pro-bubble-other')
    }
  })
}

function createNewMessagesButton(viewport) {
  const root = viewport.parentElement
  if (!root || root.querySelector(':scope > .chat-pro-new-messages')) {
    return root?.querySelector(':scope > .chat-pro-new-messages') || null
  }

  const button = viewport.ownerDocument.createElement('button')
  button.type = 'button'
  button.className = 'chat-pro-new-messages'
  button.setAttribute('aria-label', 'Ir para as mensagens mais recentes')
  button.innerHTML = '<span aria-hidden="true">↓</span> Novas mensagens'
  button.addEventListener('click', () => scrollChatToBottom(viewport))
  root.insertBefore(button, viewport.nextSibling)
  return button
}

function enhanceViewport(viewport) {
  if (!(viewport instanceof HTMLElement)) return

  viewport.classList.add(CHAT_MESSENGER_CLASSES.viewport)
  decorateMessageBubbles(viewport)

  if (enhancedViewports.has(viewport)) return
  enhancedViewports.add(viewport)

  const state = {
    nearBottom: true,
    forceNextScroll: true,
    messageCount: getMessageElements(viewport).length,
    newMessagesButton: null,
  }
  viewportStates.set(viewport, state)
  state.newMessagesButton = createNewMessagesButton(viewport)

  viewport.addEventListener('scroll', () => {
    state.nearBottom = isNearChatBottom(viewport)
    if (state.nearBottom) state.newMessagesButton?.classList.remove('chat-pro-new-visible')
  }, { passive: true })

  const observer = new MutationObserver(() => {
    decorateMessageBubbles(viewport)
    const nextCount = getMessageElements(viewport).length
    const receivedNewContent = nextCount > state.messageCount
    state.messageCount = nextCount

    if (state.forceNextScroll || state.nearBottom) {
      requestFrame(() => scrollChatToBottom(viewport, state.forceNextScroll ? 'auto' : 'smooth'))
      return
    }

    if (receivedNewContent) state.newMessagesButton?.classList.add('chat-pro-new-visible')
  })
  observer.observe(viewport, { childList: true, subtree: true })

  requestFrame(() => scrollChatToBottom(viewport, 'auto'))
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

function getThreadButtons(root) {
  if (!root) return []
  return [...root.querySelectorAll('button')].filter((button) => button.querySelector('.line-clamp-2'))
}

function directChildContaining(root, node) {
  if (!(root instanceof HTMLElement) || !(node instanceof HTMLElement) || !root.contains(node)) return null
  let current = node
  while (current.parentElement && current.parentElement !== root) current = current.parentElement
  return current.parentElement === root ? current : null
}

function findCoachWorkspace(form) {
  if (!form?.querySelector('textarea[placeholder="Escreva a mensagem para o aluno..."]')) return null

  let root = form.parentElement
  for (let depth = 0; root && depth < 8; depth += 1, root = root.parentElement) {
    const threadButtons = getThreadButtons(root)
    if (!threadButtons.length) continue

    const conversationPanel = directChildContaining(root, form)
    if (!conversationPanel) continue

    const conversationPane = [...root.children].find((child) => (
      child instanceof HTMLElement
        && child !== conversationPanel
        && getThreadButtons(child).length > 0
    ))
    if (!conversationPane) continue

    return { root, conversationPane, conversationPanel }
  }
  return null
}

function createMobileBackButton(header, workspace) {
  if (!(header instanceof HTMLElement) || !workspace || header.querySelector('.chat-pro-mobile-back')) return

  const button = header.ownerDocument.createElement('button')
  button.type = 'button'
  button.className = 'chat-pro-mobile-back'
  button.setAttribute('aria-label', 'Voltar para conversas')
  button.innerHTML = '<span aria-hidden="true">‹</span>'
  button.addEventListener('click', () => workspace.classList.remove('chat-pro-mobile-conversation-open'))
  header.insertBefore(button, header.firstChild)
}

function decorateCoachHeader(conversationPanel, form, workspace) {
  if (!(conversationPanel instanceof HTMLElement)) return

  const heading = [...conversationPanel.querySelectorAll('h1,h2,h3')].find((element) => {
    const text = element.textContent?.trim() || ''
    return /mensagem para|conversa|chat/i.test(text)
  })
  if (!heading) return

  let header = heading.parentElement
  while (header?.parentElement && header.parentElement !== conversationPanel && !header.contains(form)) {
    const next = header.parentElement
    if (next.contains(form)) break
    header = next
  }
  if (!(header instanceof HTMLElement) || header.contains(form)) return

  header.classList.add(CHAT_MESSENGER_CLASSES.header, 'chat-pro-coach-header')
  createMobileBackButton(header, workspace)
}

function decorateSuggestion(form) {
  const root = form?.parentElement
  if (!root) return

  const suggestionButton = [...root.querySelectorAll('button')].find((button) => /usar sugest/i.test(button.textContent || ''))
  if (!suggestionButton) return

  let candidate = suggestionButton.parentElement
  while (candidate && candidate !== root) {
    if (/resposta sugerida/i.test(candidate.textContent || '')) {
      candidate.classList.add(CHAT_MESSENGER_CLASSES.suggestion)
      suggestionButton.classList.add('chat-pro-suggestion-action')
      return
    }
    candidate = candidate.parentElement
  }
}

function decorateCoachShell(form) {
  const shell = findCoachWorkspace(form)
  if (!shell) return

  shell.root.classList.add(CHAT_MESSENGER_CLASSES.workspace)
  shell.conversationPane.classList.add(CHAT_MESSENGER_CLASSES.conversationPane)
  shell.conversationPanel.classList.add(CHAT_MESSENGER_CLASSES.conversationPanel)
  decorateCoachHeader(shell.conversationPanel, form, shell.root)
  decorateSuggestion(form)
}

function decorateConversationThreads(form) {
  let root = form?.parentElement
  for (let depth = 0; root && depth < 6; depth += 1, root = root.parentElement) {
    const buttons = getThreadButtons(root)
    if (!buttons.length) continue

    buttons.forEach((button) => {
      button.classList.add(CHAT_MESSENGER_CLASSES.thread)
      const title = button.querySelector('h4')
      if (title) title.classList.add('chat-pro-thread-title')

      if (!enhancedThreads.has(button)) {
        enhancedThreads.add(button)
        button.addEventListener('click', () => {
          const workspace = button.closest(`.${CHAT_MESSENGER_CLASSES.workspace}`)
          workspace?.classList.add('chat-pro-mobile-conversation-open')
        })
      }
    })
    return
  }
}

function decorateStudentHeader(form) {
  if (!form?.querySelector('textarea[placeholder="Responder ao coach..."]')) return

  let root = form.parentElement
  while (root && root.tagName !== 'SECTION') root = root.parentElement
  if (!root) return

  const header = root.firstElementChild
  if (!(header instanceof HTMLElement)) return
  header.classList.add(CHAT_MESSENGER_CLASSES.header)

  const eyebrow = header.querySelector('p')
  if (eyebrow) eyebrow.textContent = 'Conversa com seu treinador'

  const title = header.querySelector('h2')
  if (title && title.textContent?.trim()) {
    title.dataset.chatOriginalTitle ||= title.textContent.trim()
    title.textContent = 'Seu treinador'
  }
}

function markForceScrollForConversationSelection(documentRoot) {
  documentRoot.addEventListener('click', (event) => {
    const button = event.target?.closest?.('button')
    if (!button?.querySelector?.('.line-clamp-2')) return

    const coachComposer = documentRoot.querySelector(CHAT_COMPOSER_SELECTORS[0])
    const viewport = findMessageViewport(coachComposer?.closest('form'))
    const state = viewport ? viewportStates.get(viewport) : null
    if (!viewport || !state) return

    state.forceNextScroll = true
    state.newMessagesButton?.classList.remove('chat-pro-new-visible')
    requestFrame(() => requestFrame(() => scrollChatToBottom(viewport, 'auto')))
  }, true)
}

function findCommonAncestor(elements, boundary) {
  const nodes = elements.filter((element) => element instanceof HTMLElement)
  if (!nodes.length) return null

  let candidate = nodes[0].parentElement
  while (candidate && candidate !== boundary) {
    if (nodes.every((node) => candidate.contains(node))) return candidate
    candidate = candidate.parentElement
  }
  return boundary && nodes.every((node) => boundary.contains(node)) ? boundary : null
}

function syncComposerHeight(textarea) {
  if (!(textarea instanceof HTMLTextAreaElement)) return
  textarea.style.height = 'auto'
  const desired = Math.min(Math.max(textarea.scrollHeight || 48, 48), 144)
  textarea.style.height = `${desired}px`
}

function enhanceComposer(textarea) {
  if (!(textarea instanceof HTMLTextAreaElement)) return

  textarea.classList.add('chat-pro-composer-input')
  textarea.setAttribute('enterkeyhint', 'send')
  textarea.setAttribute('autocapitalize', 'sentences')
  textarea.setAttribute('spellcheck', 'true')
  textarea.setAttribute('rows', '1')

  const form = textarea.closest('form')
  if (!form) return
  form.classList.add(CHAT_MESSENGER_CLASSES.composer)

  const viewport = findMessageViewport(form)
  if (viewport) enhanceViewport(viewport)
  decorateCoachShell(form)
  decorateConversationThreads(form)
  decorateStudentHeader(form)

  const submitButton = [...form.querySelectorAll('button')].find((button) => (
    button.type === 'submit' || /enviar (mensagem|resposta)|enviando/i.test(button.textContent || '')
  ))
  submitButton?.classList.add(CHAT_MESSENGER_CLASSES.sendButton)

  const attachmentLabel = [...form.querySelectorAll('label')].find((label) => /foto\/áudio/i.test(label.textContent || ''))
  attachmentLabel?.classList.add(CHAT_MESSENGER_CLASSES.attachmentButton)

  const audioButton = [...form.querySelectorAll('button')].find((button) => (
    button !== submitButton && /gravar áudio|parar gravação|áudio/i.test(button.textContent || '')
  ))
  audioButton?.classList.add(CHAT_MESSENGER_CLASSES.audioButton)

  const actions = findCommonAncestor([attachmentLabel, audioButton, submitButton], form)
  if (actions && actions !== form) actions.classList.add('chat-pro-composer-actions')

  if (enhancedComposers.has(textarea)) return
  enhancedComposers.add(textarea)

  syncComposerHeight(textarea)
  textarea.addEventListener('input', () => syncComposerHeight(textarea))

  textarea.addEventListener('keydown', (event) => {
    if (!shouldSubmitChatOnKeydown(event)) return
    event.preventDefault()
    if (!textarea.value.trim() && !form.querySelector('input[type="file"]')?.files?.length) return
    form.requestSubmit()
  })

  form.addEventListener('submit', () => {
    if (viewport) {
      const state = viewportStates.get(viewport)
      if (state) state.forceNextScroll = true
    }
    requestFrame(() => requestFrame(() => syncComposerHeight(textarea)))
  }, true)
}

function enhanceCurrentChats(documentRoot) {
  CHAT_COMPOSER_SELECTORS.forEach((selector) => {
    documentRoot.querySelectorAll(selector).forEach(enhanceComposer)
  })
}

export function installChatEnhancements(documentRoot = globalThis.document) {
  if (!documentRoot?.body || typeof MutationObserver === 'undefined') return () => {}

  enhanceCurrentChats(documentRoot)
  markForceScrollForConversationSelection(documentRoot)

  let queued = false
  const observer = new MutationObserver(() => {
    if (queued) return
    queued = true
    requestFrame(() => {
      queued = false
      enhanceCurrentChats(documentRoot)
    })
  })
  observer.observe(documentRoot.body, { childList: true, subtree: true })

  return () => observer.disconnect()
}

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

export function isNearChatBottom({ scrollHeight = 0, scrollTop = 0, clientHeight = 0 } = {}, threshold = CHAT_SCROLL_THRESHOLD) {
  return Math.max(Number(scrollHeight) - Number(scrollTop) - Number(clientHeight), 0) <= threshold
}

export function shouldSubmitChatOnKeydown(event) {
  const composing = Boolean(event?.isComposing || event?.nativeEvent?.isComposing)
  return event?.key === 'Enter' && !event?.shiftKey && !composing
}

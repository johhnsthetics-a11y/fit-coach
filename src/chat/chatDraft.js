export const CHAT_DRAFT_PREFIX = 'coachfit.chat.draft.v1'

export function getChatDraftKey({ role = 'user', studentId = 'conversation' } = {}) {
  const safe = (value) => encodeURIComponent(String(value || '').trim().toLowerCase().replace(/\.+/g, '-'))
  return `${CHAT_DRAFT_PREFIX}:${safe(role)}:${safe(studentId)}`
}

export function loadChatDraft(storage, context) {
  if (!storage?.getItem) return ''
  try {
    return String(storage.getItem(getChatDraftKey(context)) || '')
  } catch {
    return ''
  }
}

export function saveChatDraft(storage, context, text = '') {
  const value = String(text || '')
  if (!storage) return value

  try {
    const key = getChatDraftKey(context)
    if (value.trim()) storage.setItem?.(key, value)
    else storage.removeItem?.(key)
  } catch {
    // Browsers may deny storage in private or restricted contexts.
  }

  return value
}

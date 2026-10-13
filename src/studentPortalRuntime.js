export const ADMIN_SETTINGS_REFRESH_INTERVAL_MS = 5 * 60 * 1000
export const STUDENT_PORTAL_REFRESH_INTERVAL_MS = 20 * 1000

function getLocalStorage() {
  try {
    return globalThis.window?.localStorage ?? null
  } catch {
    return null
  }
}

export function readLocalStorage(key, fallback = '') {
  try {
    return getLocalStorage()?.getItem(key) ?? fallback
  } catch {
    return fallback
  }
}

export function writeLocalStorage(key, value) {
  try {
    const storage = getLocalStorage()
    if (!storage) return false
    storage.setItem(key, value)
    return true
  } catch {
    return false
  }
}

export function removeLocalStorage(key) {
  try {
    const storage = getLocalStorage()
    if (!storage) return false
    storage.removeItem(key)
    return true
  } catch {
    return false
  }
}

export function shouldRunVisibleRefresh({
  pending = false,
  visibilityState = 'visible',
  lastStartedAt = 0,
  now = Date.now(),
  minimumGapMs = 5_000,
} = {}) {
  return !pending && visibilityState === 'visible' && now - lastStartedAt >= minimumGapMs
}

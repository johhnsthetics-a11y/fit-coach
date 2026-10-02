const DEFAULT_REFRESH_LEEWAY_MS = 60 * 1000

export function shouldRefreshPersistedSession(session, now = Date.now(), leewayMs = DEFAULT_REFRESH_LEEWAY_MS) {
  if (!session?.refresh_token) return false
  if (!session.access_token) return true

  const expiresAt = Number(session.expires_at)
  if (!Number.isFinite(expiresAt) || expiresAt <= 0) return true

  return expiresAt * 1000 <= now + Math.max(0, Number(leewayMs) || 0)
}

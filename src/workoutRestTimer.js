const REST_TIMER_STORAGE_PREFIX = 'coach-fit-pro:workout-rest:v1'
const MAX_REST_SECONDS = 3600

function getBrowserStorage() {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage
  } catch {
    return null
  }
}

export function normalizeRestSeconds(value) {
  const seconds = Math.trunc(Number(value))
  return Number.isFinite(seconds) ? Math.max(0, Math.min(MAX_REST_SECONDS, seconds)) : 0
}

export function getRestTimerStorageKey(studentId, workoutId) {
  const student = String(studentId || '').trim()
  const workout = String(workoutId || '').trim()
  if (!student || !workout) return ''
  return `${REST_TIMER_STORAGE_PREFIX}:${encodeURIComponent(student)}:${encodeURIComponent(workout)}`
}

export function getRestTimerRemainingSeconds(endAtMs, nowMs = Date.now()) {
  const deadline = Number(endAtMs)
  const now = Number(nowMs)
  if (!Number.isFinite(deadline) || !Number.isFinite(now) || deadline <= 0) return 0
  return normalizeRestSeconds(Math.ceil((deadline - now) / 1000))
}

export function readRestTimerSnapshot(key, { nowMs = Date.now(), storage = getBrowserStorage() } = {}) {
  if (!key || !storage) return null
  const readActivityDetails = (value) => ({
    exerciseName: String(value?.exerciseName || '').slice(0, 80),
    nextSetNumber: Math.max(1, Math.trunc(Number(value?.nextSetNumber) || 1)),
    totalSets: Math.max(1, Math.trunc(Number(value?.totalSets) || 1)),
  })
  let stored
  try {
    const serialized = storage.getItem(key)
    if (!serialized) return null
    stored = JSON.parse(serialized)
  } catch {
    clearRestTimerSnapshot(key, { storage })
    return null
  }

  if (!stored || typeof stored !== 'object') {
    clearRestTimerSnapshot(key, { storage })
    return null
  }

  if (stored.paused) {
    const remainingSeconds = normalizeRestSeconds(stored.remainingSeconds)
    if (!remainingSeconds) {
      clearRestTimerSnapshot(key, { storage })
      return null
    }
    return { paused: true, remainingSeconds, endAtMs: 0, activityDetails: readActivityDetails(stored.activityDetails) }
  }

  const endAtMs = Number(stored.endAtMs)
  const remainingSeconds = getRestTimerRemainingSeconds(endAtMs, nowMs)
  if (remainingSeconds > 0) return { paused: false, remainingSeconds, endAtMs, activityDetails: readActivityDetails(stored.activityDetails) }

  clearRestTimerSnapshot(key, { storage })
  return { expired: true, paused: false, remainingSeconds: 0, endAtMs: Number.isFinite(endAtMs) ? endAtMs : 0 }
}

export function writeRestTimerSnapshot(key, snapshot, { storage = getBrowserStorage(), nowMs = Date.now() } = {}) {
  if (!key || !storage) return false
  const paused = Boolean(snapshot?.paused)
  const remainingSeconds = normalizeRestSeconds(snapshot?.remainingSeconds)
  if (!remainingSeconds) {
    clearRestTimerSnapshot(key, { storage })
    return false
  }
  const endAtMs = paused ? 0 : Number(snapshot?.endAtMs)
  if (!paused && (!Number.isFinite(endAtMs) || endAtMs <= Number(nowMs))) return false
  const rawDetails = snapshot?.activityDetails || {}
  const activityDetails = {
    exerciseName: String(rawDetails.exerciseName || '').slice(0, 80),
    nextSetNumber: Math.max(1, Math.trunc(Number(rawDetails.nextSetNumber) || 1)),
    totalSets: Math.max(1, Math.trunc(Number(rawDetails.totalSets) || 1)),
  }
  try {
    storage.setItem(key, JSON.stringify({
      paused,
      remainingSeconds,
      endAtMs,
      activityDetails,
      updatedAt: Number(nowMs),
    }))
    return true
  } catch {
    return false
  }
}

export function clearRestTimerSnapshot(key, { storage = getBrowserStorage() } = {}) {
  if (!key || !storage) return false
  try {
    storage.removeItem(key)
    return true
  } catch {
    return false
  }
}

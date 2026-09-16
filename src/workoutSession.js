const COMPLETION_TOKEN_PATTERN = /^[A-Za-z0-9_-]{12,120}$/

function safeIndex(value) {
  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0
}

function safeSeconds(value) {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : 0
}

function safeObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? JSON.parse(JSON.stringify(value))
    : {}
}

function timestamp(value) {
  const parsed = Date.parse(value || '')
  return Number.isFinite(parsed) ? parsed : 0
}

export function normalizeWorkoutSession(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const completionToken = String(value.completionToken || value.completion_token || '').trim()
  if (!COMPLETION_TOKEN_PATTERN.test(completionToken)) return null

  return {
    id: value.id || '',
    coachId: value.coachId || value.coach_id || '',
    studentId: value.studentId || value.student_id || '',
    workoutId: value.workoutId || value.workout_id || '',
    completionToken,
    status: value.status === 'completed' || value.completedLog ? 'completed' : 'in_progress',
    activeDayIndex: safeIndex(value.activeDayIndex),
    activeExerciseIndex: safeIndex(value.activeExerciseIndex),
    setLogs: safeObject(value.setLogs),
    effort: String(value.effort || 'Moderado'),
    sessionNotes: String(value.sessionNotes || ''),
    durationSeconds: safeSeconds(value.durationSeconds),
    timerStartedAt: String(value.timerStartedAt || ''),
    completedLog: value.completedLog && typeof value.completedLog === 'object' ? safeObject(value.completedLog) : null,
    updatedAt: String(value.updatedAt || value.updated_at || ''),
  }
}

export function mergeWorkoutSession(localValue, remoteValue) {
  const local = normalizeWorkoutSession(localValue)
  const remote = normalizeWorkoutSession(remoteValue)
  if (!local) return remote
  if (!remote) return local
  if (local.studentId && remote.studentId && local.studentId !== remote.studentId) return local
  if (local.workoutId && remote.workoutId && local.workoutId !== remote.workoutId) return local
  if (local.completionToken === remote.completionToken && local.status !== remote.status) {
    return local.status === 'completed' ? local : remote
  }

  if (local.completionToken !== remote.completionToken) {
    if (local.status === 'in_progress' && remote.status === 'completed') return local
    if (remote.status === 'in_progress' && local.status === 'completed') return remote
  }

  return timestamp(remote.updatedAt) > timestamp(local.updatedAt) ? remote : local
}

export function serializeWorkoutSession(value) {
  const session = normalizeWorkoutSession(value)
  if (!session) return null
  return {
    activeDayIndex: session.activeDayIndex,
    activeExerciseIndex: session.activeExerciseIndex,
    setLogs: session.setLogs,
    effort: session.effort,
    sessionNotes: session.sessionNotes,
    durationSeconds: session.durationSeconds,
    timerStartedAt: session.timerStartedAt,
    updatedAt: session.updatedAt,
  }
}

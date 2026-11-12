Warning: truncated output (original token count: 28230)
Total output lines: 2998

import { normalizeProfessionalReferralToken, normalizeProfessionalReferralType } from './professionalReferral'
import {
  formatProtocolDateKey,
  normalizeProtocolTaskDraft,
  protocolTaskFromRow,
  protocolTaskToRow,
} from './protocolTasks'
import { establishStudentPersonalPassword } from './studentFirstPassword'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY
const PHOTO_BUCKET = 'checkin-photos'
const MEAL_PHOTO_BUCKET = 'meal-photos'
const WORKOUT_VIDEO_BUCKET = 'workout-videos'
const MESSAGE_ATTACHMENT_BUCKET = 'message-attachments'
const NUTRITION_PLAN_METADATA_PREFIX = '[coachfitpro-nutrition-meta]'
const WORKOUT_COMPLETION_TOKEN_PATTERN = /\n?\[coachfitpro-completion:[^\]]+\]\s*/g
const WORKOUT_ENDED_EARLY_TOKEN_PATTERN = /\n?\[coachfitpro-ended-early:[^\]]+\]\s*/g
const WORKOUT_ENDED_EARLY_TOKEN_TEST = /\[coachfitpro-ended-early:[^\]]+\]/
export const NUTRITION_RLS_MIGRATION_FILE = '20260909_fix_nutrition_rls_policies.sql'

let sessionToken = ''
let sessionRevision = 0
const avatarUrlCache = new Map()
const messageAttachmentUrlCache = new Map()
const REQUEST_TIMEOUT_MS = 25000
let realtimeClient = null
let realtimeClientPromise = null

export const supabaseEnabled = Boolean(SUPABASE_URL && SUPABASE_KEY)

function shouldLoadStudentPremiumData(portalPayload) {
  return portalPayload?.financial_access_open === true
}

export function setSupabaseSession(token) {
  if (sessionToken !== (token || '')) {
    sessionRevision += 1
    messageAttachmentUrlCache.clear()
  }
  sessionToken = token || ''
}

async function getRealtimeClient() {
  if (!realtimeClient && !realtimeClientPromise && supabaseEnabled) {
    realtimeClientPromise = import('@supabase/supabase-js').then(({ createClient }) => {
      realtimeClient = createClient(SUPABASE_URL, SUPABASE_KEY, {
        auth: {
          autoRefreshToken: false,
          detectSessionInUrl: false,
          persistSession: false,
        },
      })
      return realtimeClient
    })
  }
  return realtimeClient || realtimeClientPromise
}

export async function subscribeRemoteChat({ inviteCode = '', onChange, onStatus } = {}) {
  const client = await getRealtimeClient()
  if (!client) throw new Error('Supabase não configurado')

  let channel = null
  let refreshTimer = 0
  let stopped = false

  const connect = async () => {
    const access = await functionRequest('chat-realtime-token', { inviteCode })
    if (stopped) return
    if (!access?.token || !access?.topic) throw new Error('Não foi possível autorizar a atualização em tempo real.')

    await client.realtime.setAuth(access.token)
    if (channel) await client.removeChannel(channel)
    if (stopped) return

    channel = client
      .channel(access.topic, { config: { private: true } })
      .on('broadcast', { event: 'INSERT' }, (payload) => onChange?.(payload))
      .on('broadcast', { event: 'UPDATE' }, (payload) => onChange?.(payload))
      .on('broadcast', { event: 'DELETE' }, (payload) => onChange?.(payload))
      .subscribe((status) => onStatus?.(status))

    const refreshInMs = Math.max(60_000, (Number(access.expiresAt || 0) * 1000) - Date.now() - (5 * 60_000))
    window.clearTimeout(refreshTimer)
    refreshTimer = window.setTimeout(() => {
      connect().catch((error) => onStatus?.('TOKEN_REFRESH_ERROR', error))
    }, refreshInMs)
  }

  await connect()

  return () => {
    stopped = true
    window.clearTimeout(refreshTimer)
    if (channel) client.removeChannel(channel)
  }
}

function assertCurrentSession(revision) {
  if (revision !== sessionRevision) throw new Error('A sessão mudou. Reabra a tela para continuar.')
}

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  try {
    return await fetch(url, { cache: 'no-store', ...options, signal: controller.signal })
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw new Error('A conexão demorou demais. Verifique sua internet e tente novamente.')
    }
    if (error instanceof TypeError || /failed to fetch|network/i.test(error?.message || '')) {
      throw new Error('Não foi possível conectar ao servidor. Verifique sua internet e tente novamente.')
    }
    throw new Error(error?.message || 'Falha de conexão com o servidor.')
  } finally {
    window.clearTimeout(timeout)
  }
}

function serviceError(status, rawText) {
  let payload = {}
  try {
    payload = JSON.parse(rawText)
  } catch {
    payload = {}
  }

  const code = payload.code || ''
  const original = payload.message || payload.msg || rawText || 'Erro ao acessar Supabase'
  const normalized = original.toLowerCase()

  if (code === 'PGRST303' || normalized.includes('jwt expired')) {
    return new Error('Sua sessão expirou. Entre novamente para continuar. (PGRST303)')
  }
  if (code === '42501' || normalized.includes('row-level security')) {
    return new Error('O banco bloqueou esta operação por falta de permissão. Verifique as políticas de segurança do Supabase. (42501)')
  }
  if (code === 'PGRST202' || normalized.includes('could not find the function')) {
    return new Error('Uma função necessária ainda não foi instalada no Supabase. Execute o SQL correspondente e tente novamente. (PGRST202)')
  }
  if (code === 'PGRST204' || normalized.includes('could not find the') && normalized.includes('column')) {
    return new Error('O banco ainda não possui um campo necessário para esta função. Execute a atualização SQL mais recente. (PGRST204)')
  }
  if (status === 429 || normalized.includes('rate limit')) {
    return new Error('Muitas tentativas em pouco tempo. Aguarde alguns minutos e tente novamente.')
  }
  if (normalized.includes('invalid login credentials')) {
    return new Error('E-mail ou senha incorretos.')
  }
  if (normalized.includes('email not confirmed')) {
    return new Error('Confirme seu e-mail antes de entrar.')
  }
  if (normalized.includes('user already registered')) {
    return new Error('Este e-mail já possui uma conta. Use a opção Entrar.')
  }
  if (normalized.includes('password should be at least')) {
    return new Error('A senha precisa ter pelo menos 6 caracteres.')
  }
  if (status >= 500) {
    return new Error('O serviço está temporariamente indisponível. Tente novamente em alguns instantes.')
  }

  return new Error(`${original}${code ? ` (${code})` : ''}`)
}

function authHeaders(extra = {}) {
  return {
    apikey: SUPABASE_KEY,
    Authorization: `Bearer ${sessionToken || SUPABASE_KEY}`,
    ...extra,
  }
}

async function request(path, options = {}) {
  const revision = sessionRevision
  if (!supabaseEnabled) {
    throw new Error('Supabase não configurado')
  }

  const response = await fetchWithTimeout(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: {
      ...authHeaders({ 'Content-Type': 'application/json' }),
      Prefer: 'return=representation',
      ...(options.headers ?? {}),
    },
  })

  assertCurrentSession(revision)
  if (!response.ok) {
    const message = await response.text()
    throw serviceError(response.status, message)
  }

  if (response.status === 204) return null
  const payload = await response.json()
  assertCurrentSession(revision)
  return payload
}

async function optionalTableRequest(path) {
  try {
    return await request(path)
  } catch (error) {
    if (/PGRST205|relation .* does not exist|table .* not found/i.test(error?.message || '')) {
      return []
    }
    throw error
  }
}

async function optionalTableRequestWithStatus(path) {
  try {
    const rows = await request(path)
    const safeRows = Array.isArray(rows) ? rows : []
    return { rows: safeRows, status: safeRows.length ? 'ready' : 'empty' }
  } catch (error) {
    const missingTable = /PGRST205|relation .* does not exist|table .* not found/i.test(error?.message || '')
    return { rows: [], status: missingTable ? 'unavailable' : 'error' }
  }
}

async function authRequest(path, body) {
  const revision = sessionRevision
  if (!supabaseEnabled) {
    throw new Error('Supabase não configurado')
  }

  const response = await fetchWithTimeout(`${SUPABASE_URL}/auth/v1/${path}`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(body),
  })

  const payload = await response.json().catch(() => ({}))
  assertCurrentSession(revision)

  if (!response.ok) {
    throw serviceError(response.status, JSON.stringify(payload))
  }

  return payload
}

async function rpcRequest(functionName, body) {
  return request(`rpc/${functionName}`, {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function syncRemoteAppleSubscriptionEntitlement(originalTransactionId) {
  return functionRequest('apple-subscription-sync', { originalTransactionId })
}

export async function loadRemoteProfessionalTeamWorkspace() {
  const result = await rpcRequest('get_professional_team_workspace', {})
  return {
    teams: Array.isArray(result?.teams) ? result.teams : [],
    pendingInvites: Array.isArray(result?.pendingInvites) ? result.pendingInvites : [],
  }
}

export async function loadRemoteProfessionalTeamCandidates() {
  const result = await rpcRequest('list_professional_team_candidates', {})
  return Array.isArray(result) ? result : []
}

export async function createRemoteProfessionalTeam(teamName) {
  return rpcRequest('create_professional_team', { team_name: teamName })
}

export async function createRemoteProfessionalTeamInvite(teamId, email, professionalRole) {
  return rpcRequest('create_professional_team_invite', {
    selected_team_id: teamId,
    invitee_email: email,
    expected_professional_role: professionalRole,
  })
}

export async function acceptRemoteProfessionalTeamInvite(inviteId) {
  return rpcRequest('accept_professional_team_invite', { selected_invite_id: inviteId })
}

export async function declineRemoteProfessionalTeamInvite(inviteId) {
  return rpcRequest('decline_professional_team_invite', { selected_invite_id: inviteId })
}

export async function cancelRemoteProfessionalTeamInvite(inviteId) {
  return rpcRequest('cancel_professional_team_invite', { selected_invite_id: inviteId })
}

export async function removeRemoteProfessionalTeamMember(teamId, memberId) {
  return rpcRequest('remove_professional_team_member', {
    selected_team_id: teamId,
    selected_member_id: memberId,
  })
}

export async function leaveRemoteProfessionalTeam(teamId) {
  return rpcRequest('leave_professional_team', { selected_team_id: teamId })
}

export async function setRemoteProfessionalPatientDelegations(teamId, memberId, area, studentIds) {
  return rpcRequest('replace_professional_patient_delegations', {
    selected_team_id: teamId,
    selected_member_id: memberId,
    selected_area: area,
    selected_student_ids: studentIds,
  })
}

export async function revokeRemoteProfessionalPatientDelegation(delegationId) {
  return rpcRequest('revoke_professional_patient_delegation', { selected_delegation_id: delegationId })
}

export async function loadRemoteProfessionalDelegatedWorkspace(area) {
  const result = await rpcRequest('get_professional_delegated_workspace', { selected_area: area })
  if (!Array.isArray(result)) return []
  return result.map((entry) => {
    const sourceStudent = entry?.student || {}
    const student = fromStudentRow({
      id: sourceStudent.id,
      name: sourceStudent.name,
      goal: sourceStudent.goal,
      phase: sourceStudent.phase,
      weight: sourceStudent.weight,
      body_fat: sourceStudent.bodyFat,
      calories: sourceStudent.calories,
      protein: sourceStudent.protein,
    })
    return {
      delegationId: entry.delegationId,
      ownerProfessionalId: entry.ownerProfessionalId,
      ownerName: entry.ownerName || 'Profissional responsável',
      student,
      nutritionPlans: Array.isArray(entry.nutritionPlans) ? entry.nutritionPlans.map(fromNutritionPlanRow) : [],
      workouts: Array.isArray(entry.workouts) ? entry.workouts.map(fromWorkoutRow) : [],
      workoutLogs: Array.isArray(entry.workoutLogs) ? entry.workoutLogs.map(fromWorkoutLogRow) : [],
    }
  }).filter((entry) => entry.student.id)
}

export async function loadRemoteStudentProfessionalCollaborators(inviteCode) {
  const result = await rpcRequest('get_student_professional_collaborators', { invite_code: inviteCode })
  return Array.isArray(result) ? result : []
}

export async function loadRemoteStudentCollaboratorAvatars(inviteCode) {
  const result = await functionRequest('student-avatar', { action: 'student-read', inviteCode })
  return Array.isArray(result?.collaboratorAvatars) ? result.collaboratorAvatars : []
}

export async function loadRemoteCurrentStudentCollaborationRequests() {
  const result = await rpcRequest('get_current_student_collaboration_requests', {})
  return Array.isArray(result) ? result : []
}

export async function respondRemoteStudentCollaboration(delegationId, decision) {
  return rpcRequest('respond_to_professional_collaboration', {
    selected_delegation_id: delegationId,
    decision,
  })
}

export async function saveRemoteCollaborativeNutritionPlan(plan) {
  const result = await rpcRequest('save_collaborative_nutrition_plan', {
    plan: {
      id: isUuid(plan.id) ? plan.id : null,
      student_id: plan.studentId,
      title: plan.title,
      calories: plan.calories,
      protein: plan.protein,
      notes: plan.notes,
      meals: (plan.meals ?? []).map((meal, index) => ({
        id: isUuid(meal.id) ? meal.id : null,
        name: meal.name,
        foods: meal.foods,
        macros: meal.macros,
        time: meal.time,
        order_index: index,
      })),
    },
  })
  const row = Array.isArray(result) ? result[0] : result
  if (!row?.id) throw new Error('O banco não confirmou o salvamento da dieta colaborativa.')
  const normalized = fromNutritionPlanRow(row)
  return {
    ...normalized,
    clientRequestId: plan.clientRequestId,
    createdAt: plan.createdAt || normalized.createdAt,
    meals: normalized.meals.map((meal, index) => ({
      ...meal,
      items: plan.meals?.[index]?.items ?? meal.items ?? [],
    })),
  }
}

export async function saveRemoteCollaborativeWorkout(workout) {
  if ((workout.exercises ?? []).some((exercise) => exercise.videoFile)) {
    throw new Error('Para manter a autorização restrita, remova os arquivos de vídeo e use um link de execução antes de salvar este treino colaborativo.')
  }
  const exercises = Array.isArray(workout.exercises) ? workout.exercises : []
  const requestId = workout.clientRequestId || null
  const result = await rpcRequest('save_collaborative_workout', {
    workout_payload: {
      ...(isUuid(workout.id) ? { id: workout.id } : {}),
      request_id: requestId,
      student_id: workout.studentId,
      title: workout.title,
      focus: workout.focus,
      publication_status: workout.status === 'Rascunho' || workout.publicationStatus === 'draft' ? 'draft' : 'published',
      notes: workout.notes,
      exercises: exercises.map((exercise, index) => ({
        name: exercise.name,
        sets: exercise.sets,
        reps: exercise.reps,
        load: exercise.load,
        rest: exercise.rest,
        muscle_group: exercise.muscleGroup || null,
        equipment: exercise.equipment || null,
        instructions: exercise.instructions || null,
        video_url: exercise.videoUrl || null,
        image_url: exercise.imageUrl || exercise.thumbnailUrl || null,
        external_id: exercise.ascendapiId || exercise.exerciseId || null,
        order_index: index,
      })),
    },
  })
  const row = Array.isArray(result) ? result[0] : result
  if (!row?.id) throw new Error('O banco não confirmou o salvamento do treino colaborativo.')
  return { ...fromWorkoutRow(row), clientRequestId: requestId }
}

async function functionRequest(functionName, body) {
  const revision = sessionRevision
  if (!supabaseEnabled) {
    throw new Error('Supabase não configurado')
  }

  const response = await fetchWithTimeout(`${SUPABASE_URL}/functions/v1/${functionName}`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(body),
  })

  const text = await response.text()
  let payload = {}
  try {
    payload = text ? JSON.parse(text) : {}
  } catch {
    payload = { message: text }
  }
  assertCurrentSession(revision)

  if (!response.ok) {
    throw new Error(payload.error || payload.message || `Erro na função ${functionName}`)
  }

  return payload
}

async function functionFormRequest(functionName, formData) {
  const revision = sessionRevision
  if (!supabaseEnabled) throw new Error('Supabase não configurado')

  const response = await fetchWithTimeout(`${SUPABASE_URL}/functions/v1/${functionName}`, {
    method: 'POST',
    headers: authHeaders(),
    body: formData,
  })
  const text = await response.text()
  let payload = {}
  try {
    payload = text ? JSON.parse(text) : {}
  } catch {
    payload = { message: text }
  }
  assertCurrentSession(revision)
  if (!response.ok) throw new Error(payload.error || payload.message || `Erro na função ${functionName}`)
  return payload
}

function getCachedAvatarUrl(path) {
  const cached = avatarUrlCache.get(String(path || ''))
  return cached && cached.expiresAt > Date.now() ? cached.url : ''
}

function cacheAvatarUrl(path, url) {
  if (!path || !url) return url || ''
  avatarUrlCache.set(String(path), { url, expiresAt: Date.now() + 50 * 60 * 1000 })
  return url
}

async function loadStudentAvatarIdentityByInvite(inviteCode) {
  const payload = await functionRequest('student-avatar', { action: 'student-read', inviteCode })
  return {
    studentAvatarUrl: cacheAvatarUrl(payload.avatarPath, payload.avatarUrl || ''),
    professionalAvatarUrl: cacheAvatarUrl(payload.professionalAvatarPath, payload.professionalAvatarUrl || ''),
    collaboratorAvatars: Array.isArray(payload.collaboratorAvatars) ? payload.collaboratorAvatars : [],
  }
}

async function loadCoachAvatarState() {
  const payload = await functionRequest('student-avatar', { action: 'coach-read' })
  return {
    studentUrls: new Map((payload.avatars ?? []).map((avatar) => [
      String(avatar.studentId),
      cacheAvatarUrl(avatar.avatarPath, avatar.avatarUrl),
    ])),
    professionalAvatarUrl: cacheAvatarUrl(payload.professionalAvatarPath, payload.professionalAvatarUrl || ''),
  }
}

export async function signUpCoach({ name, email, password, role = 'Coach principal' }) {
  const payload = await authRequest('signup', {
    email,
    password,
    data: { name, role },
  })

  if (!payload.access_token) {
    throw new Error('Conta criada. Confirme o e-mail na sua caixa de entrada e depois entre com e-mail e senha.')
  }

  setSupabaseSession(payload.access_token)
  return toSession(payload, name, email, role)
}

export async function signInCoach({ email, password }) {
  const payload = await authRequest('token?grant_type=password', {
    email,
    password,
  })

  setSupabaseSession(payload.access_token)
  return toSession(payload)
}

export async function generateRemoteStudentCredentials(studentId) {
  if (!isUuid(studentId)) throw new Error('Selecione um aluno ou paciente válido para gerar o acesso.')
  return functionRequest('student-credentials', { action: 'generate', studentId })
}

export async function loadRemoteCurrentStudentAccess() {
  const result = await rpcRequest('get_current_student_access', {})
  const row = Array.isArray(result) ? result[0] : result
  if (!row?.student_id || !row?.invite_code) return null
  return {
    studentId: row.student_id,
    inviteCode: row.invite_code,
    mustChangePassword: row.must_change_password === true,
    email: row.email ?? '',
    professionalType: row.professional_type ?? 'trainer',
  }
}

export async function completeRemoteStudentFirstPassword(password, currentEmail = '') {
  return establishStudentPersonalPassword({
    password,
    currentEmail,
    updateAuthenticatedPassword: (nextPassword) => updatePasswordWithAccessToken(sessionToken, nextPassword),
    signInWithPassword: ({ email, password: nextPassword }) => signInCoach({ email, password: nextPassword }),
    finalizeFirstAccess: () => functionRequest('student-credentials', {
      action: 'complete-first-password',
    }),
  })
}

export async function signOutCoach(accessToken) {
  if (!supabaseEnabled || !accessToken) return
  const response = await fetchWithTimeout(`${SUPABASE_URL}/auth/v1/logout`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${accessToken}`,
    },
  })
  if (!response.ok && response.status !== 401) {
    const message = await response.text()
    throw serviceError(response.status, message)
  }
}

export async function requestCoachPasswordReset(email) {
  const redirectUrl = new URL('/login', window.location.origin)
  redirectUrl.searchParams.set('mode', 'recovery')
  await authRequest(`recover?redirect_to=${encodeURIComponent(redirectUrl.toString())}`, { email })
}

async function updatePasswordWithAccessToken(accessToken, password) {
  if (!supabaseEnabled) {
    throw new Error('Supabase não configurado')
  }
  if (!accessToken) {
    throw new Error('Sua sessão expirou. Entre novamente para alterar a senha.')
  }

  const response = await fetchWithTimeout(`${SUPABASE_URL}/auth/v1/user`, {
    method: 'PUT',
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ password }),
  })

  const responseText = await response.text()
  let payload = {}
  try {
    payload = responseText ? JSON.parse(responseText) : {}
  } catch {
    payload = {}
  }

  if (!response.ok) {
    throw serviceError(response.status, responseText)
  }

  const email = String(payload?.email || '').trim().toLowerCase()
  if (!email) {
    throw new Error('A senha foi atualizada, mas não foi possível confirmar a conta.')
  }

  return { email }
}

export async function updateRecoveredPassword(accessToken, password) {
  return updatePasswordWithAccessToken(accessToken, password)
}

export async function verifyRecoveredPasswordChange(email, password) {
  const normalizedEmail = String(email || '').trim().toLowerCase()
  if (!normalizedEmail || !password) {
    throw new Error('Não foi possível validar a nova senha.')
  }

  const payload = await authRequest('token?grant_type=password', {
    email: normalizedEmail,
    password,
  })

  if (!payload?.access_token) {
    throw new Error('A nova senha não pôde ser validada.')
  }

  await signOutCoach(payload.access_token).catch(() => {})
  return true
}

export async function deleteRemoteCoachAccount({ email, confirmation }) {
  const normalizedEmail = String(email || '').trim().toLowerCase()
  const normalizedConfirmation = String(confirmation || '').trim().toLowerCase()

  if (!normalizedEmail || normalizedConfirmation !== normalizedEmail) {
    throw new Error('Confirme a exclusao digitando exatamente o e-mail da conta.')
  }

  return functionRequest('delete-coach-account', {
    email: normalizedEmail,
    confirmation: normalizedConfirmation,
    requestedAt: new Date().toISOString(),
  })
}

export async function deleteRemoteStudentAccount({ email, confirmation }) {
  const normalizedEmail = String(email || '').trim().toLowerCase()
  const normalizedConfirmation = String(confirmation || '').trim().toLowerCase()

  if (!normalizedEmail || normalizedConfirmation !== normalizedEmail) {
    throw new Error('Confirme a exclusao digitando exatamente o e-mail da conta.')
  }

  return functionRequest('delete-coach-account', {
    email: normalizedEmail,
    confirmation: normalizedConfirmation,
    requestedAt: new Date().toISOString(),
  })
}

export async function refreshCoachSession(refreshToken) {
  if (!refreshToken) {
    throw new Error('Sessão sem token de renovação')
  }

  const payload = await authRequest('token?grant_type=refresh_token', {
    refresh_token: refreshToken,
  })

  setSupabaseSession(payload.access_token)
  return toSession(payload)
}

export async function loadRemoteData(currentUserId = '') {
  if (!isUuid(currentUserId)) {
    throw new Error('Sessão profissional não identificada. Entre novamente para continuar.')
  }
  const revision = sessionRevision
  const [users, students, checkins, notifications, workouts, nutritionPlans, workoutLogs, messages, appointments, invoices, assessments, coachSettings, invites, anamneses, coachSubscriptions, exerciseLibrary, workoutProgressionDecisions, appAdminSettings, professionalAffiliate] = await Promise.all([
    request(`users?select=*&id=eq.${encodeURIComponent(currentUserId)}&limit=1`),
    request('students?select=*&order=created_at.desc'),
    request('checkins?select=*,checkin_photos(*)&order=created_at.desc'),
    request('notifications?select=*&order=created_at.desc'),
    request('workouts?select=*,workout_exercises(*)&order=created_at.desc'),
    request('nutrition_plans?select=*,nutrition_meals(*)&order=created_at.desc'),
    request('workout_logs?select=*&order=completed_at.desc'),
    request('messages?select=*&order=created_at.desc'),
    request('appointments?select=*&order=starts_at.asc'),
    request('invoices?select=*&order=due_date.desc'),
    request('assessments?select=*&order=assessed_at.desc'),
    request('coach_settings?select=*&limit=1'),
    request('student_invites?select=*&order=created_at.desc'),
    request('student_anamneses?select=*&order=submitted_at.desc'),
    optionalTableRequest('coach_subscriptions?select=*&limit=1'),
    optionalTableRequestWithStatus('exercise_library?select=*&active=eq.true&order=muscle_group.asc,name.asc'),
    optionalTableRequest('workout_progression_decisions?select=*&order=created_at.desc'),
    loadRemoteAppAdminSettings().catch(() => null),
    loadRemoteCurrentProfessionalAffiliate().catch(() => false),
  ])

  const questionnaires = await loadRemoteQuestionnaires()
  const hydratedCheckins = await Promise.all(checkins.map(hydrateCheckinRow))
  const hydratedMessages = await Promise.all(messages.map(hydrateMessageRow))
  const hydratedWorkouts = await Promise.all(workouts.map(hydrateWorkoutRow))
  const coachAvatarState = students.some((student) => student.avatar_path) || coachSettings[0]?.profile_avatar_path
    ? await loadCoachAvatarState().catch(() => ({ studentUrls: new Map(), professionalAvatarUrl: '' }))
    : { studentUrls: new Map(), professionalAvatarUrl: '' }
  assertCurrentSession(revision)

  return {
    ...questionnaires,
    user: users[0] ? fromUserRow(users[0]) : null,
    students: students.map((student) => fromStudentRow(student, coachAvatarState.studentUrls.get(String(student.id)) || '')),
    checkins: hydratedCheckins,
    notifications: notifications.map(fromNotificationRow),
    workouts: hydratedWorkouts,
    nutritionPlans: nutritionPlans.map(fromNutritionPlanRow),
    workoutLogs: workoutLogs.map(fromWorkoutLogRow),
    messages: hydratedMessages,
    appointments: appointments.map(fromAppointmentRow),
    invoices: invoices.map(fromInvoiceRow),
    assessments: assessments.map(fromAssessmentRow),
    coachSettings: coachSettings[0] ? fromCoachSettingsRow(coachSettings[0], coachAvatarState.professionalAvatarUrl) : null,
    invites: invites.map(fromInviteRow),
    anamneses: anamneses.map(fromAnamnesisRow),
    coachSubscription: coachSubscriptions[0] ? fromCoachSubscriptionRow(coachSubscriptions[0]) : null,
    exerciseLibrary: exerciseLibrary.rows.map(fromExerciseLibraryRow),
    exerciseLibrarySync: { status: exerciseLibrary.status, remoteCount: exerciseLibrary.rows.length },
    workoutProgressionDecisions: workoutProgressionDecisions.map(fromWorkoutProgressionDecisionRow),
    appAdminSettings,
    professionalAffiliate,
  }
}

export async function loadRemoteProtocolTasks(coachId, { fromDate = '', toDate = '' } = {}) {
  if (!isUuid(coachId)) throw new Error('Profissional não identificado para carregar as tarefas.')
  if ((fromDate && !formatProtocolDateKey(fromDate)) || (toDate && !formatProtocolDateKey(toDate))) {
    throw new Error('O período selecionado contém uma data inválida.')
  }
  if (fromDate && toDate && fromDate > toDate) throw new Error('A data inicial deve ser anterior à data final.')

  const params = [
    'select=*',
    `coach_id=eq.${encodeURIComponent(coachId)}`,
    ...(fromDate ? [`planned_date=gte.${encodeURIComponent(fromDate)}`] : []),
    ...(toDate ? [`planned_date=lte.${encodeURIComponent(toDate)}`] : []),
    'order=planned_date.asc,created_at.asc',
  ]
  const rows = await request(`coach_protocol_tasks?${params.join('&')}`)
  return rows.map(protocolTaskFromRow)
}

export async function saveRemoteProtocolTask(task, coachId) {
  if (!isUuid(coachId)) throw new Error('Profissional não identificado para salvar a tarefa.')
  const payload = protocolTaskToRow(task, coachId)
  const isUpdating = Boolean(task?.id)
  const path = isUpdating
    ? `coach_protocol_tasks?id=eq.${encodeURIComponent(payload.id)}&coach_id=eq.${encodeURIComponent(coachId)}`
    : 'coach_protocol_tasks'
  const rows = await request(path, {
    method: isUpdating ? 'PATCH' : 'POST',
    body: JSON.stringify(payload),
  })
  if (!rows?.[0]) throw new Error('A tarefa não foi encontrada ou não pôde ser salva. Atualize a lista e tente novamente.')
  return protocolTaskFromRow(rows[0])
}

export async function deleteRemoteProtocolTask(taskId, coachId) {
  if (!isUuid(taskId) || !isUuid(coachId)) throw new Error('Tarefa ou profissional inválido para exclusão.')
  const rows = await request(
    `coach_protocol_tasks?id=eq.${encodeURIComponent(taskId)}&coach_id=eq.${encodeURIComponent(coachId)}`,
    { method: 'DELETE' },
  )
  if (!rows?.length) throw new Error('A tarefa não foi encontrada ou não pôde ser excluída.')
  return true
}

export async function loadRemoteCurrentProfessionalAffiliate() {
  const result = await rpcRequest('coachfit_current_professional_is_affiliate', {})
  return result === true
}

export async function loadRemoteAppAdminSettings() {
  const rows = await optionalTableRequest('app_admin_settings?select=*&key=eq.global&limit=1')
  return rows[0]?.settings || null
}

export async function saveRemoteAppAdminSettings(settings) {
  const rows = await request('app_admin_settings?on_conflict=key', {
    method: 'POST',
    body: JSON.stringify({
      key: 'global',
      settings,
      updated_at: new Date().toISOString(),
    }),
    headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
  })
  return rows[0]?.settings || settings
}

function fromStudentFreeAccessGrant(row = {}) {
  return {
    id: row.id ?? '',
    email: row.email ?? '',
    beneficiaryType: row.beneficiary_type ?? row.beneficiaryType ?? 'student',
    reason: row.reason ?? '',
    active: row.active === true,
    createdByEmail: row.created_by_email ?? row.createdByEmail ?? '',
    createdAt: row.created_at ?? row.createdAt ?? '',
    updatedAt: row.updated_at ?? row.updatedAt ?? '',
    revokedAt: row.revoked_at ?? row.revokedAt ?? '',
    revokedByEmail: row.revoked_by_email ?? row.revokedByEmail ?? '',
    matchedProfiles: Number(row.matched_profiles ?? row.matchedProfiles ?? 0),
  }
}

export async function loadRemoteStudentFreeAccessGrants() {
  const result = await rpcRequest('coachfit_list_student_free_access_grants', {})
  return (Array.isArray(result) ? result : []).map(fromStudentFreeAccessGrant)
}

export async function grantRemoteStudentFreeAccess({ email, beneficiaryType = 'student', reason = '' }) {
  const normalizedEmail = String(email || '').trim().toLowerCase()
  if (!normalizedEmail) throw new Error('Informe o e-mail do aluno ou paciente.')
  const result = await rpcRequest('coachfit_grant_student_free_access', {
    p_email: normalizedEmail,
    p_beneficiary_type: beneficiaryType,
    p_reason: String(reason || '').trim(),
  })
  return fromStudentFreeAccessGrant(Array.isArray(result) ? result[0] : result)
}

export async function revokeRemoteStudentFreeAccess(email) {
  const normalizedEmail = String(email || '').trim().toLowerCase()
  if (!normalizedEmail) throw new Error('Selecione uma liberação válida para revogar.')
  const result = await rpcRequest('coachfit_revoke_student_free_access', { p_email: normalizedEmail })
  return fromStudentFreeAccessGrant(Array.isArray(result) ? result[0] : result)
}

export async function loadRemoteAffiliateFinanceReport(startDate = '', endDate = '') {
  const today = new Date().toLocaleDateString('sv-SE')
  const currentMonthStart = `${today.slice(0, 7)}-01`
  const normalizedStart = /^\d{4}-\d{2}-\d{2}$/.test(String(startDate || '').trim())
    ? String(startDate).trim()
    : currentMonthStart
  const normalizedEnd = /^\d{4}-\d{2}-\d{2}$/.test(String(endDate || '').trim())
    ? String(endDate).trim()
    : today

  const result = await rpcRequest('get_affiliate_finance_report', {
    p_start_date: normalizedStart,
    p_end_date: normalizedEnd,
  })

  return result && typeof result === 'object' ? result : {
    period: { startDate: normalizedStart, endDate: normalizedEnd },
    monthlyFeeCents: 2500,
    commissionRate: 0.25,
    commissionPerPaidInstallmentCents: 625,
    totals: {
      affiliateCount: 0,
      studentsBrought: 0,
      newStudentsInPeriod: 0,
      paidStudents: 0,
      paidInstallments: 0,
      revenueCents: 0,
      commissionCents: 0,
    },
    affiliates: [],
  }
}

export async function loadRemoteProfessionalCommissionReport(startDate = '', endDate = '') {
  const today = new Date().toLocaleDateString('sv-SE')
  const fallbackStart = new Date()
  fallbackStart.setDate(fallbackStart.getDate() - 29)
  const normalizedStart = /^\d{4}-\d{2}-\d{2}$/.test(String(startDate || '').trim())
    ? String(startDate).trim()
    : fallbackStart.toLocaleDateString('sv-SE')
  const normalizedEnd = /^\d{4}-\d{2}-\d{2}$/.test(String(endDate || '').trim())
    ? String(endDate).trim()
    : today

  const result = await rpcRequest('get_my_commission_report', {
    p_start_date: normalizedStart,
    p_end_date: normalizedEnd,
  })

  return result && typeof result === 'object' ? result : {
    period: { startDate: normalizedStart, endDate: normalizedEnd },
    monthlyFeeCents: 2500,
    commissionRate: 0.25,
    commissionPerPaidInstallmentCents: 625,
    totals: {
      paidClients: 0,
      paidInstallments: 0,
      revenueCents: 0,
      commissionCents: 0,
    },
    clients: [],
  }
}

export async function createRemoteProfessionalReferral({ email, professionalType } = {}) {
  const normalizedEmail = String(email || '').trim().toLowerCase()
  const normalizedType = normalizeProfessionalReferralType(professionalType)
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    throw new Error('Informe um e-mail válido do treinador ou nutricionista.')
  }
  if (!normalizedType) {
    throw new Error('Selecione treinador ou nutricionista.')
  }

  return rpcRequest('create_affiliate_professional_referral', {
    p_referred_email: normalizedEmail,
    p_professional_type: normalizedType,
  })
}

export async function claimRemoteProfessionalReferral(token) {
  const normalizedToken = normalizeProfessionalReferralToken(token)
  if (!normalizedToken) return { ok: false, errorCode: 'invalid_token' }
  return rpcRequest('claim_affiliate_professional_referral', { p_token: normalizedToken })
}

export async function cancelRemoteProfessionalReferral(referralId) {
  referralId = String(referralId || '').trim()
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(referralId)) {
    throw new Error('Convite profissional inválido.')
  }
  return rpcRequest('cancel_affiliate_professional_referral', { p_referral_id: referralId })
}

export async function loadRemoteProfessionalReferrals() {
  const result = await rpcRequest('get_my_professional_referrals', {})
  return result && typeof result === 'object' ? result : { referrals: [] }
}

export async function loadRemoteAffiliateCommissionDashboard(month = '') {
  const normalizedMonth = /^\d{4}-\d{2}$/.test(String(month || '').trim())
    ? `${String(month).trim()}-01`
    : new Date().toLocaleDateString('sv-SE').slice(0, 7) + '-01'
  const result = await rpcRequest('get_affiliate_commission_dashboard', { p_month: normalizedMonth })
  return result && typeof result === 'object' ? result : {
    month: normalizedMonth.slice(0, 7),
    monthlyFeeCents: 2500,
    commissionRate: 0.25,
    commissionPerPaidInstallmentCents: 625,
    totals: {
      studentsBrought: 0,
      paidStudents: 0,
      paidInstallments: 0,
      revenueCents: 0,
      commissionCents: 0,
    },
    affiliates: [],
  }
}

export async function loadRemoteAffiliateProfessionals() {
  const rows = await optionalTableRequest('affiliate_professionals?select=*&order=created_at.desc')
  return rows.map((row) => ({
    id: row.id,
    email: String(row.email || '').trim().toLowerCase(),
    professionalType: row.professional_type === 'nutritionist' ? 'nutritionist' : 'trainer',
    active: row.active !== false,
    createdAt: row.created_at ?? '',
    updatedAt: row.updated_at ?? '',
  }))
}

export async function loadRemoteProfessionalProfileByEmail(email = '') {
  const normalizedEmail = String(email || '').trim().toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) return null

  const rows = await request(`users?select=id,name,email,role&email=eq.${encodeURIComponent(normalizedEmail)}&limit=1`)
  const row = rows?.[0]
  if (!row?.id) return null

  return {
    coachId: row.id,
    name: row.name || normalizedEmail,
    email: String(row.email || normalizedEmail).trim().toLowerCase(),
    professionalType: /nutri/i.test(String(row.role || '')) ? 'nutritionist' : 'trainer',
  }
}

export async function saveRemoteAffiliateProfessional({ id = '', email = '', professionalType = '', active = true } = {}) {
  const normalizedEmail = String(email || '').trim().toLowerCase()
  const normalizedType = normalizeProfessionalReferralType(professionalType)
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    throw new Error('Informe um e-mail válido do treinador ou nutricionista.')
  }
  if (!normalizedType) {
    throw new Error('Selecione se o profissional é treinador ou nutricionista.')
  }

  const body = {
    email: normalizedEmail,
    professional_type: normalizedType,
    active: active !== false,
    updated_at: new Date().toISOString(),
  }

  const rows = id
    ? await request(`affiliate_professionals?id=eq.${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    })
    : await request('affiliate_professionals?on_conflict=email', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
    })

  const row = rows?.[0]
  return row ? {
    id: row.id,
    email: String(row.email || '').trim().toLowerCase(),
    professionalType: row.professional_type === 'nutritionist' ? 'nutritionist' : 'trainer',
    active: row.active !== false,
    createdAt: row.created_at ?? '',
    updatedAt: row.updated_at ?? '',
  } : null
}

export async function deleteRemoteAffiliateProfessional(id) {
  if (!isUuid(id)) throw new Error('Cadastro de afiliado inválido.')
  await request(`affiliate_professionals?id=eq.${encodeURIComponent(id)}`, { method: 'DELETE' })
}

export async function loadRemoteLeadEvents(limit = 120) {
  const rows = await optionalTableRequest(`lead_events?select=*&order=created_at.desc&limit=${encodeURIComponent(limit)}`)
  return rows.map(fromLeadEventRow)
}

export async function saveRemoteLeadEvent(event) {
  const rows = await request('lead_events', {
    method: 'POST',
    body: JSON.stringify(toLeadEventRow(event)),
  })
  return rows?.[0] ? fromLeadEventRow(rows[0]) : e…8230 tokens truncated…w new Error(active ? 'Não foi possível confirmar a restauração da dieta no banco.' : 'Não foi possível confirmar o arquivamento da dieta no banco.')
  }
  return fromNutritionPlanRow(rows[0])
}

export async function saveRemoteWorkoutLog(log) {
  if (log.inviteCode) {
    if (!log.completionToken) throw new Error('Não foi possível identificar esta sessão de treino. Inicie o treino novamente.')
    const result = await rpcRequest('complete_student_workout_session', {
      invite_code: log.inviteCode,
      selected_workout_id: isUuid(log.workoutId) ? log.workoutId : null,
      workout_title: log.title,
      effort_value: log.effort,
      notes_value: log.notes,
      completion_token: log.completionToken,
      duration_seconds_value: Math.max(0, Number(log.durationSeconds) || 0),
      execution_value: log.execution && typeof log.execution === 'object' ? log.execution : {},
    })
    const payload = Array.isArray(result) ? result[0] : result
    return fromWorkoutLogRow(payload?.workout_log || payload)
  }

  const rows = await request('workout_logs', {
    method: 'POST',
    body: JSON.stringify({
      coach_id: log.coachId,
      student_id: log.studentId,
      workout_id: isUuid(log.workoutId) ? log.workoutId : null,
      title: log.title,
      effort: log.effort,
      notes: log.notes,
    }),
  })

  return fromWorkoutLogRow(rows[0])
}

export async function saveRemoteWorkoutEarlyEnd(log) {
  if (!log?.inviteCode) throw new Error('Não foi possível identificar o acesso desta sessão.')
  if (!log?.completionToken) throw new Error('Não foi possível identificar esta sessão de treino. Inicie o treino novamente.')

  const result = await rpcRequest('end_student_workout_session', {
    invite_code: log.inviteCode,
    selected_workout_id: isUuid(log.workoutId) ? log.workoutId : null,
    workout_title: log.title,
    effort_value: log.effort,
    notes_value: log.notes,
    completion_token: log.completionToken,
    duration_seconds_value: Math.max(0, Number(log.durationSeconds) || 0),
    execution_value: log.execution && typeof log.execution === 'object' ? log.execution : {},
  })
  const payload = Array.isArray(result) ? result[0] : result
  return { ...fromWorkoutLogRow(payload?.workout_log || payload), endedEarly: true }
}

function fromWorkoutSessionRow(row) {
  if (!row || typeof row !== 'object') return null
  const execution = row.execution && typeof row.execution === 'object' && !Array.isArray(row.execution) ? row.execution : {}
  return {
    ...execution,
    id: row.id || '',
    coachId: row.coach_id || '',
    studentId: row.student_id || '',
    workoutId: row.workout_id || '',
    completionToken: row.completion_token || '',
    status: row.status || 'in_progress',
    updatedAt: row.updated_at || execution.updatedAt || '',
  }
}

export async function saveRemoteWorkoutRating(inviteCode, workoutLogId, rating, feedback = '') {
  if (!inviteCode || !isUuid(workoutLogId)) throw new Error('Não foi possível identificar o treino concluído.')
  const value = Number(rating)
  if (!Number.isInteger(value) || value < 1 || value > 5) throw new Error('Escolha uma avaliação entre uma e cinco estrelas.')
  const result = await rpcRequest('rate_student_workout_log_with_feedback', {
    invite_code: inviteCode,
    selected_workout_log_id: workoutLogId,
    rating_value: value,
    feedback_value: String(feedback || '').trim().slice(0, 500),
  })
  const payload = Array.isArray(result) ? result[0] : result
  return fromWorkoutLogRow(payload?.workout_log || payload)
}

export async function loadRemoteStudentMealLogs(inviteCode) {
  if (!inviteCode) throw new Error('Não foi possível identificar o acesso do aluno.')
  const result = await rpcRequest('get_student_meal_logs', { invite_code: inviteCode })
  const rows = Array.isArray(result) ? result : Array.isArray(result?.meal_logs) ? result.meal_logs : []
  return Promise.all(rows.slice(0, 6).map(async (row) => {
    const mealLog = fromStudentMealLogRow(row)
    const photoUrl = mealLog.id ? await signStudentMealPhoto(inviteCode, mealLog.id).catch(() => '') : ''
    return { ...mealLog, photoUrl }
  }))
}

export async function saveRemoteStudentMealLog(inviteCode, mealLog) {
  if (!inviteCode) throw new Error('Não foi possível identificar o acesso do aluno.')
  const mealName = String(mealLog?.mealName || '').trim()
  const note = String(mealLog?.notes || '').trim()
  const photoFile = mealLog?.photoFile
  const photoMime = String(photoFile?.type || '').toLowerCase()
  const extensionByMime = {
    'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp',
    'image/heic': 'heic', 'image/heif': 'heif', 'image/avif': 'avif',
  }
  const photoExtension = extensionByMime[photoMime]
  if (!mealName || mealName.length > 80 || note.length > 240) throw new Error('Confira o nome e a observação da refeição.')
  if (!photoFile || !photoExtension || photoFile.size < 1 || photoFile.size > 10 * 1024 * 1024) {
    throw new Error('Escolha uma foto compatível e otimizada com até 10 MB.')
  }
  const result = await rpcRequest('create_student_meal_log', {
    invite_code: inviteCode,
    selected_nutrition_plan_id: isUuid(mealLog?.nutritionPlanId) ? mealLog.nutritionPlanId : null,
    meal_name: mealName,
    note_value: note,
    photo_mime_value: photoMime,
    photo_size_bytes_value: photoFile.size,
    photo_extension: photoExtension,
  })
  const payload = Array.isArray(result) ? result[0] : result
  const row = payload?.meal_log || payload
  if (!row?.id || !row?.photo_path) throw new Error('O servidor não confirmou o registro da refeição.')
  try {
    await uploadStudentMealPhoto(photoFile, inviteCode, row.id)
  } catch (uploadError) {
    await removeStudentMealPhotoObject(inviteCode, row.id).catch(() => {})
    await rpcRequest('delete_student_meal_log', {
      invite_code: inviteCode,
      selected_meal_log_id: row.id,
    }).catch(() => {})
    throw uploadError
  }
  const photoUrl = await signStudentMealPhoto(inviteCode, row.id).catch(() => '')
  return { ...fromStudentMealLogRow(row), photoUrl }
}

export async function loadRemoteWorkoutSession(inviteCode, workoutId) {
  if (!inviteCode || !isUuid(workoutId)) return null
  const result = await rpcRequest('get_student_workout_session', {
    invite_code: inviteCode,
    selected_workout_id: workoutId,
  })
  return fromWorkoutSessionRow(Array.isArray(result) ? result[0] : result)
}

export async function saveRemoteWorkoutSession(inviteCode, workoutId, completionToken, execution) {
  if (!inviteCode || !isUuid(workoutId)) return null
  const result = await rpcRequest('save_student_workout_session', {
    invite_code: inviteCode,
    selected_workout_id: workoutId,
    completion_token: completionToken,
    execution_value: execution && typeof execution === 'object' ? execution : {},
  })
  return fromWorkoutSessionRow(Array.isArray(result) ? result[0] : result)
}

export async function updateRemoteMessage(messageId, body) {
  if (!isUuid(messageId)) throw new Error('Mensagem inválida.')
  const safeBody = String(body || '').trim()
  if (!safeBody) throw new Error('A mensagem não pode ficar vazia.')
  const rows = await request(`messages?id=eq.${encodeURIComponent(messageId)}&sender=eq.coach&deleted_at=is.null`, {
    method: 'PATCH',
    body: JSON.stringify({ body: safeBody }),
  })
  if (!rows?.[0]) throw new Error('Mensagem não encontrada, apagada ou sem permissão para editar.')
  return hydrateMessageRow(rows[0])
}

export async function deleteRemoteMessage(messageId) {
  if (!isUuid(messageId)) throw new Error('Mensagem inválida.')
  const encodedId = encodeURIComponent(messageId)
  const deletedAt = new Date().toISOString()
  const rows = await request(`messages?id=eq.${encodedId}&sender=eq.coach&deleted_at=is.null`, {
    method: 'PATCH',
    body: JSON.stringify({
      body: 'Mensagem apagada',
      attachment_url: null,
      attachment_type: null,
      attachment_name: null,
      deleted_at: deletedAt,
    }),
  })
  if (rows?.[0]) return hydrateMessageRow(rows[0])

  const existingRows = await request(`messages?id=eq.${encodedId}&sender=eq.coach&select=*`)
  if (existingRows?.[0]?.deleted_at) return hydrateMessageRow(existingRows[0])
  throw new Error('Mensagem não encontrada ou sem permissão para apagar.')
}

export async function updateRemoteStudentMessage(inviteCode, messageId, body) {
  if (!inviteCode || !isUuid(messageId)) throw new Error('Mensagem inválida.')
  const safeBody = String(body || '').trim()
  if (!safeBody) throw new Error('A mensagem não pode ficar vazia.')
  const result = await rpcRequest('update_student_message', {
    invite_code: inviteCode,
    selected_message_id: messageId,
    message_body: safeBody,
  })
  return hydrateMessageRow(Array.isArray(result) ? result[0] : result, { inviteCode })
}

export async function deleteRemoteStudentMessage(inviteCode, messageId) {
  if (!inviteCode || !isUuid(messageId)) throw new Error('Mensagem inválida.')
  const result = await rpcRequest('delete_student_message', {
    invite_code: inviteCode,
    selected_message_id: messageId,
  })
  const saved = Array.isArray(result) ? result[0] : result
  if (!saved?.id) throw new Error('Mensagem não encontrada ou sem permissão para apagar.')
  return hydrateMessageRow(saved, { inviteCode })
}

export async function saveRemoteMessage(message) {
  // Avoid orphaned media while blocked; SQL and the upload Edge Function
  // independently enforce this even for requests made outside the app.
  if (message.attachmentFile) {
    const safety = await loadRemoteChatSafetyStatus(message.studentId, message.inviteCode || '')
    if (safety?.blocked) throw new Error('Conversa bloqueada. Desbloqueie antes de enviar arquivos.')
  }
  const attachmentUrl = message.attachmentFile
    ? await uploadMessageAttachment(message.attachmentFile, message.studentId, message.inviteCode, message.clientMessageId)
    : message.attachmentUrl || ''
  const attachmentType = message.attachmentFile?.type || message.attachmentType || ''
  const attachmentName = message.attachmentFile?.name || message.attachmentName || ''
  const body = message.body?.trim() || (attachmentUrl ? (attachmentType.startsWith('audio/') ? 'Áudio enviado' : 'Foto enviada') : '')

  if (message.inviteCode && message.sender === 'student') {
    const result = message.messageKind === 'workout_completion'
      ? await rpcRequest('submit_student_workout_completion_message', {
        invite_code: message.inviteCode,
        message_body: body,
        client_message_id: message.clientMessageId || null,
      })
      : await rpcRequest('submit_student_message', {
        invite_code: message.inviteCode,
        message_body: body,
        attachment_url: attachmentUrl || null,
        attachment_type: attachmentType || null,
        attachment_name: attachmentName || null,
        client_message_id: message.clientMessageId || null,
      })
    return hydrateMessageRow(Array.isArray(result) ? result[0] : result, { inviteCode: message.inviteCode })
  }

  const rows = await request('messages?on_conflict=id', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
    body: JSON.stringify({
      id: message.clientMessageId || undefined,
      coach_id: message.coachId,
      student_id: message.studentId,
      sender: message.sender,
      body,
      read: Boolean(message.read),
      attachment_url: attachmentUrl || null,
      attachment_type: attachmentType || null,
      attachment_name: attachmentName || null,
    }),
  })

  return hydrateMessageRow(rows[0])
}

async function uploadMessageAttachment(file, studentId, inviteCode = '', clientMessageId = '') {
  const messageId = clientMessageId || crypto.randomUUID()
  const formData = new FormData()
  formData.append('file', file)
  formData.append('studentId', studentId || '')
  formData.append('inviteCode', inviteCode || '')
  formData.append('messageId', messageId)
  const payload = await functionFormRequest('message-attachment', formData)
  if (!payload?.path) throw new Error('O servidor não confirmou o envio do anexo.')
  return payload.path
}

export async function assignRemoteStudentAnamnesis({ questionnaireId, studentId, scheduledFor, priorityRequired }) {
  return fromQuestionnaireAssignmentRow(await rpcRequest('assign_student_anamnesis', {
    selected_questionnaire_id: questionnaireId,
    selected_student_id: studentId,
    scheduled_for_value: scheduledFor ? new Date(scheduledFor).toISOString() : new Date().toISOString(),
    priority_required_value: Boolean(priorityRequired),
  }))
}

export async function markRemoteStudentMessagesRead(studentId) {
  if (!isUuid(studentId)) return
  await request(`messages?student_id=eq.${studentId}&sender=eq.student&read=eq.false`, {
    method: 'PATCH',
    body: JSON.stringify({ read: true }),
  })
}

export async function saveRemoteAppointment(appointment, coachId) {
  const rows = await request('appointments', {
    method: 'POST',
    body: JSON.stringify({
      coach_id: coachId,
      student_id: appointment.studentId,
      title: appointment.title,
      appointment_type: appointment.type,
      starts_at: appointment.startsAt,
      duration_minutes: Number(appointment.durationMinutes || 30),
      status: appointment.status || 'Agendado',
      location: appointment.location,
      notes: appointment.notes,
    }),
  })

  return fromAppointmentRow(rows[0])
}

export async function updateRemoteAppointmentStatus(appointmentId, status) {
  if (!isUuid(appointmentId)) return null

  const rows = await request(`appointments?id=eq.${appointmentId}`, {
    method: 'PATCH',
    body: JSON.stringify({
      status,
      updated_at: new Date().toISOString(),
    }),
  })

  return rows[0] ? fromAppointmentRow(rows[0]) : null
}

export async function saveRemoteInvoice(invoice, coachId) {
  const rows = await request('invoices', {
    method: 'POST',
    body: JSON.stringify({
      coach_id: coachId,
      student_id: invoice.studentId,
      plan_name: invoice.planName,
      description: invoice.description,
      amount_cents: Math.round(Number(invoice.amount || 0) * 100),
      due_date: invoice.dueDate,
      status: invoice.status || 'Pendente',
      payment_method: invoice.paymentMethod || null,
      paid_at: invoice.status === 'Pago' ? new Date().toISOString() : null,
    }),
  })

  return fromInvoiceRow(rows[0])
}

export async function updateRemoteInvoiceStatus(invoiceId, status, paymentMethod = '') {
  if (!isUuid(invoiceId)) return null

  const rows = await request(`invoices?id=eq.${invoiceId}`, {
    method: 'PATCH',
    body: JSON.stringify({
      status,
      payment_method: paymentMethod || null,
      paid_at: status === 'Pago' ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    }),
  })

  return rows[0] ? fromInvoiceRow(rows[0]) : null
}

export async function saveRemoteAssessment(assessment, coachId) {
  const rows = await request('assessments', {
    method: 'POST',
    body: JSON.stringify({
      coach_id: coachId,
      student_id: assessment.studentId,
      assessed_at: assessment.assessedAt,
      weight_kg: nullableNumber(assessment.weightKg),
      height_cm: nullableNumber(assessment.heightCm),
      body_fat_percent: nullableNumber(assessment.bodyFatPercent),
      waist_cm: nullableNumber(assessment.waistCm),
      abdomen_cm: nullableNumber(assessment.abdomenCm),
      hip_cm: nullableNumber(assessment.hipCm),
      chest_cm: nullableNumber(assessment.chestCm),
      arm_cm: nullableNumber(assessment.armCm),
      thigh_cm: nullableNumber(assessment.thighCm),
      calf_cm: nullableNumber(assessment.calfCm),
      resting_heart_rate: nullableNumber(assessment.restingHeartRate),
      notes: assessment.notes,
    }),
  })

  return fromAssessmentRow(rows[0])
}

export async function saveRemoteCoachSettings(settings, coachId) {
  const rows = await request('coach_settings?on_conflict=coach_id', {
    method: 'POST',
    body: JSON.stringify({
      coach_id: coachId,
      brand_name: settings.brandName,
      public_name: settings.publicName,
      cref: settings.cref,
      whatsapp: settings.whatsapp,
      support_email: settings.supportEmail,
      pix_key: settings.pixKey,
      profile_avatar_path: settings.profileAvatarPath || null,
      billing_logo_url: settings.billingLogoUrl,
      billing_primary_color: settings.billingPrimaryColor,
      billing_accent_color: settings.billingAccentColor,
      billing_message: settings.billingMessage,
      custom_plans: settings.customPlans || [],
      welcome_message: settings.welcomeMessage,
      timezone: settings.timezone || 'America/Sao_Paulo',
      updated_at: new Date().toISOString(),
    }),
    headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
  })

  return fromCoachSettingsRow(rows[0])
}

function toSession(payload, fallbackName, fallbackEmail, fallbackRole = 'Coach principal') {
  const user = payload.user ?? {}
  const metadata = user.user_metadata ?? {}
  const appMetadata = user.app_metadata ?? {}

  return {
    access_token: payload.access_token ?? '',
    refresh_token: payload.refresh_token ?? '',
    expires_at: payload.expires_at ?? Math.floor(Date.now() / 1000) + Number(payload.expires_in ?? 3600),
    expires_in: payload.expires_in ?? 3600,
    user: {
      id: user.id,
      name: metadata.name || fallbackName || user.email || 'Coach',
      email: user.email || fallbackEmail,
      role: metadata.role || fallbackRole || 'Coach principal',
      accountType: appMetadata.account_type || '',
    },
  }
}

function fromUserRow(row) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role ?? 'Coach principal',
    createdAt: row.created_at,
  }
}

function fromLeadEventRow(row) {
  return {
    id: row.id,
    type: row.event_type,
    email: row.email ?? '',
    planId: row.plan_id ?? '',
    attribution: row.attribution ?? {},
    metadata: row.metadata ?? {},
    createdAt: row.created_at,
  }
}

function toLeadEventRow(event = {}) {
  return {
    event_type: event.type || event.eventType || 'visit',
    email: event.email || event.metadata?.email || null,
    plan_id: event.planId || event.metadata?.planId || null,
    attribution: event.attribution || {},
    metadata: event.metadata || {},
    created_at: event.createdAt || new Date().toISOString(),
  }
}

function fromCoachSubscriptionRow(row) {
  return {
    id: row.id,
    coachId: row.coach_id,
    status: row.status ?? 'trial',
    startedAt: row.started_at,
    firstBillingAt: row.first_billing_at,
    nextBillingAt: row.next_billing_at,
    firstMonthPrice: Number(row.first_month_price_cents ?? 990) / 100,
    regularPrice: Number(row.regular_price_cents ?? 4990) / 100,
    maintenanceRate: Number(row.maintenance_rate ?? 0),
    provider: row.provider ?? 'cartpanda',
    providerCustomerId: row.provider_customer_id ?? '',
    providerSubscriptionId: row.provider_subscription_id ?? '',
    providerOrderId: row.provider_order_id ?? '',
    paidAt: row.paid_at ?? null,
    currentPeriodStartedAt: row.current_period_started_at ?? null,
    currentPeriodEndsAt: row.current_period_ends_at ?? null,
    checkoutFirstMonthUrl: row.checkout_first_month_url ?? '',
    checkoutRegularUrl: row.checkout_regular_url ?? '',
  }
}

function toUserRow(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role ?? 'Coach principal',
  }
}

function requireCoachId(coachId) {
  if (!isUuid(coachId)) {
    throw new Error('Sessão do treinador não identificada. Saia e entre novamente antes de cadastrar alunos.')
  }
  return coachId
}

function fromStudentRow(row, avatarUrl = '') {
  return {
    id: row.id,
    name: row.name ?? '',
    email: row.email ?? '',
    phone: row.phone ?? '',
    cpf: row.cpf ?? '',
    goal: row.goal ?? '',
    phase: row.phase ?? '',
    status: row.status ?? 'Em dia',
    plan: row.plan ?? 'Acompanhamento mensal',
    payment: row.payment ?? 'Pendente',
    appPaymentStatus: row.app_payment_status ?? 'pending',
    billingCycle: row.billing_cycle ?? 'mensal',
    firstDueDate: row.first_due_date ?? '',
    nextDueDate: row.next_due_date ?? '',
    appSubscriptionStartedAt: row.app_subscription_started_at ?? '',
    appSubscriptionExpiresAt: row.app_subscription_expires_at ?? '',
    adherence: Number(row.adherence ?? 0),
    risk: row.risk ?? 'Baixo',
    nextCheckin: row.next_checkin ?? '',
    weight: row.weight ?? '',
    bodyFat: row.body_fat ?? '',
    calories: row.calories ?? '',
    protein: row.protein ?? '',
    workout: row.workout ?? '',
    lastMessage: row.last_message ?? '',
    requireAnamnesis: row.require_anamnesis !== false,
    notifyCoachOnWorkoutFinish: row.notify_coach_on_workout_finish !== false,
    accessOverrideUntil: row.access_override_until ?? '',
    loadNotes: row.load_notes ?? '',
    waterGoalMl: row.water_goal_ml ?? '',
    avatarPath: row.avatar_path ?? '',
    photo: avatarUrl || getCachedAvatarUrl(row.avatar_path),
    authUserId: row.auth_user_id ?? '',
    mustChangePassword: row.must_change_password === true,
    credentialsGeneratedAt: row.credentials_generated_at ?? '',
  }
}

function toStudentRow(student, coachId) {
  return {
    coach_id: requireCoachId(coachId),
    name: student.name,
    email: student.email,
    phone: student.phone,
    cpf: student.cpf || null,
    goal: student.goal,
    phase: student.phase,
    status: student.status,
    plan: student.plan,
    payment: student.payment,
    billing_cycle: student.billingCycle || 'mensal',
    first_due_date: student.firstDueDate || null,
    next_due_date: student.nextDueDate || student.firstDueDate || null,
    adherence: Number(student.adherence || 0),
    risk: student.risk,
    next_checkin: student.nextCheckin,
    weight: student.weight,
    body_fat: student.bodyFat,
    calories: student.calories,
    protein: student.protein,
    workout: student.workout,
    last_message: student.lastMessage,
    require_anamnesis: student.requireAnamnesis !== false,
    notify_coach_on_workout_finish: student.notifyCoachOnWorkoutFinish !== false,
    access_override_until: student.accessOverrideUntil || null,
    load_notes: student.loadNotes || null,
    water_goal_ml: nullableNumber(student.waterGoalMl),
  }
}

function fromCheckinRow(row) {
  const photo = row.checkin_photos?.[0]

  return {
    id: row.id,
    studentId: row.student_id,
    type: row.type ?? '',
    due: row.due_label ?? '',
    state: row.state ?? 'Pendente',
    weight: row.weight ?? '',
    note: row.note ?? '',
    createdAt: row.created_at ?? '',
    photo: photo?.signed_url ?? photo?.storage_url ?? '',
    photoPath: photo?.storage_url ? extractStoragePath(photo.storage_url) : '',
  }
}

async function hydrateCheckinRow(row) {
  const photo = row.checkin_photos?.[0]
  if (!photo?.storage_url) return fromCheckinRow(row)

  const signedUrl = await signCheckinPhoto(photo.storage_url).catch(() => '')
  return fromCheckinRow({
    ...row,
    checkin_photos: [{ ...photo, signed_url: signedUrl }],
  })
}

async function signCheckinPhoto(storageValue) {
  return signStorageObject(PHOTO_BUCKET, storageValue, 60 * 60)
}

async function hydrateMessageRow(row, { inviteCode = '' } = {}) {
  const message = fromMessageRow(row)
  if (!message.attachmentUrl) return message

  const rawUrl = String(message.attachmentUrl || '')
  if (/^https?:\/\//i.test(rawUrl) && !rawUrl.includes('/storage/v1/object/')) return message

  const path = extractStoragePath(rawUrl, MESSAGE_ATTACHMENT_BUCKET)
  if (!path) return message

  const cacheKey = `${inviteCode || `session-${sessionRevision}`}:${message.id}:${path}`
  const cached = messageAttachmentUrlCache.get(cacheKey)
  let signedUrl = cached?.expiresAt > Date.now() ? cached.url : ''
  if (!signedUrl) {
    const payload = await functionRequest('message-attachment', {
      action: 'sign',
      inviteCode,
      messageId: message.id,
      attachmentPath: path,
    }).catch(() => null)
    signedUrl = payload?.signedUrl || ''
    if (signedUrl) {
      messageAttachmentUrlCache.set(cacheKey, { url: signedUrl, expiresAt: Date.now() + (12 * 60 * 1000) })
    }
  }

  return {
    ...message,
    attachmentPath: path,
    attachmentUrl: signedUrl,
  }
}

async function hydrateWorkoutRow(row) {
  const workout = fromWorkoutRow(row)
  const exercises = await Promise.all(workout.exercises.map(async (exercise) => {
    const path = extractStoragePath(exercise.videoUrl, WORKOUT_VIDEO_BUCKET)
    if (!path || /^https?:\/\//i.test(path)) return exercise

    const signedUrl = await signStorageObject(WORKOUT_VIDEO_BUCKET, path, 60 * 60).catch(() => '')
    return {
      ...exercise,
      videoPath: path,
      videoUrl: signedUrl || exercise.videoUrl,
    }
  }))

  return { ...workout, exercises }
}

async function signStorageObject(bucket, storageValue, expiresIn = 3600) {
  if (/^https?:\/\//i.test(String(storageValue || '')) && !String(storageValue).includes('/storage/v1/object/')) {
    return String(storageValue)
  }

  const path = extractStoragePath(storageValue, bucket)
  if (!path) return ''

  const response = await fetchWithTimeout(
    `${SUPABASE_URL}/storage/v1/object/sign/${bucket}/${encodeStoragePath(path)}`,
    {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ expiresIn }),
    },
  )

  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw serviceError(response.status, JSON.stringify(payload))
  }

  const signedPath = payload.signedURL || payload.signedUrl || ''
  if (!signedPath) return ''
  return signedPath.startsWith('http') ? signedPath : `${SUPABASE_URL}${signedPath}`
}

function extractStoragePath(value, bucket = PHOTO_BUCKET) {
  if (!value) return ''
  const normalized = String(value)
  if (!/^https?:\/\//i.test(normalized) && !normalized.includes('/storage/v1/object/')) {
    return normalized.replace(/^\/+/, '')
  }

  const publicMarker = `/storage/v1/object/public/${bucket}/`
  const signedMarker = `/storage/v1/object/sign/${bucket}/`

  if (normalized.includes(publicMarker)) {
    return decodeURIComponent(normalized.split(publicMarker)[1].split('?')[0])
  }

  if (normalized.includes(signedMarker)) {
    return decodeURIComponent(normalized.split(signedMarker)[1].split('?')[0])
  }

  return normalized
}

function encodeStoragePath(path) {
  return path.split('/').map(encodeURIComponent).join('/')
}


function toCheckinRow(checkin) {
  return {
    student_id: checkin.studentId,
    type: checkin.type,
    due_label: checkin.due,
    state: checkin.state,
    weight: checkin.weight,
    note: checkin.note,
  }
}

function fromNotificationRow(row) {
  return {
    id: row.id,
    title: row.title,
    body: row.body ?? '',
    read: Boolean(row.read),
    eventType: row.event_type ?? '',
    entityId: row.entity_id ?? '',
    studentId: row.student_id ?? '',
    createdAt: row.created_at ?? '',
  }
}

function fromInviteRow(row) {
  return {
    id: row.id,
    coachId: row.coach_id,
    studentId: row.student_id,
    code: row.code,
    status: row.status,
    expiresAt: row.expires_at,
  }
}

function fromAnamnesisRow(row) {
  const answers = row.answers && typeof row.answers === 'object' ? row.answers : {}
  return {
    id: row.id,
    coachId: row.coach_id,
    studentId: row.student_id,
    inviteId: row.invite_id,
    answers,
    birthDate: row.birth_date ?? answers.birthDate ?? '',
    biologicalSex: row.biological_sex ?? answers.biologicalSex ?? answers.gender ?? '',
    gender: row.gender ?? row.sex ?? row.biological_sex ?? answers.biologicalSex ?? answers.gender ?? '',
    heightCm: row.height_cm ?? answers.heightCm ?? '',
    weightKg: row.weight_kg ?? answers.weightKg ?? '',
    activityLevel: row.activity_level ?? answers.activityLevel ?? '',
    occupation: row.occupation || answers.occupation || '',
    trainingExperience: row.training_experience || answers.trainingExperience || '',
    trainingFrequency: row.training_frequency || answers.trainingFrequency || '',
    primaryGoal: row.primary_goal || answers.primaryGoal || '',
    injuries: row.injuries || answers.injuries || '',
    healthConditions: row.health_conditions || answers.healthConditions || '',
    medications: row.medications || answers.medications || '',
    surgeries: row.surgeries || answers.surgeries || '',
    pain: row.pain || answers.pain || '',
    sleepHours: row.sleep_hours || answers.sleepHours || '',
    sleepQuality: row.sleep_quality || answers.sleepQuality || '',
    stressLevel: row.stress_level || answers.stressLevel || '',
    waterIntake: row.water_intake || answers.waterIntake || '',
    foodRestrictions: row.food_restrictions || answers.foodRestrictions || '',
    routine: row.routine || answers.routine || '',
    observations: row.observations || answers.observations || '',
    emergencyContact: row.emergency_contact || answers.emergencyContact || '',
    source: row.source || 'student',
    authoredBy: row.authored_by ?? '',
    studentUpdateRequestedAt: row.student_update_requested_at ?? '',
    submittedAt: row.submitted_at ?? row.created_at,
    updatedAt: row.updated_at ?? row.submitted_at ?? row.created_at,
  }
}

function fromWorkoutRow(row) {
  const workoutMetadata = parseWorkoutMetadata(row.notes)
  const explicitPublicationStatus = String(row.publication_status || '').trim().toLowerCase()
  const publicationStatus = ['draft', 'published', 'archived'].includes(explicitPublicationStatus)
    ? explicitPublicationStatus
    : row.active === false ? 'archived' : 'published'
  return {
    id: row.id,
    coachId: row.coach_id,
    studentId: row.student_id,
    createdBy: row.created_by ?? row.coach_id,
    updatedBy: row.updated_by ?? row.coach_id,
    collaborationDelegationId: row.collaboration_delegation_id ?? '',
    title: row.title ?? '',
    focus: row.focus ?? '',
    notes: stripWorkoutMetadata(row.notes ?? ''),
    level: workoutMetadata.level ?? '',
    frequency: workoutMetadata.frequency ?? '',
    organization: workoutMetadata.organization ?? '',
    displayMode: workoutMetadata.displayMode ?? '',
    guidance: workoutMetadata.guidance ?? '',
    allowStudentPdfDownload: Boolean(workoutMetadata.allowStudentPdfDownload),
    days: Array.isArray(workoutMetadata.days) ? workoutMetadata.days : undefined,
    publicationStatus,
    status: publicationStatus === 'draft' ? 'Rascunho' : publicationStatus === 'archived' ? 'Arquivado' : 'Publicado',
    active: publicationStatus === 'published' && row.active !== false,
    createdAt: row.created_at ?? '',
    updatedAt: row.updated_at ?? row.created_at ?? '',
    exercises: (row.workout_exercises ?? [])
      .slice()
      .sort((a, b) => Number(a.order_index ?? 0) - Number(b.order_index ?? 0))
      .map((exercise) => ({
        id: exercise.id,
        name: exercise.name ?? '',
        sets: exercise.sets ?? '',
        reps: exercise.reps ?? '',
        load: exercise.load ?? '',
        rest: exercise.rest ?? '',
        muscleGroup: exercise.muscle_group ?? '',
        primaryMuscle: exercise.primary_muscle ?? '',
        secondaryMuscles: Array.isArray(exercise.secondary_muscles) ? exercise.secondary_muscles : [],
        equipment: exercise.equipment ?? '',
        instructions: exercise.instructions ?? '',
        videoUrl: exercise.video_url ?? '',
        imageUrl: exercise.image_url ?? '',
        thumbnailUrl: exercise.image_url ?? '',
        ascendapiId: exercise.external_id ?? '',
      })),
  }
}

function fromExerciseLibraryRow(row) {
  const sourcePayload = row.source_payload && typeof row.source_payload === 'object' && !Array.isArray(row.source_payload)
    ? row.source_payload
    : {}
  const rowProvider = String(row.provider || '').trim()
  const payloadProvider = String(sourcePayload.provider || '').trim()
  const provider = String(
    rowProvider && rowProvider.toLocaleLowerCase('pt-BR') !== 'coachfit'
      ? rowProvider
      : payloadProvider || rowProvider || 'coachfit',
  ).trim() || 'coachfit'
  return {
    id: row.id,
    name: row.name ?? '',
    group: row.muscle_group ?? row.group_name ?? '',
    primaryMuscle: row.primary_muscle ?? '',
    secondaryMuscles: Array.isArray(row.secondary_muscles) ? row.secondary_muscles : [],
    equipment: row.equipment ?? '',
    cues: row.instructions ?? row.cues ?? '',
    videoUrl: row.video_url ?? '',
    thumbnailUrl: row.thumbnail_url ?? row.image_url ?? '',
    imageUrl: row.image_url ?? row.thumbnail_url ?? '',
    externalId: row.external_id ?? row.exercise_id ?? '',
    exerciseId: row.external_id ?? row.exercise_id ?? '',
    muscleMap: row.muscle_map ?? '',
    aliases: Array.isArray(row.aliases) ? row.aliases : [],
    category: row.category ?? sourcePayload.category ?? sourcePayload.exercise_category ?? sourcePayload.category_name ?? '',
    objective: row.objective ?? sourcePayload.objective ?? sourcePayload.goal ?? sourcePayload.training_goal ?? '',
    goal: row.goal ?? sourcePayload.goal ?? sourcePayload.objective ?? sourcePayload.training_goal ?? '',
    provider,
    source: provider,
  }
}

function fromWorkoutProgressionDecisionRow(row) {
  return {
    id: row.id,
    coachId: row.coach_id,
    studentId: row.student_id,
    workoutId: row.workout_id,
    exerciseName: row.exercise_name ?? '',
    action: row.action ?? '',
    suggestion: row.suggestion ?? '',
    reason: row.reason ?? '',
    confidence: row.confidence ?? '',
    status: row.status ?? '',
    previousTarget: row.previous_target ?? {},
    nextTarget: row.next_target ?? {},
    source: row.source ?? 'local_rules',
    createdAt: row.created_at,
  }
}

function fromNutritionPlanRow(row) {
  const metadata = parseNutritionPlanMetadata(row.notes)
  return {
    id: row.id,
    coachId: row.coach_id,
    studentId: row.student_id,
    createdBy: row.created_by ?? row.coach_id,
    updatedBy: row.updated_by ?? row.coach_id,
    collaborationDelegationId: row.collaboration_delegation_id ?? '',
    title: row.title ?? '',
    calories: row.calories ?? '',
    protein: row.protein ?? '',
    notes: stripNutritionPlanMetadata(row.notes ?? ''),
    allowPatientPdfDownload: metadata.allowPatientPdfDownload === true,
    active: row.active !== false,
    meals: (row.nutrition_meals ?? [])
      .slice()
      .sort((a, b) => Number(a.order_index ?? 0) - Number(b.order_index ?? 0))
      .map((meal, index) => ({
        id: meal.id,
        name: meal.name ?? '',
        foods: meal.foods ?? '',
        macros: meal.macros ?? '',
        time: meal.time_label ?? '',
        items: metadata.meals?.find((item) => String(item.id) === String(meal.id))?.items ?? metadata.meals?.[index]?.items ?? [],
      })),
  }
}

function parseNutritionPlanMetadata(notes = '') {
  const markerIndex = String(notes || '').indexOf(NUTRITION_PLAN_METADATA_PREFIX)
  if (markerIndex < 0) return {}
  try {
    return JSON.parse(String(notes).slice(markerIndex + NUTRITION_PLAN_METADATA_PREFIX.length).trim()) || {}
  } catch {
    return {}
  }
}

function stripNutritionPlanMetadata(notes = '') {
  const markerIndex = String(notes || '').indexOf(NUTRITION_PLAN_METADATA_PREFIX)
  return markerIndex >= 0 ? String(notes).slice(0, markerIndex).trim() : String(notes || '')
}

function fromWorkoutLogRow(row) {
  const rawNotes = String(row.notes ?? '')
  return {
    id: row.id,
    coachId: row.coach_id,
    studentId: row.student_id,
    workoutId: row.workout_id,
    title: row.title ?? '',
    effort: row.effort ?? '',
    notes: rawNotes
      .replace(WORKOUT_COMPLETION_TOKEN_PATTERN, '')
      .replace(WORKOUT_ENDED_EARLY_TOKEN_PATTERN, '')
      .trim(),
    completedAt: row.completed_at ?? row.created_at,
    endedEarly: WORKOUT_ENDED_EARLY_TOKEN_TEST.test(rawNotes),
    rating: Number(row.rating) >= 1 && Number(row.rating) <= 5 ? Number(row.rating) : 0,
    ratingFeedback: String(row.rating_feedback ?? ''),
    ratedAt: row.rated_at ?? '',
  }
}

function fromStudentMealLogRow(row) {
  return {
    id: row?.id || '',
    coachId: row?.coach_id || '',
    studentId: row?.student_id || '',
    nutritionPlanId: row?.nutrition_plan_id || '',
    mealName: row?.meal_name || '',
    notes: row?.note || '',
    mealDate: row?.meal_date || '',
    recordedAt: row?.recorded_at || row?.created_at || '',
    photoPath: row?.photo_path || '',
    photoMime: row?.photo_mime || '',
    photoSizeBytes: Number(row?.photo_size_bytes) || 0,
  }
}

function fromMessageRow(row) {
  const deletedAt = row.deleted_at ?? ''
  return {
    id: row.id,
    coachId: row.coach_id,
    studentId: row.student_id,
    sender: row.sender ?? 'coach',
    messageKind: row.message_kind ?? 'chat',
    body: deletedAt ? 'Mensagem apagada' : (row.body ?? ''),
    read: Boolean(row.read),
    attachmentUrl: deletedAt ? '' : (row.attachment_url ?? ''),
    attachmentType: deletedAt ? '' : (row.attachment_type ?? ''),
    attachmentName: deletedAt ? '' : (row.attachment_name ?? ''),
    deletedAt,
    createdAt: row.created_at,
  }
}

function fromAppointmentRow(row) {
  return {
    id: row.id,
    coachId: row.coach_id,
    studentId: row.student_id,
    title: row.title ?? '',
    type: row.appointment_type ?? 'Consulta',
    startsAt: row.starts_at,
    durationMinutes: Number(row.duration_minutes ?? 30),
    status: row.status ?? 'Agendado',
    location: row.location ?? '',
    notes: row.notes ?? '',
  }
}

function fromInvoiceRow(row) {
  return {
    id: row.id,
    coachId: row.coach_id,
    studentId: row.student_id,
    planName: row.plan_name ?? '',
    description: row.description ?? '',
    amount: Number(row.amount_cents ?? 0) / 100,
    dueDate: row.due_date,
    status: row.status ?? 'Pendente',
    paymentMethod: row.payment_method ?? '',
    paidAt: row.paid_at,
    createdAt: row.created_at,
  }
}

function fromAssessmentRow(row) {
  return {
    id: row.id,
    coachId: row.coach_id,
    studentId: row.student_id,
    assessedAt: row.assessed_at,
    weightKg: nullableNumber(row.weight_kg),
    heightCm: nullableNumber(row.height_cm),
    bodyFatPercent: nullableNumber(row.body_fat_percent),
    waistCm: nullableNumber(row.waist_cm),
    abdomenCm: nullableNumber(row.abdomen_cm),
    hipCm: nullableNumber(row.hip_cm),
    chestCm: nullableNumber(row.chest_cm),
    armCm: nullableNumber(row.arm_cm),
    thighCm: nullableNumber(row.thigh_cm),
    calfCm: nullableNumber(row.calf_cm),
    restingHeartRate: nullableNumber(row.resting_heart_rate),
    notes: row.notes ?? '',
  }
}

function fromCoachSettingsRow(row, professionalAvatarUrl = '') {
  return {
    coachId: row.coach_id,
    brandName: row.brand_name ?? 'FitCoach',
    publicName: row.public_name ?? '',
    cref: row.cref ?? '',
    whatsapp: row.whatsapp ?? '',
    supportEmail: row.support_email ?? '',
    pixKey: row.pix_key ?? '',
    profileAvatarPath: row.profile_avatar_path ?? '',
    profilePhotoUrl: professionalAvatarUrl || getCachedAvatarUrl(row.profile_avatar_path),
    billingLogoUrl: row.billing_logo_url ?? '',
    billingPrimaryColor: row.billing_primary_color ?? '#10b981',
    billingAccentColor: row.billing_accent_color ?? '#0f172a',
    billingMessage: row.billing_message ?? '',
    customPlans: Array.isArray(row.custom_plans) ? row.custom_plans : [],
    welcomeMessage: row.welcome_message ?? '',
    timezone: row.timezone ?? 'America/Sao_Paulo',
  }
}

function nullableNumber(value) {
  if (value === '' || value === null || value === undefined) return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

function createInviteCode() {
  return crypto.randomUUID().replaceAll('-', '')
}

function isUuid(value) {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

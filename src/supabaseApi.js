const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY
const PHOTO_BUCKET = 'checkin-photos'
const WORKOUT_VIDEO_BUCKET = 'workout-videos'
const MESSAGE_ATTACHMENT_BUCKET = 'message-attachments'

let sessionToken = ''
const REQUEST_TIMEOUT_MS = 25000

export const supabaseEnabled = Boolean(SUPABASE_URL && SUPABASE_KEY)

export function setSupabaseSession(token) {
  sessionToken = token || ''
}

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  try {
    return await fetch(url, { ...options, signal: controller.signal })
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

  if (!response.ok) {
    const message = await response.text()
    throw serviceError(response.status, message)
  }

  if (response.status === 204) return null
  return response.json()
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

async function authRequest(path, body) {
  if (!supabaseEnabled) {
    throw new Error('Supabase não configurado')
  }

  const response = await fetchWithTimeout(`${SUPABASE_URL}/auth/v1/${path}`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(body),
  })

  const payload = await response.json().catch(() => ({}))

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

export async function signUpCoach({ name, email, password }) {
  const payload = await authRequest('signup', {
    email,
    password,
    data: { name },
  })

  if (!payload.access_token) {
    throw new Error('Conta criada. Confirme o e-mail na sua caixa de entrada e depois entre com e-mail e senha.')
  }

  setSupabaseSession(payload.access_token)
  return toSession(payload, name, email)
}

export async function signInCoach({ email, password }) {
  const payload = await authRequest('token?grant_type=password', {
    email,
    password,
  })

  setSupabaseSession(payload.access_token)
  return toSession(payload)
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
  const redirectTo = `${window.location.origin}${window.location.pathname}`
  await authRequest(`recover?redirect_to=${encodeURIComponent(redirectTo)}`, { email })
}

export async function updateRecoveredPassword(accessToken, password) {
  if (!supabaseEnabled) {
    throw new Error('Supabase não configurado')
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

  if (!response.ok) {
    const message = await response.text()
    throw serviceError(response.status, message)
  }
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

export async function loadRemoteData() {
  const [users, students, checkins, notifications, workouts, nutritionPlans, workoutLogs, messages, appointments, invoices, assessments, coachSettings, invites, anamneses, coachSubscriptions, appAdminSettings] = await Promise.all([
    request('users?select=*&order=created_at.desc&limit=1'),
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
    loadRemoteAppAdminSettings().catch(() => null),
  ])

  const hydratedCheckins = await Promise.all(checkins.map(hydrateCheckinRow))

  return {
    user: users[0] ? fromUserRow(users[0]) : null,
    students: students.map(fromStudentRow),
    checkins: hydratedCheckins,
    notifications: notifications.map(fromNotificationRow),
    workouts: workouts.map(fromWorkoutRow),
    nutritionPlans: nutritionPlans.map(fromNutritionPlanRow),
    workoutLogs: workoutLogs.map(fromWorkoutLogRow),
    messages: messages.map(fromMessageRow),
    appointments: appointments.map(fromAppointmentRow),
    invoices: invoices.map(fromInvoiceRow),
    assessments: assessments.map(fromAssessmentRow),
    coachSettings: coachSettings[0] ? fromCoachSettingsRow(coachSettings[0]) : null,
    invites: invites.map(fromInviteRow),
    anamneses: anamneses.map(fromAnamnesisRow),
    coachSubscription: coachSubscriptions[0] ? fromCoachSubscriptionRow(coachSubscriptions[0]) : null,
    appAdminSettings,
  }
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


export async function loadRemoteAdminOverview() {
  const [users, subscriptions] = await Promise.all([
    optionalTableRequest('users?select=*&order=created_at.desc'),
    optionalTableRequest('coach_subscriptions?select=*&order=updated_at.desc'),
  ])

  return {
    users: users.map(fromUserRow),
    subscriptions: subscriptions.map(fromCoachSubscriptionRow),
  }
}

export async function updateRemoteAdminCoachSubscription(input = {}) {
  if (!isUuid(input.coachId)) return null

  const now = new Date().toISOString()
  const payload = {
    coach_id: input.coachId,
    status: input.status || 'active',
    updated_at: now,
  }

  if (input.nextBillingAt !== undefined) payload.next_billing_at = input.nextBillingAt || null
  if (input.currentPeriodEndsAt !== undefined) payload.current_period_ends_at = input.currentPeriodEndsAt || null
  if (input.paidAt !== undefined) payload.paid_at = input.paidAt || null
  if (input.provider !== undefined) payload.provider = input.provider || 'manual_admin'

  const rows = await request('coach_subscriptions?on_conflict=coach_id', {
    method: 'POST',
    body: JSON.stringify(payload),
    headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
  })

  return rows[0] ? fromCoachSubscriptionRow(rows[0]) : null
}

export async function loadRemoteMessages(studentId = '') {
  const filter = studentId ? `&student_id=eq.${encodeURIComponent(studentId)}` : ''
  const rows = await request(`messages?select=*${filter}&order=created_at.desc`)
  return rows.map(fromMessageRow)
}

export async function loadRemoteStudentMessages(studentId) {
  if (!isUuid(studentId)) return []
  return loadRemoteMessages(studentId)
}

export async function loadRemoteStudentMessagesByInvite(inviteCode) {
  if (!inviteCode) return []
  const result = await rpcRequest('get_student_messages', { invite_code: inviteCode })
  return (Array.isArray(result) ? result : []).map(fromMessageRow)
}

export async function upsertRemoteUser(user) {
  const rows = await request('users?on_conflict=id', {
    method: 'POST',
    body: JSON.stringify(toUserRow(user)),
    headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
  })

  return fromUserRow(rows[0])
}

export async function saveRemoteStudent(student, coachId) {
  const row = toStudentRow(student, coachId)
  const method = isUuid(student.id) ? 'PATCH' : 'POST'
  const path = method === 'PATCH' ? `students?id=eq.${student.id}` : 'students'
  const rows = await request(path, {
    method,
    body: JSON.stringify(row),
  })

  return fromStudentRow(rows[0])
}

export async function deleteRemoteStudent(studentId) {
  if (!isUuid(studentId)) return
  const checkins = await request(
    `checkins?student_id=eq.${studentId}&select=checkin_photos(storage_url)`,
  )
  const photoPaths = checkins.flatMap((checkin) => (
    (checkin.checkin_photos ?? []).map((photo) => photo.storage_url).filter(Boolean)
  ))

  if (photoPaths.length) {
    const response = await fetchWithTimeout(`${SUPABASE_URL}/storage/v1/object/${PHOTO_BUCKET}`, {
      method: 'DELETE',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ prefixes: photoPaths }),
    })
    if (!response.ok) {
      const message = await response.text()
      throw serviceError(response.status, message || 'Erro ao excluir fotos do aluno')
    }
  }

  await request(`students?id=eq.${studentId}`, { method: 'DELETE' })
}

export async function saveRemoteCheckin(checkin) {
  const result = checkin.inviteCode
    ? await rpcRequest('submit_student_checkin', {
      invite_code: checkin.inviteCode,
      checkin_type: checkin.type,
      due_label: checkin.due,
      checkin_state: checkin.state,
      weight_value: checkin.weight,
      note_value: checkin.note,
    })
    : await request('checkins', {
      method: 'POST',
      body: JSON.stringify(toCheckinRow(checkin)),
    })
  const saved = Array.isArray(result) ? result[0] : result

  let photoPath = checkin.photo
  let uploadWarning = ''
  try {
    photoPath = checkin.photoFile
      ? await uploadCheckinPhoto(checkin.photoFile, saved.id, checkin.inviteCode)
      : checkin.photo

    if (photoPath) {
      if (checkin.inviteCode) {
        await rpcRequest('attach_student_checkin_photo', {
          invite_code: checkin.inviteCode,
          selected_checkin_id: saved.id,
          photo_url: photoPath,
        })
      } else {
        await request('checkin_photos', {
          method: 'POST',
          body: JSON.stringify({
            checkin_id: saved.id,
            storage_url: photoPath,
            label: 'Foto enviada no app',
          }),
        })
      }
    }
  } catch (error) {
    photoPath = ''
    uploadWarning = `O check-in foi salvo, mas a foto não foi enviada: ${error?.message || 'erro desconhecido'}`
  }

  const signedPhoto = photoPath ? await signCheckinPhoto(photoPath) : ''
  return {
    ...fromCheckinRow({
      ...saved,
      checkin_photos: photoPath ? [{ storage_url: photoPath, signed_url: signedPhoto }] : [],
    }),
    uploadWarning,
  }
}

async function uploadCheckinPhoto(file, checkinId, inviteCode = '') {
  const extension = file.name?.split('.').pop() || 'jpg'
  const prefix = inviteCode ? `${inviteCode}/` : ''
  const safeName = `${prefix}${checkinId}/${Date.now()}.${extension}`.replace(/\s+/g, '-')
  const response = await fetchWithTimeout(`${SUPABASE_URL}/storage/v1/object/${PHOTO_BUCKET}/${safeName}`, {
    method: 'POST',
    headers: authHeaders({
      'Content-Type': file.type || 'application/octet-stream',
      'x-upsert': 'true',
    }),
    body: file,
  })

  if (!response.ok) {
    const message = await response.text()
    throw serviceError(response.status, message || 'Erro ao enviar foto')
  }

  return safeName
}

async function uploadWorkoutVideo(file, workoutId, exerciseIndex) {
  if (!file) return ''
  if (!file.type?.startsWith('video/')) {
    throw new Error('Envie um arquivo de vídeo válido para o exercício.')
  }

  const maxSize = 120 * 1024 * 1024
  if (file.size > maxSize) {
    throw new Error('O vídeo do exercício precisa ter até 120 MB.')
  }

  const extension = file.name?.split('.').pop() || 'mp4'
  const safeName = `${workoutId}/${String(exerciseIndex + 1).padStart(2, '0')}-${Date.now()}.${extension}`.replace(/\s+/g, '-')
  const response = await fetchWithTimeout(`${SUPABASE_URL}/storage/v1/object/${WORKOUT_VIDEO_BUCKET}/${safeName}`, {
    method: 'POST',
    headers: authHeaders({
      'Content-Type': file.type || 'video/mp4',
      'x-upsert': 'true',
    }),
    body: file,
  })

  if (!response.ok) {
    const message = await response.text()
    throw serviceError(response.status, message || 'Erro ao enviar vídeo do exercício')
  }

  return `${SUPABASE_URL}/storage/v1/object/public/${WORKOUT_VIDEO_BUCKET}/${safeName}`
}

export async function updateRemotePayment(studentId, payment) {
  if (!isUuid(studentId)) return null

  const rows = await request(`students?id=eq.${studentId}`, {
    method: 'PATCH',
    body: JSON.stringify({ payment }),
  })

  return rows[0] ? fromStudentRow(rows[0]) : null
}

export async function markRemoteNotificationsRead() {
  await request('notifications?read=eq.false', {
    method: 'PATCH',
    body: JSON.stringify({ read: true }),
  })
}

export async function createRemoteStudentInvite(studentId, coachId) {
  const now = encodeURIComponent(new Date().toISOString())
  const activeInvites = await request(
    `student_invites?student_id=eq.${encodeURIComponent(studentId)}&coach_id=eq.${encodeURIComponent(coachId)}&status=eq.active&expires_at=gt.${now}&order=created_at.desc&limit=1`,
  )

  if (activeInvites[0]) {
    return fromInviteRow(activeInvites[0])
  }

  const code = createInviteCode()
  const rows = await request('student_invites', {
    method: 'POST',
    body: JSON.stringify({
      coach_id: coachId,
      student_id: studentId,
      code,
      status: 'active',
    }),
  })

  return fromInviteRow(rows[0])
}

export async function loadRemoteStudentByInvite(code) {
  const payload = await rpcRequest('get_student_portal', { invite_code: code })
  const invite = payload?.invite

  if (!invite || !payload?.student) {
    throw new Error('Convite não encontrado ou expirado')
  }

  const hydratedCheckins = await Promise.all((payload.checkins ?? []).map(hydrateCheckinRow))

  const anamnesisResult = await rpcRequest('get_student_anamnesis', { invite_code: code })
  const anamnesis = Array.isArray(anamnesisResult) ? anamnesisResult[0] : anamnesisResult

  return {
    invite: fromInviteRow(invite),
    student: fromStudentRow(payload.student),
    consentAccepted: Boolean(payload.consent_accepted),
    checkins: hydratedCheckins,
    workouts: (payload.workouts ?? []).map(fromWorkoutRow),
    nutritionPlans: (payload.nutrition_plans ?? []).map(fromNutritionPlanRow),
    workoutLogs: (payload.workout_logs ?? []).map(fromWorkoutLogRow),
    messages: (payload.messages ?? []).map(fromMessageRow),
    appointments: (payload.appointments ?? []).map(fromAppointmentRow),
    invoices: (payload.invoices ?? []).map(fromInvoiceRow),
    assessments: (payload.assessments ?? []).map(fromAssessmentRow),
    coachSettings: payload.coach_settings ? fromCoachSettingsRow(payload.coach_settings) : null,
    anamnesis: anamnesis?.id ? fromAnamnesisRow(anamnesis) : null,
    anamnesisRequired: payload.student.require_anamnesis !== false,
    anamnesisCompleted: Boolean(anamnesis?.id),
  }
}

export async function acceptRemoteStudentConsent(code) {
  await rpcRequest('accept_student_consent', {
    invite_code: code,
    consent_version_value: '1.0',
  })

  return loadRemoteStudentByInvite(code)
}

export async function submitRemoteStudentAnamnesis(code, answers) {
  await rpcRequest('submit_student_anamnesis', {
    invite_code: code,
    answers,
  })

  return loadRemoteStudentByInvite(code)
}

export async function saveRemoteWorkout(workout, coachId) {
  const workoutRows = await request('workouts', {
    method: 'POST',
    body: JSON.stringify({
      coach_id: coachId,
      student_id: workout.studentId,
      title: workout.title,
      focus: workout.focus,
      notes: workout.notes,
      active: true,
    }),
  })

  let exerciseRows = []
  const uploadWarnings = []
  try {
    const exercises = await Promise.all(workout.exercises.map(async (exercise, index) => {
      let uploadedVideoUrl = ''
      if (exercise.videoFile) {
        try {
          uploadedVideoUrl = await uploadWorkoutVideo(exercise.videoFile, workoutRows[0].id, index)
        } catch (error) {
          uploadWarnings.push(`${exercise.name || `Exercício ${index + 1}`}: ${error?.message || 'vídeo não enviado'}`)
        }
      }

      return {
        workout_id: workoutRows[0].id,
        name: exercise.name,
        sets: exercise.sets,
        reps: exercise.reps,
        load: exercise.load,
        rest: exercise.rest,
        muscle_group: exercise.muscleGroup || null,
        equipment: exercise.equipment || null,
        instructions: exercise.instructions || null,
        video_url: uploadedVideoUrl || exercise.videoUrl || null,
        order_index: index,
      }
    }))

    if (exercises.length) {
      exerciseRows = await request('workout_exercises', {
        method: 'POST',
        body: JSON.stringify(exercises),
      })
    }
  } catch (error) {
    await request(`workouts?id=eq.${workoutRows[0].id}`, { method: 'DELETE' }).catch(() => null)
    throw error
  }

  return {
    ...fromWorkoutRow({ ...workoutRows[0], workout_exercises: exerciseRows }),
    uploadWarning: uploadWarnings.length
      ? `O treino foi salvo, mas alguns vídeos não foram enviados: ${uploadWarnings.join('; ')}`
      : '',
  }
}

export async function archiveRemoteWorkout(workoutId) {
  if (!isUuid(workoutId)) return null
  const rows = await request(`workouts?id=eq.${workoutId}`, {
    method: 'PATCH',
    body: JSON.stringify({ active: false }),
  })
  return rows[0] ? fromWorkoutRow(rows[0]) : null
}

export async function saveRemoteNutritionPlan(plan, coachId) {
  const planRows = await request('nutrition_plans', {
    method: 'POST',
    body: JSON.stringify({
      coach_id: coachId,
      student_id: plan.studentId,
      title: plan.title,
      calories: plan.calories,
      protein: plan.protein,
      notes: plan.notes,
      active: true,
    }),
  })

  const savedPlan = planRows[0]
  const meals = plan.meals.map((meal, index) => ({
    nutrition_plan_id: savedPlan.id,
    name: meal.name,
    foods: meal.foods,
    macros: meal.macros,
    time_label: meal.time,
    order_index: index,
  }))

  let mealRows = []
  try {
    mealRows = meals.length
      ? await request('nutrition_meals', {
        method: 'POST',
        body: JSON.stringify(meals),
      })
      : []
  } catch (error) {
    await request(`nutrition_plans?id=eq.${savedPlan.id}`, { method: 'DELETE' }).catch(() => null)
    throw error
  }

  return fromNutritionPlanRow({ ...savedPlan, nutrition_meals: mealRows })
}

export async function archiveRemoteNutritionPlan(planId) {
  if (!isUuid(planId)) return null
  const rows = await request(`nutrition_plans?id=eq.${planId}`, {
    method: 'PATCH',
    body: JSON.stringify({ active: false }),
  })
  return rows[0] ? fromNutritionPlanRow(rows[0]) : null
}

export async function saveRemoteWorkoutLog(log) {
  if (log.inviteCode) {
    const result = await rpcRequest('submit_student_workout_log', {
      invite_code: log.inviteCode,
      selected_workout_id: isUuid(log.workoutId) ? log.workoutId : null,
      workout_title: log.title,
      effort_value: log.effort,
      notes_value: log.notes,
    })
    return fromWorkoutLogRow(Array.isArray(result) ? result[0] : result)
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

export async function saveRemoteMessage(message) {
  const attachmentUrl = message.attachmentFile
    ? await uploadMessageAttachment(message.attachmentFile, message.studentId, message.inviteCode)
    : message.attachmentUrl || ''
  const attachmentType = message.attachmentFile?.type || message.attachmentType || ''
  const attachmentName = message.attachmentFile?.name || message.attachmentName || ''
  const body = message.body?.trim() || (attachmentUrl ? (attachmentType.startsWith('audio/') ? 'Áudio enviado' : 'Foto enviada') : '')

  if (message.inviteCode && message.sender === 'student') {
    const result = await rpcRequest('submit_student_message', {
      invite_code: message.inviteCode,
      message_body: body,
      attachment_url: attachmentUrl || null,
      attachment_type: attachmentType || null,
      attachment_name: attachmentName || null,
    })
    return fromMessageRow(Array.isArray(result) ? result[0] : result)
  }

  const rows = await request('messages', {
    method: 'POST',
    body: JSON.stringify({
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

  return fromMessageRow(rows[0])
}

async function uploadMessageAttachment(file, studentId, inviteCode = '') {
  const extension = file.name?.split('.').pop() || 'jpg'
  const owner = inviteCode || studentId || 'chat'
  const safeName = `${owner}/${Date.now()}-${Math.random().toString(36).slice(2)}.${extension}`.replace(/\s+/g, '-')
  const response = await fetchWithTimeout(`${SUPABASE_URL}/storage/v1/object/${MESSAGE_ATTACHMENT_BUCKET}/${safeName}`, {
    method: 'POST',
    headers: authHeaders({
      'Content-Type': file.type || 'application/octet-stream',
      'x-upsert': 'true',
    }),
    body: file,
  })

  if (!response.ok) {
    const message = await response.text()
    throw serviceError(response.status, message || 'Erro ao enviar anexo da conversa')
  }

  return `${SUPABASE_URL}/storage/v1/object/public/${MESSAGE_ATTACHMENT_BUCKET}/${safeName}`
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

function toSession(payload, fallbackName, fallbackEmail) {
  const user = payload.user ?? {}
  const metadata = user.user_metadata ?? {}

  return {
    access_token: payload.access_token ?? '',
    refresh_token: payload.refresh_token ?? '',
    expires_at: payload.expires_at ?? Math.floor(Date.now() / 1000) + Number(payload.expires_in ?? 3600),
    expires_in: payload.expires_in ?? 3600,
    user: {
      id: user.id,
      name: metadata.name || fallbackName || user.email || 'Coach',
      email: user.email || fallbackEmail,
      role: 'Coach principal',
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

function fromStudentRow(row) {
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
    accessOverrideUntil: row.access_override_until ?? '',
    loadNotes: row.load_notes ?? '',
    waterGoalMl: row.water_goal_ml ?? '',
  }
}

function toStudentRow(student, coachId) {
  return {
    coach_id: coachId || null,
    name: student.name,
    email: student.email,
    phone: student.phone,
    cpf: student.cpf || null,
    goal: student.goal,
    phase: student.phase,
    status: student.status,
    plan: student.plan,
    payment: student.payment,
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
  const path = extractStoragePath(storageValue)
  if (!path) return ''

  const response = await fetchWithTimeout(
    `${SUPABASE_URL}/storage/v1/object/sign/${PHOTO_BUCKET}/${encodeStoragePath(path)}`,
    {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ expiresIn: 60 * 60 }),
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

function extractStoragePath(value) {
  if (!value) return ''
  const publicMarker = `/storage/v1/object/public/${PHOTO_BUCKET}/`
  const signedMarker = `/storage/v1/object/sign/${PHOTO_BUCKET}/`

  if (value.includes(publicMarker)) {
    return decodeURIComponent(value.split(publicMarker)[1].split('?')[0])
  }

  if (value.includes(signedMarker)) {
    return decodeURIComponent(value.split(signedMarker)[1].split('?')[0])
  }

  return String(value).replace(/^\/+/, '')
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
  return {
    id: row.id,
    coachId: row.coach_id,
    studentId: row.student_id,
    inviteId: row.invite_id,
    birthDate: row.birth_date ?? '',
    occupation: row.occupation ?? '',
    trainingExperience: row.training_experience ?? '',
    trainingFrequency: row.training_frequency ?? '',
    primaryGoal: row.primary_goal ?? '',
    injuries: row.injuries ?? '',
    healthConditions: row.health_conditions ?? '',
    medications: row.medications ?? '',
    surgeries: row.surgeries ?? '',
    pain: row.pain ?? '',
    sleepHours: row.sleep_hours ?? '',
    sleepQuality: row.sleep_quality ?? '',
    stressLevel: row.stress_level ?? '',
    waterIntake: row.water_intake ?? '',
    foodRestrictions: row.food_restrictions ?? '',
    routine: row.routine ?? '',
    observations: row.observations ?? '',
    emergencyContact: row.emergency_contact ?? '',
    submittedAt: row.submitted_at ?? row.created_at,
  }
}

function fromWorkoutRow(row) {
  return {
    id: row.id,
    coachId: row.coach_id,
    studentId: row.student_id,
    title: row.title ?? '',
    focus: row.focus ?? '',
    notes: row.notes ?? '',
    active: Boolean(row.active),
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
        equipment: exercise.equipment ?? '',
        instructions: exercise.instructions ?? '',
        videoUrl: exercise.video_url ?? '',
      })),
  }
}

function fromNutritionPlanRow(row) {
  return {
    id: row.id,
    coachId: row.coach_id,
    studentId: row.student_id,
    title: row.title ?? '',
    calories: row.calories ?? '',
    protein: row.protein ?? '',
    notes: row.notes ?? '',
    active: Boolean(row.active),
    meals: (row.nutrition_meals ?? [])
      .slice()
      .sort((a, b) => Number(a.order_index ?? 0) - Number(b.order_index ?? 0))
      .map((meal) => ({
        id: meal.id,
        name: meal.name ?? '',
        foods: meal.foods ?? '',
        macros: meal.macros ?? '',
        time: meal.time_label ?? '',
      })),
  }
}

function fromWorkoutLogRow(row) {
  return {
    id: row.id,
    coachId: row.coach_id,
    studentId: row.student_id,
    workoutId: row.workout_id,
    title: row.title ?? '',
    effort: row.effort ?? '',
    notes: row.notes ?? '',
    completedAt: row.completed_at ?? row.created_at,
  }
}

function fromMessageRow(row) {
  return {
    id: row.id,
    coachId: row.coach_id,
    studentId: row.student_id,
    sender: row.sender ?? 'coach',
    body: row.body ?? '',
    read: Boolean(row.read),
    attachmentUrl: row.attachment_url ?? '',
    attachmentType: row.attachment_type ?? '',
    attachmentName: row.attachment_name ?? '',
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

function fromCoachSettingsRow(row) {
  return {
    coachId: row.coach_id,
    brandName: row.brand_name ?? 'FitCoach',
    publicName: row.public_name ?? '',
    cref: row.cref ?? '',
    whatsapp: row.whatsapp ?? '',
    supportEmail: row.support_email ?? '',
    pixKey: row.pix_key ?? '',
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
  const random = crypto.getRandomValues(new Uint32Array(2))
  return Array.from(random)
    .map((value) => value.toString(36).toUpperCase())
    .join('')
    .slice(0, 10)
}

function isUuid(value) {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

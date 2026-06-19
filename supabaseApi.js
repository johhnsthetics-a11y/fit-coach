const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY
const PHOTO_BUCKET = 'checkin-photos'

let sessionToken = ''

export const supabaseEnabled = Boolean(SUPABASE_URL && SUPABASE_KEY)

export function setSupabaseSession(token) {
  sessionToken = token || ''
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
    throw new Error('Supabase nao configurado')
  }

  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: {
      ...authHeaders({ 'Content-Type': 'application/json' }),
      Prefer: 'return=representation',
      ...(options.headers ?? {}),
    },
  })

  if (!response.ok) {
    const message = await response.text()
    throw new Error(`${response.status}: ${message || 'Erro ao acessar Supabase'}`)
  }

  if (response.status === 204) return null
  return response.json()
}

async function authRequest(path, body) {
  const response = await fetch(`${SUPABASE_URL}/auth/v1/${path}`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(body),
  })

  const payload = await response.json().catch(() => ({}))

  if (!response.ok) {
    throw new Error(payload.msg || payload.message || 'Erro de autenticacao')
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
    throw new Error('Conta criada. Confirme o email na sua caixa de entrada e depois entre com email e senha.')
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

export async function refreshCoachSession(refreshToken) {
  if (!refreshToken) {
    throw new Error('Sessao sem token de renovacao')
  }

  const payload = await authRequest('token?grant_type=refresh_token', {
    refresh_token: refreshToken,
  })

  setSupabaseSession(payload.access_token)
  return toSession(payload)
}

export async function loadRemoteData() {
  const [users, students, checkins, notifications, workouts, nutritionPlans, workoutLogs, messages, appointments, invoices, assessments, coachSettings] = await Promise.all([
    request('users?select=*&order=created_at.desc&limit=1'),
    request('students?select=*&order=created_at.desc'),
    request('checkins?select=*,checkin_photos(*)&order=created_at.desc'),
    request('notifications?select=*&order=created_at.desc'),
    request('workouts?select=*,workout_exercises(*)&order=created_at.desc').catch(() => []),
    request('nutrition_plans?select=*,nutrition_meals(*)&order=created_at.desc').catch(() => []),
    request('workout_logs?select=*&order=completed_at.desc').catch(() => []),
    request('messages?select=*&order=created_at.desc').catch(() => []),
    request('appointments?select=*&order=starts_at.asc').catch(() => []),
    request('invoices?select=*&order=due_date.desc').catch(() => []),
    request('assessments?select=*&order=assessed_at.desc').catch(() => []),
    request('coach_settings?select=*&limit=1').catch(() => []),
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
  }
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

  const photoPath = checkin.photoFile
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

  const signedPhoto = photoPath ? await signCheckinPhoto(photoPath) : ''
  return fromCheckinRow({
    ...saved,
    checkin_photos: photoPath ? [{ storage_url: photoPath, signed_url: signedPhoto }] : [],
  })
}

async function uploadCheckinPhoto(file, checkinId, inviteCode = '') {
  const extension = file.name?.split('.').pop() || 'jpg'
  const prefix = inviteCode ? `${inviteCode}/` : ''
  const safeName = `${prefix}${checkinId}/${Date.now()}.${extension}`.replace(/\s+/g, '-')
  const response = await fetch(`${SUPABASE_URL}/storage/v1/object/${PHOTO_BUCKET}/${safeName}`, {
    method: 'POST',
    headers: authHeaders({
      'Content-Type': file.type || 'application/octet-stream',
      'x-upsert': 'true',
    }),
    body: file,
  })

  if (!response.ok) {
    const message = await response.text()
    throw new Error(`${response.status}: ${message || 'Erro ao enviar foto'}`)
  }

  return safeName
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
    throw new Error('Convite nao encontrado ou expirado')
  }

  const hydratedCheckins = await Promise.all((payload.checkins ?? []).map(hydrateCheckinRow))

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
  }
}

export async function acceptRemoteStudentConsent(code) {
  await rpcRequest('accept_student_consent', {
    invite_code: code,
    consent_version_value: '1.0',
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

  const savedWorkout = workoutRows[0]
  const exercises = workout.exercises.map((exercise, index) => ({
    workout_id: savedWorkout.id,
    name: exercise.name,
    sets: exercise.sets,
    reps: exercise.reps,
    load: exercise.load,
    rest: exercise.rest,
    order_index: index,
  }))

  const exerciseRows = exercises.length
    ? await request('workout_exercises', {
      method: 'POST',
      body: JSON.stringify(exercises),
    })
    : []

  return fromWorkoutRow({ ...savedWorkout, workout_exercises: exerciseRows })
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

  const mealRows = meals.length
    ? await request('nutrition_meals', {
      method: 'POST',
      body: JSON.stringify(meals),
    })
    : []

  return fromNutritionPlanRow({ ...savedPlan, nutrition_meals: mealRows })
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
  if (message.inviteCode && message.sender === 'student') {
    const result = await rpcRequest('submit_student_message', {
      invite_code: message.inviteCode,
      message_body: message.body,
    })
    return fromMessageRow(Array.isArray(result) ? result[0] : result)
  }

  const rows = await request('messages', {
    method: 'POST',
    body: JSON.stringify({
      coach_id: message.coachId,
      student_id: message.studentId,
      sender: message.sender,
      body: message.body,
      read: Boolean(message.read),
    }),
  })

  return fromMessageRow(rows[0])
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
    goal: row.goal ?? '',
    phase: row.phase ?? '',
    status: row.status ?? 'Em dia',
    plan: row.plan ?? 'Essential',
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
  }
}

function toStudentRow(student, coachId) {
  return {
    coach_id: coachId || null,
    name: student.name,
    email: student.email,
    phone: student.phone,
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

  const response = await fetch(
    `${SUPABASE_URL}/storage/v1/object/sign/${PHOTO_BUCKET}/${encodeStoragePath(path)}`,
    {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ expiresIn: 60 * 60 }),
    },
  )

  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(payload.message || 'Erro ao acessar foto protegida')
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

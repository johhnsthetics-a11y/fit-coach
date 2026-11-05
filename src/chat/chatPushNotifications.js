import { Capacitor } from '@capacitor/core'
import {
  getRemoteChatPushAvailability,
  registerRemoteChatPushDevice,
} from '../supabaseApi'

export function isNativeIosPushAvailable() {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios'
}

export async function getChatPushPermissionState(context = {}) {
  if (!isNativeIosPushAvailable()) return { available: false, permission: 'unsupported' }
  const availability = await getRemoteChatPushAvailability(context)
  if (!availability?.available) return { available: false, permission: 'unsupported' }
  const { PushNotifications } = await import('@capacitor/push-notifications')
  const permission = await PushNotifications.checkPermissions()
  return { available: true, permission: permission.receive || 'prompt' }
}

export async function enableChatPushForConversation(context = {}, { requestPermission = true } = {}) {
  if (!isNativeIosPushAvailable()) return { ok: false, reason: 'unsupported' }

  const availability = await getRemoteChatPushAvailability(context)
  if (!availability?.available) return { ok: false, reason: 'unavailable' }

  const { PushNotifications } = await import('@capacitor/push-notifications')
  let permission = await PushNotifications.checkPermissions()
  if (requestPermission && ['prompt', 'prompt-with-rationale'].includes(permission.receive)) {
    permission = await PushNotifications.requestPermissions()
  }
  if (permission.receive !== 'granted') {
    return { ok: false, reason: permission.receive === 'denied' ? 'denied' : 'permission' }
  }

  let resolveToken
  let rejectToken
  let timeoutId = 0
  const tokenPromise = new Promise((resolve, reject) => {
    resolveToken = resolve
    rejectToken = reject
    timeoutId = window.setTimeout(() => reject(new Error('O registro de notificações demorou demais.')), 12000)
  })
  const registrationListener = await PushNotifications.addListener('registration', (token) => {
    if (token?.value) resolveToken(token.value)
    else rejectToken(new Error('O dispositivo não retornou um token APNs.'))
  })
  const errorListener = await PushNotifications.addListener('registrationError', (event) => {
    rejectToken(new Error(event?.error || 'Não foi possível registrar este dispositivo.'))
  })

  try {
    await PushNotifications.register()
    const token = await tokenPromise
    await registerRemoteChatPushDevice({ ...context, token })
    return { ok: true, reason: 'enabled' }
  } finally {
    window.clearTimeout(timeoutId)
    await registrationListener.remove().catch(() => undefined)
    await errorListener.remove().catch(() => undefined)
  }
}

const PENDING_CHAT_PUSH_ACTION_KEY = 'coachfit.chat.push.pending-action.v1'

export function storePendingChatPushAction(payload = {}) {
  const recipientRole = String(payload?.recipientRole || '')
  const studentId = String(payload?.studentId || '')
  if (!['coach', 'student'].includes(recipientRole) || (recipientRole === 'student' && !studentId)) return false
  try {
    window.sessionStorage.setItem(PENDING_CHAT_PUSH_ACTION_KEY, JSON.stringify({
      payload: { recipientRole, studentId },
      createdAt: Date.now(),
    }))
    return true
  } catch {
    return false
  }
}

export function consumePendingChatPushAction(recipientRole, studentId = '') {
  let serialized = ''
  try {
    serialized = window.sessionStorage.getItem(PENDING_CHAT_PUSH_ACTION_KEY) || ''
    window.sessionStorage.removeItem(PENDING_CHAT_PUSH_ACTION_KEY)
  } catch {
    return null
  }
  if (!serialized) return null
  try {
    const record = JSON.parse(serialized)
    if (Date.now() - Number(record.createdAt || 0) > 15 * 60 * 1000) return null
    if (record.payload?.recipientRole !== recipientRole) return null
    if (recipientRole === 'student' && String(record.payload?.studentId || '') !== String(studentId || '')) return null
    return record.payload
  } catch {
    return null
  }
}

export async function addChatPushActionListener(onAction) {
  if (!isNativeIosPushAvailable()) return null
  const { PushNotifications } = await import('@capacitor/push-notifications')
  return PushNotifications.addListener('pushNotificationActionPerformed', (event) => {
    onAction?.(event?.notification?.data || {})
  })
}

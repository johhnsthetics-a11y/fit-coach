import { Capacitor, registerPlugin } from '@capacitor/core'

const NativeWorkoutRest = registerPlugin('CoachFitWorkoutRest')

export function isNativeWorkoutRestAvailable() {
  if (typeof window === 'undefined') return false
  try {
    return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios'
  } catch {
    return false
  }
}

export function getNativeWorkoutRestCapabilities() {
  return NativeWorkoutRest.getCapabilities()
}

export function requestNativeWorkoutRestNotifications() {
  return NativeWorkoutRest.requestNotificationPermission()
}

export function openNativeWorkoutRestSettings() {
  return NativeWorkoutRest.openNotificationSettings()
}

export function syncNativeWorkoutRest(options) {
  return NativeWorkoutRest.syncRest(options)
}

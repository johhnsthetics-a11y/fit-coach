import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import {
  clearRestTimerSnapshot,
  getRestTimerRemainingSeconds,
  getRestTimerStorageKey,
  normalizeRestSeconds,
  readRestTimerSnapshot,
  writeRestTimerSnapshot,
} from '../src/workoutRestTimer.js'

const root = new URL('../', import.meta.url)
const readSource = (path) => readFile(new URL(path, root), 'utf8')

function createMemoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial))
  return {
    getItem(key) { return values.has(key) ? values.get(key) : null },
    setItem(key, value) { values.set(key, String(value)) },
    removeItem(key) { values.delete(key) },
    has(key) { return values.has(key) },
  }
}

test('deadline absoluto mantém contagem correta ao sair do app e retornar', () => {
  assert.equal(getRestTimerRemainingSeconds(70_000, 10_000), 60)
  assert.equal(getRestTimerRemainingSeconds(70_499, 10_000), 61)
  assert.equal(getRestTimerRemainingSeconds(9_999, 10_000), 0)
  assert.equal(normalizeRestSeconds(9_999), 3600)
  assert.equal(normalizeRestSeconds(-15), 0)
})

test('o snapshot paused persiste restante sem recriar uma deadline em execução', () => {
  const key = getRestTimerStorageKey('student-1', 'workout-1')
  const storage = createMemoryStorage()
  assert.ok(key)
  assert.equal(writeRestTimerSnapshot(key, { paused: true, remainingSeconds: 35 }, { storage, nowMs: 10_000 }), true)
  assert.deepEqual(readRestTimerSnapshot(key, { storage, nowMs: 20_000 }), {
    paused: true,
    remainingSeconds: 35,
    endAtMs: 0,
    activityDetails: { exerciseName: '', nextSetNumber: 1, totalSets: 1 },
  })
  assert.equal(storage.has(key), true)
})

test('o snapshot em execução é calculado pelo horário absoluto e expirado é removido', () => {
  const key = getRestTimerStorageKey('student-1', 'workout-1')
  const storage = createMemoryStorage()
  assert.equal(writeRestTimerSnapshot(key, { paused: false, remainingSeconds: 60, endAtMs: 70_000 }, { storage, nowMs: 10_000 }), true)
  assert.deepEqual(readRestTimerSnapshot(key, { storage, nowMs: 40_000 }), {
    paused: false,
    remainingSeconds: 30,
    endAtMs: 70_000,
    activityDetails: { exerciseName: '', nextSetNumber: 1, totalSets: 1 },
  })
  assert.deepEqual(readRestTimerSnapshot(key, { storage, nowMs: 71_000 }), {
    expired: true,
    paused: false,
    remainingSeconds: 0,
    endAtMs: 70_000,
  })
  assert.equal(storage.has(key), false)
})

test('o snapshot recupera o exercício e a série seguinte com limite local de texto', () => {
  const key = getRestTimerStorageKey('student-1', 'workout-1')
  const storage = createMemoryStorage()
  const exerciseName = 'Agachamento guiado '.repeat(8)
  assert.equal(writeRestTimerSnapshot(key, {
    paused: false,
    remainingSeconds: 45,
    endAtMs: 55_000,
    activityDetails: { exerciseName, nextSetNumber: 2, totalSets: 4 },
  }, { storage, nowMs: 10_000 }), true)
  const restored = readRestTimerSnapshot(key, { storage, nowMs: 12_000 })
  assert.equal(restored.activityDetails.exerciseName.length, 80)
  assert.equal(restored.activityDetails.nextSetNumber, 2)
  assert.equal(restored.activityDetails.totalSets, 4)
})

test('chave local separa aluno e treino e clear não deixa estado residual', () => {
  const firstKey = getRestTimerStorageKey('student-a', 'workout-a')
  assert.notEqual(firstKey, getRestTimerStorageKey('student-b', 'workout-a'))
  assert.notEqual(firstKey, getRestTimerStorageKey('student-a', 'workout-b'))
  assert.equal(getRestTimerStorageKey('', 'workout-a'), '')
  const storage = createMemoryStorage()
  writeRestTimerSnapshot(firstKey, { paused: false, remainingSeconds: 20, endAtMs: 20_000 }, { storage, nowMs: 1_000 })
  assert.equal(clearRestTimerSnapshot(firstKey, { storage }), true)
  assert.equal(storage.has(firstKey), false)
})

test('preview e web não chamam plugin nativo nem salvam snapshots', async () => {
  const app = await readSource('src/App.jsx')
  const bridge = await readSource('src/nativeWorkoutRest.js')
  assert.match(app, /if\s*\(preview\s*\|\|\s*!isNativeWorkoutRestAvailable\(\)\)/)
  assert.match(app, /if\s*\(!preview\)\s*writeRestTimerSnapshot/)
  assert.match(bridge, /typeof window === 'undefined'/)
  assert.match(bridge, /Capacitor\.getPlatform\(\) === 'ios'/)
})

test('o fluxo de descanso oferece status/permissão e ações que sincronizam o estado nativo', async () => {
  const app = await readSource('src/App.jsx')
  const plugin = await readSource('ios/App/App/WorkoutRestActivityPlugin.swift')
  assert.match(app, /requestNativeWorkoutRestNotifications/)
  assert.match(app, /openNativeWorkoutRestSettings/)
  assert.match(app, /syncNativeWorkoutRest/)
  assert.match(app, /restNativeSyncSequenceRef/)
  assert.match(plugin, /synchronizationGeneration/)
  assert.match(plugin, /isCurrentSynchronization\(generation\)/)
  assert.match(plugin, /enqueueActivityMutation/)
  assert.match(app, /notificationPolicy\s*=\s*'schedule'/)
  assert.match(app, /notificationPolicy\s*=\s*'cancelAll'/)
})

test('o target contém ActivityKit countdown e o alerta local é agendado/cancelável', async () => {
  const plugin = await readSource('ios/App/App/WorkoutRestActivityPlugin.swift')
  const widget = await readSource('ios/App/CoachFitRestActivityExtension/WorkoutRestLiveActivity.swift')
  const project = await readSource('ios/App/App.xcodeproj/project.pbxproj')
  const plist = await readSource('ios/App/App/Info.plist')
  const widgetPlist = await readSource('ios/App/CoachFitRestActivityExtension/Info.plist')
  const workflow = await readSource('.github/workflows/coachfit-ios-testflight.yml')
  assert.match(plugin, /CAPBridgedPlugin/)
  assert.match(plugin, /UNTimeIntervalNotificationTrigger/)
  assert.match(plugin, /removePendingNotificationRequests/)
  assert.match(plugin, /Activity\.request\(/)
  assert.match(plugin, /ActivityContent\(/)
  assert.match(widget, /ActivityConfiguration\(for:/)
  assert.match(widget, /timerInterval:/)
  assert.match(widget, /if #available\(iOS 16\.2, \*\)[\s\S]*?return context\.isStale/)
  assert.match(widget, /DynamicIsland/)
  assert.match(project, /CoachFitRestActivityExtension/)
  assert.match(project, /com\.apple\.product-type\.app-extension/)
  assert.match(project, /Embed App Extensions/)
  assert.match(project, /PBXTargetDependency/)
  assert.match(plist, /<key>NSSupportsLiveActivities<\/key>\s*<true\/>/)
  assert.match(widgetPlist, /<key>CFBundleIdentifier<\/key>\s*<string>\$\(PRODUCT_BUNDLE_IDENTIFIER\)<\/string>/)
  assert.match(widgetPlist, /<key>CFBundleVersion<\/key>\s*<string>\$\(CURRENT_PROJECT_VERSION\)<\/string>/)
  assert.match(widgetPlist, /com\.apple\.widgetkit-extension/)
  assert.match(workflow, /IOS_REST_ACTIVITY_PROVISIONING_PROFILE_BASE64/)
  assert.match(workflow, /REST_EXTENSION_ID: br\.com\.coachfitpro\.ios\.restactivity/)
  assert.match(workflow, /provisioningProfiles=\{[\s\S]*APP_ID[\s\S]*REST_EXTENSION_ID/)
})

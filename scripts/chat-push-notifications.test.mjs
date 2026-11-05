import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
import { transformWithEsbuild } from 'vite'

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const packageJson = JSON.parse(read('package.json'))
const capacitorConfig = JSON.parse(read('capacitor.config.json'))
const app = read('src/App.jsx')
const pushClient = read('src/chat/chatPushNotifications.js')
const pushControl = read('src/chat/ChatPushControl.jsx')
const api = read('src/supabaseApi.js')
const deviceFunction = read('supabase/functions/chat-push-device/index.ts')
const messageFunction = read('supabase/functions/chat-message-push/index.ts')
const migration = read('supabase/migrations/20261105150000_chat_push_notifications.sql')
const audioMigration = read('supabase/migrations/20261105151000_chat_audio_attachments_20mb.sql')
const chatCss = read('src/chat/chat.css')
const conversation = read('src/chat/ChatConversation.jsx')
const infoPlist = read('ios/App/App/Info.plist')
const appDelegate = read('ios/App/App/AppDelegate.swift')
const project = read('ios/App/App.xcodeproj/project.pbxproj')
const debugEntitlements = read('ios/App/App/App.Debug.entitlements')
const releaseEntitlements = read('ios/App/App/App.Release.entitlements')
const sqlConfig = read('supabase/config.toml')

 test('Capacitor push is present and foreground banners/list/sound are configured', () => {
  assert.match(packageJson.dependencies['@capacitor/push-notifications'], /^\^8\./)
  assert.deepEqual(capacitorConfig.plugins.PushNotifications.presentationOptions, ['badge', 'sound', 'banner', 'list'])
  assert.match(appDelegate, /capacitorDidRegisterForRemoteNotifications/)
  assert.match(appDelegate, /capacitorDidFailToRegisterForRemoteNotifications/)
  assert.match(project, /com\.apple\.Push = \{ enabled = 1; \}/)
  assert.match(debugEntitlements, /<string>development<\/string>/)
  assert.match(releaseEntitlements, /<string>production<\/string>/)
})

test('push activation is an explicit iOS opt-in and does not store APNs tokens in browser storage', () => {
  assert.match(pushClient, /Capacitor\.getPlatform\(\) === 'ios'/)
  assert.match(pushClient, /checkPermissions\(\)/)
  assert.match(pushClient, /requestPermissions\(\)/)
  assert.match(pushClient, /registerRemoteChatPushDevice/)
  assert.match(pushClient, /window\.sessionStorage\.setItem/)
  assert.match(pushClient, /payload: \{ recipientRole, studentId \}/)
  assert.match(pushClient, /15 \* 60 \* 1000/)
  assert.doesNotMatch(pushClient, /localStorage/)
  assert.doesNotMatch(pushClient, /sessionStorage\.setItem[\s\S]{0,180}\btoken\b/i)
  assert.match(pushControl, /Ativar notificações de mensagens/)
  assert.match(pushControl, /role="status"/)
  assert.match(pushControl, /!result\.available/)
  assert.match(conversation, /<ChatPushControl viewerRole=\{viewerRole\}/)
})

test('Edge Functions validate coach session or active student invite and restrict messages to their sender', () => {
  assert.match(deviceFunction, /admin\.auth\.getUser\(accessToken\)/)
  assert.match(deviceFunction, /\.eq\('status', 'active'\)/)
  assert.match(deviceFunction, /APNS_AUTH_KEY_P8/)
  assert.match(messageFunction, /admin\.auth\.getUser\(accessToken\)/)
  assert.match(messageFunction, /\.eq\('status', 'active'\)/)
  assert.match(messageFunction, /message\.sender !== 'coach'/)
  assert.match(messageFunction, /message\.sender !== 'student'/)
  assert.match(messageFunction, /claim_chat_push_delivery/)
  assert.match(sqlConfig, /\[functions\.chat-push-device\][\s\S]*?verify_jwt = false/)
  assert.match(sqlConfig, /\[functions\.chat-message-push\][\s\S]*?verify_jwt = false/)
})

test('APNs uses server-only secrets, a generic lock-screen preview, and the other participant only', () => {
  assert.match(messageFunction, /Deno\.env\.get\('APNS_AUTH_KEY_P8'\)/)
  assert.match(messageFunction, /Deno\.env\.get\('APNS_KEY_ID'\)/)
  assert.match(messageFunction, /Deno\.env\.get\('APNS_TEAM_ID'\)/)
  assert.match(messageFunction, /body: 'Você recebeu uma mensagem no Coach Fit Pro\.'/)
  assert.doesNotMatch(messageFunction, /message\.body/)
  assert.match(messageFunction, /recipientType = actor\.actorType === 'coach' \? 'student' : 'coach'/)
  assert.match(messageFunction, /recipientRole: recipientType/)
  assert.match(pushClient, /pushNotificationActionPerformed/)
  assert.match(app, /payload\?\.recipientRole === 'coach'/)
  assert.match(app, /payload\?\.recipientRole !== 'student'/)
  assert.match(app, /sendRemoteChatMessagePush\([\s\S]{0,250}\.catch\(\(\) => undefined\)/)
})

test('push device tokens and delivery log are private and claim is idempotent', () => {
  assert.match(migration, /alter table public\.chat_push_devices enable row level security/i)
  assert.match(migration, /revoke all on public\.chat_push_devices from public, anon, authenticated/i)
  assert.match(migration, /grant all on public\.chat_push_devices to service_role/i)
  assert.match(migration, /revoke all on public\.chat_push_delivery_log from public, anon, authenticated/i)
  assert.match(migration, /grant execute on function public\.claim_chat_push_delivery\(uuid, text, uuid\) to service_role/i)
  assert.match(migration, /on conflict \(message_id\) do update/i)
})

test('student chat loses layout containment only during the immersive mobile conversation', () => {
  assert.match(chatCss, /\.student-mobile-shell\.student-chat-active main\s*\{\s*contain:\s*none !important;/)
  assert.match(conversation, /hasChatComposerFocus/)
  assert.match(conversation, /MIN_VALID_CHAT_VIEWPORT_HEIGHT/)
  assert.match(conversation, /orientationchange/)
  assert.match(chatCss, /html\.chat-keyboard-open \.student-mobile-shell\.student-chat-active \.chat-conversation\.chat-conversation-immersive/)
  assert.match(chatCss, /font-size:\s*max\(16px, 1rem\)/)
})

test('iOS audio privacy purpose and 20 MiB Supabase attachment limit match the composer', () => {
  assert.match(infoPlist, /NSMicrophoneUsageDescription/)
  assert.match(infoPlist, /usa o microfone para gravar áudios/)
  assert.match(read('src/chat/useChatComposer.js'), /AUDIO_MAX_BYTES = 20 \* 1024 \* 1024/)
  assert.match(audioMigration, /when file_size_limit is null then null[\s\S]*greatest\(file_size_limit, 20971520\)/)
})

test('push UI and both Edge Functions transform without syntax errors', async () => {
  for (const [name, source] of Object.entries({ pushControl, conversation })) {
    const result = await transformWithEsbuild(source, `${name}.jsx`, { loader: 'jsx', jsx: 'transform' })
    assert.ok(result.code.length > 0)
  }
  for (const [name, source] of Object.entries({ deviceFunction, messageFunction })) {
    const result = await transformWithEsbuild(source, `${name}.ts`, { loader: 'ts' })
    assert.ok(result.code.length > 0)
  }
  assert.match(pushClient, /export async function addChatPushActionListener/)
  assert.match(api, /export async function getRemoteChatPushAvailability/)
  assert.match(api, /export async function registerRemoteChatPushDevice/)
  assert.match(api, /export async function sendRemoteChatMessagePush/)
})

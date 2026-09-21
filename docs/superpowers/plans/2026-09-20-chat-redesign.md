# Professional Chat Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the existing Coach Fit Pro chat into a polished, mobile-first messenger for students and professionals while preserving every current message, audio, attachment, wallpaper, draft, history, authentication, and permission contract.

**Architecture:** Introduce a focused `src/chat` module for pure timeline logic, draft persistence, viewport behavior, and shared React presentation. `StudentMessagePanel`, `StudentChatScreen`, and `Messages` remain profile entry points in `src/App.jsx`, but delegate rendering and interaction to the shared module; existing Supabase callbacks remain the only persistence path. Once browser coverage proves parity, remove only the DOM decorators replaced by React while retaining wallpaper behavior and its storage format.

**Tech Stack:** React 18, JavaScript/JSX, Vite 5, Tailwind utilities already present, project CSS, Node test runner, Playwright browser harness, Supabase REST/RPC services already present.

**Spec:** `docs/superpowers/specs/2026-09-20-chat-redesign-design.md`

## Global Constraints

- Preserve text, audio, image attachments, history, wallpaper, drafts, optimistic delivery, retry, authentication, roles, and existing business rules.
- Student mobile uses an immersive full-screen conversation; professional mobile stays integrated with app navigation; desktop uses conversation list plus active conversation.
- Do not change Supabase schema, RLS, authentication, message contracts, or polling transport in this phase.
- Do not add document formats beyond the currently authorized `image/*,audio/*` contract.
- Do not add a large UI, animation, or virtualization dependency.
- Use `100dvh`, safe-area insets, and `visualViewport` progressively; do not rely on fixed `100vh` geometry.
- Respect light mode, dark mode, keyboard navigation, visible focus, touch targets, and `prefers-reduced-motion`.
- Keep every task independently buildable and commit only its related files.

## Review Focus

- A conversation containing invalid dates, missing IDs, deleted messages, or long unbroken text must render without throwing or overflowing; Task 1 and Task 3 pin this behavior.
- A failed send followed by retry or refresh must preserve the text draft and must not create duplicate messages; Task 2 and Task 8 pin this behavior.
- New messages received while the reader is away from the bottom must not steal scroll position; Task 3 and Task 8 pin this behavior.
- Audio permission denial, cancel, unmount, Safari MIME fallback, and failed upload must release microphone tracks and preserve a retryable state; Task 4 and Task 8 pin this behavior.
- At 320 px width with a short visual viewport, the student composer must stay above navigation/safe area and all controls must remain reachable; Task 5 and Task 8 pin this behavior.

---

### Task 1: Deterministic chat timeline and conversation ordering

**Files:**
- Create: `src/chat/chatModel.js`
- Create: `scripts/chat-model.test.mjs`
- Modify: `package.json:8-18`

**Interfaces:**
- Produces: `sortChatMessages(messages)`, `buildChatTimeline(messages, options)`, `formatChatDayLabel(value, now)`, `buildConversationRows(students, messages)`, and `getStableMessageKey(message, index)`.
- Timeline entries are `{ kind: 'date', key, label }` or `{ kind: 'message', key, message, isFirst, isLast }`.
- Conversation rows are `{ student, messages, latestMessage, unreadCount, activityAt }`, ordered newest activity first.

- [ ] **Step 1: Write the failing model tests**

Create `scripts/chat-model.test.mjs` with deterministic cases:

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildChatTimeline,
  buildConversationRows,
  formatChatDayLabel,
  sortChatMessages,
} from '../src/chat/chatModel.js'

test('sorts messages oldest first and tolerates invalid dates', () => {
  const sorted = sortChatMessages([
    { id: 'b', createdAt: '2026-09-20T12:00:00Z' },
    { id: 'invalid', createdAt: 'not-a-date' },
    { id: 'a', createdAt: '2026-09-20T10:00:00Z' },
  ])
  assert.deepEqual(sorted.map((item) => item.id), ['invalid', 'a', 'b'])
})

test('adds date separators and groups only consecutive messages from the same sender', () => {
  const timeline = buildChatTimeline([
    { id: '1', sender: 'student', createdAt: '2026-09-19T10:00:00-03:00' },
    { id: '2', sender: 'student', createdAt: '2026-09-19T10:02:00-03:00' },
    { id: '3', sender: 'coach', createdAt: '2026-09-19T10:03:00-03:00' },
    { id: '4', sender: 'coach', createdAt: '2026-09-20T10:03:00-03:00' },
  ], { now: new Date('2026-09-20T12:00:00-03:00'), groupGapMs: 5 * 60 * 1000 })
  assert.deepEqual(timeline.filter((item) => item.kind === 'date').map((item) => item.label), ['Ontem', 'Hoje'])
  const bubbles = timeline.filter((item) => item.kind === 'message')
  assert.equal(bubbles[0].isFirst, true)
  assert.equal(bubbles[0].isLast, false)
  assert.equal(bubbles[1].isFirst, false)
  assert.equal(bubbles[1].isLast, true)
  assert.equal(bubbles[2].isFirst, true)
})

test('orders conversations by latest activity and counts unread student messages', () => {
  const rows = buildConversationRows(
    [{ id: 'a', name: 'Ana' }, { id: 'b', name: 'Bruno' }],
    [
      { id: '1', studentId: 'a', sender: 'student', read: false, createdAt: '2026-09-20T10:00:00Z' },
      { id: '2', studentId: 'b', sender: 'coach', read: true, createdAt: '2026-09-20T12:00:00Z' },
    ],
  )
  assert.deepEqual(rows.map((row) => row.student.id), ['b', 'a'])
  assert.equal(rows[1].unreadCount, 1)
})

test('formats absolute dates without throwing on invalid values', () => {
  assert.equal(formatChatDayLabel('invalid', new Date('2026-09-20T12:00:00-03:00')), 'Data não informada')
})
```

- [ ] **Step 2: Run the test and verify the missing module failure**

Run: `node --test scripts/chat-model.test.mjs`

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `src/chat/chatModel.js`.

- [ ] **Step 3: Implement the pure model**

Create `src/chat/chatModel.js` using local calendar keys and stable fallback ordering:

```js
export const CHAT_GROUP_GAP_MS = 5 * 60 * 1000

function timestampOf(value) {
  const timestamp = new Date(value ?? 0).getTime()
  return Number.isFinite(timestamp) ? timestamp : 0
}

export function getStableMessageKey(message, index = 0) {
  return String(message?.id || `${message?.sender || 'message'}-${timestampOf(message?.createdAt)}-${index}`)
}

export function sortChatMessages(messages = []) {
  return [...(Array.isArray(messages) ? messages : [])]
    .map((message, index) => ({ message, index }))
    .sort((a, b) => timestampOf(a.message?.createdAt) - timestampOf(b.message?.createdAt) || a.index - b.index)
    .map(({ message }) => message)
}
```

Implement `formatChatDayLabel`, `buildChatTimeline`, and `buildConversationRows` with the signatures above. A date boundary must always terminate the previous sender group. Missing message collections must behave as empty arrays.

- [ ] **Step 4: Add the model test to the default suite and run it**

Modify `package.json` so `pnpm test` includes `scripts/chat-model.test.mjs` in its `node --test` invocation.

Run: `node --test scripts/chat-model.test.mjs`

Expected: all four tests PASS.

- [ ] **Step 5: Commit Task 1**

```bash
git add src/chat/chatModel.js scripts/chat-model.test.mjs package.json
git commit -m "test: define deterministic chat timeline"
```

### Task 2: Per-conversation draft persistence and retry-safe composer state

**Files:**
- Create: `src/chat/chatDraft.js`
- Create: `src/chat/useChatComposer.js`
- Create: `scripts/chat-draft.test.mjs`
- Modify: `package.json:8-18`

**Interfaces:**
- Consumes: existing `onSendMessage(payload)` callback; it remains responsible for optimistic persistence and Supabase reconciliation.
- Produces: `getChatDraftKey({ role, studentId })`, `loadChatDraft(storage, context)`, `saveChatDraft(storage, context, text)`, and `useChatComposer({ context, storage, onSend, buildPayload })`.
- Hook returns `{ draft, setDraft, attachment, attachmentPreview, sending, error, clearAttachment, selectAttachment, submit, retry }`.

- [ ] **Step 1: Write failing persistence tests**

Create `scripts/chat-draft.test.mjs`:

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { getChatDraftKey, loadChatDraft, saveChatDraft } from '../src/chat/chatDraft.js'

function memoryStorage() {
  const state = new Map()
  return {
    getItem: (key) => state.get(key) ?? null,
    setItem: (key, value) => state.set(key, String(value)),
    removeItem: (key) => state.delete(key),
  }
}

test('isolates drafts by role and student conversation', () => {
  const storage = memoryStorage()
  saveChatDraft(storage, { role: 'coach', studentId: 'a' }, 'Retorno A')
  saveChatDraft(storage, { role: 'coach', studentId: 'b' }, 'Retorno B')
  saveChatDraft(storage, { role: 'student', studentId: 'a' }, 'Dúvida')
  assert.equal(loadChatDraft(storage, { role: 'coach', studentId: 'a' }), 'Retorno A')
  assert.equal(loadChatDraft(storage, { role: 'coach', studentId: 'b' }), 'Retorno B')
  assert.equal(loadChatDraft(storage, { role: 'student', studentId: 'a' }), 'Dúvida')
})

test('normalizes unsafe identifiers and removes an empty draft', () => {
  const storage = memoryStorage()
  const context = { role: 'coach', studentId: '../Aluno 01' }
  const key = getChatDraftKey(context)
  assert.doesNotMatch(key, /\.\./)
  saveChatDraft(storage, context, 'texto')
  saveChatDraft(storage, context, '')
  assert.equal(loadChatDraft(storage, context), '')
})
```

- [ ] **Step 2: Run the tests and verify they fail before implementation**

Run: `node --test scripts/chat-draft.test.mjs`

Expected: FAIL with `ERR_MODULE_NOT_FOUND`.

- [ ] **Step 3: Implement storage helpers and the hook**

Use this storage contract in `src/chat/chatDraft.js`:

```js
export const CHAT_DRAFT_PREFIX = 'coachfit.chat.draft.v1'

export function getChatDraftKey({ role = 'user', studentId = 'conversation' } = {}) {
  const safe = (value) => encodeURIComponent(String(value || '').trim().toLowerCase())
  return `${CHAT_DRAFT_PREFIX}:${safe(role)}:${safe(studentId)}`
}
```

`saveChatDraft` must remove the key for blank text and catch unavailable-storage errors. `useChatComposer` must restore the current conversation draft, persist each text change, validate only image/audio files using the existing 8 MB/20 MB limits, revoke blob URLs on replacement/unmount, clear state only immediately before `await onSend(payload)`, and restore draft/attachment if that promise rejects. `retry()` must call the same guarded submit path rather than append another local UI record.

- [ ] **Step 4: Run focused tests and package suite**

Add `scripts/chat-draft.test.mjs` to `pnpm test`.

Run: `node --test scripts/chat-draft.test.mjs scripts/chat-model.test.mjs`

Expected: all tests PASS.

- [ ] **Step 5: Commit Task 2**

```bash
git add src/chat/chatDraft.js src/chat/useChatComposer.js scripts/chat-draft.test.mjs package.json
git commit -m "feat: preserve chat drafts per conversation"
```

### Task 3: Shared message timeline, grouping, and scroll intelligence

**Files:**
- Create: `src/chat/ChatTimeline.jsx`
- Create: `src/chat/useChatViewport.js`
- Create: `src/chat/chat.css`
- Create: `scripts/chat-components-contract.test.mjs`
- Modify: `src/main.jsx:1-10`
- Modify: `package.json:8-18`

**Interfaces:**
- Consumes: `buildChatTimeline()` from Task 1 and existing message objects from `src/App.jsx`.
- Produces: `ChatMessageList`, `MessageBubble`, `DateSeparator`, `NewMessagesIndicator`, `EmptyChatState`, `ChatLoadState`, and `useChatViewport({ conversationId, messageCount })`.
- `ChatMessageList` props: `{ messages, ownSender, renderAttachment, renderActions, emptyText, loading, loadError, connectionState, onRetryLoad }`.

- [ ] **Step 1: Add failing component contract tests**

Create `scripts/chat-components-contract.test.mjs` and assert the new module exports semantic components and no native audio player appears in `ChatTimeline.jsx`:

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const timeline = readFileSync(new URL('../src/chat/ChatTimeline.jsx', import.meta.url), 'utf8')
const css = readFileSync(new URL('../src/chat/chat.css', import.meta.url), 'utf8')

test('shared timeline owns message semantics and new-message navigation', () => {
  assert.match(timeline, /export function ChatMessageList/)
  assert.match(timeline, /export function MessageBubble/)
  assert.match(timeline, /export function DateSeparator/)
  assert.match(timeline, /export function NewMessagesIndicator/)
  assert.match(timeline, /export function ChatLoadState/)
  assert.match(timeline, /aria-live="polite"/)
})

test('message CSS constrains long content and respects reduced motion', () => {
  assert.match(css, /overflow-wrap:\s*anywhere/)
  assert.match(css, /max-width:\s*min\(/)
  assert.match(css, /prefers-reduced-motion/)
})
```

- [ ] **Step 2: Run contract tests and confirm missing-file failure**

Run: `node --test scripts/chat-components-contract.test.mjs`

Expected: FAIL with `ENOENT` for `ChatTimeline.jsx`.

- [ ] **Step 3: Implement timeline components**

`ChatMessageList` must render timeline entries from Task 1 and use `role="log"`, `aria-live="polite"`, and `aria-relevant="additions text"`. `ChatLoadState` renders a compact skeleton while loading, an actionable retry state for `loadError`, and a non-blocking “Conexão instável” banner only when `connectionState === 'unstable'`. `MessageBubble` receives `{ message, own, isFirst, isLast, renderAttachment, renderActions }`, renders deleted messages explicitly, and exposes delivery labels for `sending`, `failed`, and `sent`. Long strings use `overflow-wrap:anywhere`; bubble width uses `max-width:min(78%, 42rem)` and becomes `min(86%, 42rem)` below 480 px.

Implement `useChatViewport` with this return contract:

```js
{
  viewportRef,
  bottomRef,
  unseenCount,
  isNearBottom,
  onScroll,
  scrollToBottom,
}
```

It must reset and jump to bottom on `conversationId` change, smooth-scroll only when already near the bottom, increment `unseenCount` otherwise, and clear the indicator when the user returns to the bottom. Use a 120 px threshold and guard absent DOM APIs.

- [ ] **Step 4: Import chat CSS and run tests**

Add `import './chat/chat.css'` to `src/main.jsx` and add the contract test to `pnpm test`.

Run: `node --test scripts/chat-model.test.mjs scripts/chat-components-contract.test.mjs`

Expected: PASS.

Run: `pnpm run build`

Expected: Vite build exits 0.

- [ ] **Step 5: Commit Task 3**

```bash
git add src/chat/ChatTimeline.jsx src/chat/useChatViewport.js src/chat/chat.css scripts/chat-components-contract.test.mjs src/main.jsx package.json
git commit -m "feat: add shared chat timeline and scroll behavior"
```

### Task 4: Professional composer, attachments, recorder, and custom audio player

**Files:**
- Create: `src/chat/ChatComposer.jsx`
- Create: `src/chat/AudioRecorder.jsx`
- Create: `src/chat/AudioMessage.jsx`
- Create: `src/chat/AttachmentMessage.jsx`
- Modify: `src/chat/chat.css`
- Modify: `scripts/chat-components-contract.test.mjs`
- Modify: `scripts/chat-audio-enhancements.test.mjs`

**Interfaces:**
- Consumes: `useChatComposer()` from Task 2 and `formatChatAttachmentLabel` behavior currently in `src/App.jsx`.
- Produces: `ChatComposer`, `AudioRecorder`, `AudioMessage`, and `AttachmentMessage`.
- `ChatComposer` props: `{ role, studentId, placeholder, disabled, buildPayload, onSend, Icon }`.
- `AudioRecorder` props: `{ disabled, onRecorded, onError, Icon }`.
- `AudioMessage` props: `{ src, label }`.

- [ ] **Step 1: Extend failing tests for the composer and custom audio**

Add assertions to `scripts/chat-components-contract.test.mjs`:

```js
const composer = readFileSync(new URL('../src/chat/ChatComposer.jsx', import.meta.url), 'utf8')
const audio = readFileSync(new URL('../src/chat/AudioMessage.jsx', import.meta.url), 'utf8')

test('composer switches between microphone and submit without losing accessibility', () => {
  assert.match(composer, /aria-label="Anexar foto ou áudio"/)
  assert.match(composer, /aria-label="Enviar mensagem"/)
  assert.match(composer, /aria-label="Gravar áudio"/)
  assert.match(composer, /onKeyDown/)
})

test('audio uses integrated controls instead of visible native controls', () => {
  assert.match(audio, /<audio/)
  assert.doesNotMatch(audio, /<audio[^>]*\scontrols/)
  assert.match(audio, /aria-label=.*Reproduzir áudio/)
  assert.match(audio, /type="range"/)
})
```

- [ ] **Step 2: Run tests and verify the missing component failure**

Run: `node --test scripts/chat-components-contract.test.mjs`

Expected: FAIL with `ENOENT` for `ChatComposer.jsx`.

- [ ] **Step 3: Implement attachment and audio presentation**

`AttachmentMessage` must use image preview for image MIME/extension, `AudioMessage` for audio MIME/extension, and the existing safe link fallback for historical unknown attachments. It must never print a raw URL as display text. `AudioMessage` controls an internal `<audio preload="metadata">` using React state for play/pause, duration, current time, progress, end, and load error; it exposes a 44 px play button and a labeled range input.

- [ ] **Step 4: Implement recorder and composer**

Move the existing `MediaRecorder` capability into `AudioRecorder`, retaining MIME order `audio/webm;codecs=opus`, `audio/mp4`, `audio/webm`, `audio/ogg;codecs=opus`; release every track on cancel, stop, error, `pointercancel`, and unmount. Keep touch gestures for slide-to-cancel and slide-up lock, plus explicit cancel/finish buttons when locked.

`ChatComposer` must render this stable structure:

```jsx
<form className="chat-compose" onSubmit={submit}>
  {attachmentPreview ? <AttachmentPreview /> : null}
  {recording ? <AudioRecorderState /> : (
    <div className="chat-compose-row">
      <AttachmentButton />
      <textarea rows={1} value={draft} onChange={handleDraftChange} onKeyDown={handleKeyDown} />
      {draft.trim() || attachment ? <SendButton /> : <AudioRecorder />}
    </div>
  )}
  {error ? <ChatSendError onRetry={retry} /> : null}
</form>
```

Enter submits only on desktop when Shift is not pressed and composition is inactive. The textarea auto-grows from 44 px to 144 px. Buttons use the supplied existing `NavIcon` renderer through the `Icon` prop; no new icon dependency is added.

- [ ] **Step 5: Update CSS and run focused regression**

Add safe-area bottom padding, 44 px touch targets, recording states, attachment preview constraints, dark/light tokens, focus-visible styles, and reduced-motion overrides to `src/chat/chat.css`.

Run: `node --test scripts/chat-components-contract.test.mjs scripts/chat-audio-enhancements.test.mjs scripts/chat-draft.test.mjs`

Expected: PASS after updating legacy source assertions to accept the new shared components while retaining MIME, cleanup, and optimistic-send coverage.

Run: `pnpm run build`

Expected: exits 0.

- [ ] **Step 6: Commit Task 4**

```bash
git add src/chat/ChatComposer.jsx src/chat/AudioRecorder.jsx src/chat/AudioMessage.jsx src/chat/AttachmentMessage.jsx src/chat/chat.css scripts/chat-components-contract.test.mjs scripts/chat-audio-enhancements.test.mjs
git commit -m "feat: build professional chat composer and audio"
```

### Task 5: Integrate the immersive student chat

**Files:**
- Create: `src/chat/ChatHeader.jsx`
- Create: `src/chat/ChatConversation.jsx`
- Modify: `src/App.jsx:14393-14780`
- Modify: `src/App.jsx:16540-16572`
- Modify: `src/chat/chat.css`
- Modify: `scripts/chat-browser.mjs`

**Interfaces:**
- Consumes: shared timeline, attachment, audio, composer, current `onSendMessage`, `onEditMessage`, `onDeleteMessage`, and student polling callback.
- Produces: student `ChatConversation` configuration with `viewerRole="student"`, `ownSender="student"`, and full-screen mobile mode.
- `ChatConversation` props include `{ viewerRole, studentId, contact, messages, onSendMessage, onEditMessage, onDeleteMessage, onBack, onRefresh, buildPayload, Icon, immersive }`.

- [ ] **Step 1: Write failing student browser assertions**

Extend the student fixture in `scripts/chat-browser.mjs` before changing production UI:

```js
assert.equal(await page.locator('[data-chat-role="student"]').isVisible(), true)
assert.equal(await page.getByRole('heading', { name: 'Seu treinador' }).isVisible(), true)
assert.equal(await page.getByRole('button', { name: 'Voltar' }).isVisible(), true)
assert.equal(await page.locator('.chat-compose').isVisible(), true)
assert.equal(await page.locator('audio[controls]').count(), 0)
```

Seed messages on two dates with consecutive senders and assert exactly two date separators and grouped bubble classes. At 320 px by 560 px, assert the composer bottom is no lower than the student navigation top and `document.documentElement.scrollWidth <= innerWidth + 1`.

- [ ] **Step 2: Run the browser suite and confirm the new semantic selectors fail**

Run: `pnpm run test:chat-browser`

Expected: FAIL because `[data-chat-role="student"]` and the shared composer are absent.

- [ ] **Step 3: Replace student duplicate rendering with `ChatConversation`**

In `StudentMessagePanel`, remove local draft, attachment, send, scroll, recorder, and message mapping state. Render `ChatConversation` with this payload mapping:

```js
({ body, attachmentFile, attachmentPreview }) => ({
  coachId,
  studentId: student.id,
  sender: 'student',
  body,
  attachmentFile,
  attachmentPreview,
})
```

Keep `MessageActions` through `renderActions`. `StudentChatScreen` owns polling exactly as today and passes `immersive`. Add a real back callback that returns to the student tab selected before messages, with a safe fallback to `inicio`.

- [ ] **Step 4: Implement full-screen mobile geometry**

Use a student shell with `height:var(--chat-visual-height, 100dvh)`, `position:fixed`, `inset:0`, safe-area top/bottom padding, a compact fixed header, `min-height:0` message viewport, and fixed-flex composer. On tablet/desktop, release `position:fixed` and fit within the existing portal content.

- [ ] **Step 5: Run student browser and unit regressions**

Run: `pnpm run test:chat-browser`

Expected: student text, image, audio, retry, draft, date grouping, 320/390 px geometry, and no-overflow checks PASS.

Run: `pnpm test`

Expected: exits 0.

- [ ] **Step 6: Commit Task 5**

```bash
git add src/chat/ChatHeader.jsx src/chat/ChatConversation.jsx src/App.jsx src/chat/chat.css scripts/chat-browser.mjs
git commit -m "feat: deliver immersive student chat"
```

### Task 6: Integrate professional conversation list and responsive workspace

**Files:**
- Create: `src/chat/ConversationList.jsx`
- Modify: `src/App.jsx:18854-19190`
- Modify: `src/chat/ChatConversation.jsx`
- Modify: `src/chat/chat.css`
- Modify: `scripts/chat-browser.mjs`

**Interfaces:**
- Consumes: `buildConversationRows()` from Task 1, shared `ChatConversation`, current suggestion builder, mark-read callback, and professional polling callback.
- Produces: `ConversationList({ rows, selectedStudentId, onSelect, Icon })` and professional workspace with `data-chat-role="coach"`.

- [ ] **Step 1: Add failing professional browser assertions**

Seed at least two students where the newest message belongs to the second student, then assert:

```js
const rows = page.locator('[data-conversation-id]')
assert.equal(await rows.nth(0).getAttribute('data-conversation-id'), 'student-b')
assert.equal(await rows.nth(0).getByText('Mensagem mais recente').isVisible(), true)
assert.equal(await page.locator('[data-chat-role="coach"]').isVisible(), true)
```

At 390 px, selecting a conversation must show an accessible back button and keep the professional app navigation context. At 1440 px, both list and conversation must be visible at once.

- [ ] **Step 2: Run the browser suite and confirm ordering/layout failure**

Run: `pnpm run test:chat-browser`

Expected: FAIL because current `messages.find()` does not guarantee latest-activity ordering and new semantic containers do not exist.

- [ ] **Step 3: Replace the professional duplicate implementation**

In `Messages`, keep selected student state, polling, read marking, and suggestion generation. Replace direct list/message/composer markup with `ConversationList` and `ChatConversation`. Use this professional payload mapping:

```js
({ body, attachmentFile, attachmentPreview }) => ({
  studentId: selectedStudent.id,
  sender: 'coach',
  body,
  attachmentFile,
  attachmentPreview,
})
```

Use `buildConversationRows(students, messages)` so latest preview, time, unread count, and ordering are deterministic. Preserve the selected student when refreshed; if it disappears, select the first remaining row.

- [ ] **Step 4: Implement responsive professional workspace**

Desktop uses `grid-template-columns:minmax(17rem, 22rem) minmax(0, 1fr)` with a constrained conversation content width. Mobile shows the list first; selecting a row opens the integrated conversation pane, and back returns to the list without leaving the Messages area. Do not use a global fixed overlay for the professional mobile view.

- [ ] **Step 5: Run professional browser and product regressions**

Run: `pnpm run test:chat-browser`

Expected: coach ordering, unread badge, selection, text/image/audio, 390 px integrated view, and 1440 px two-column view PASS.

Run: `pnpm run test:browser`

Expected: main product browser flow exits 0.

- [ ] **Step 6: Commit Task 6**

```bash
git add src/chat/ConversationList.jsx src/chat/ChatConversation.jsx src/App.jsx src/chat/chat.css scripts/chat-browser.mjs
git commit -m "feat: add professional responsive chat workspace"
```

### Task 7: Retire replaced DOM mutation layers without breaking wallpaper

**Files:**
- Modify: `src/main.jsx:1-58`
- Modify: `chatEnhancements.js`
- Modify: `chatAudioEnhancements.js`
- Modify: `chat-enhancements.css`
- Modify: `chat-audio.css`
- Modify: `scripts/chat-enhancements.test.mjs`
- Modify: `scripts/chat-audio-enhancements.test.mjs`

**Interfaces:**
- Consumes: semantic classes rendered by Tasks 3-6.
- Preserves: `installChatWallpaperEnhancements()`, wallpaper storage key, presets, custom image preparation, and contrast controls.
- Produces: no MutationObserver-based layout, bubble, composer, header, scroll, or audio-player decoration.

- [ ] **Step 1: Change tests to require React ownership before deleting decorators**

Update tests to assert:

```js
assert.doesNotMatch(productionMain, /installChatEnhancements/)
assert.doesNotMatch(productionMain, /installChatAudioEnhancements/)
assert.match(productionMain, /installChatWallpaperEnhancements/)
assert.doesNotMatch(chatSource, /decorateMessageBubbles/)
assert.doesNotMatch(audioSource, /decorateAudio|MutationObserver/)
```

Keep all wallpaper persistence, safe-data-URL, dimensions, custom-image, and dark-theme assertions.

- [ ] **Step 2: Run tests and verify they fail while legacy installers remain**

Run: `node --test scripts/chat-enhancements.test.mjs scripts/chat-audio-enhancements.test.mjs`

Expected: FAIL on the installer/decorator absence assertions.

- [ ] **Step 3: Remove only replaced installation and decoration code**

Remove `installChatEnhancements()` and `installChatAudioEnhancements()` imports/calls from `src/main.jsx`. Delete their layout/audio DOM mutation code and obsolete selectors. Keep pure helpers still imported by tests only if shared React code imports them; otherwise move those helpers into `src/chat` and update imports before deleting.

Retain `chatEnhancements.js` or `chatAudioEnhancements.js` only for any still-referenced compatibility helper. Delete obsolete CSS rules after confirming equivalent rules exist in `src/chat/chat.css`; do not remove wallpaper CSS or wallpaper enhancer installation.

- [ ] **Step 4: Run legacy and new chat tests**

Run: `node --test scripts/chat-model.test.mjs scripts/chat-draft.test.mjs scripts/chat-components-contract.test.mjs scripts/chat-enhancements.test.mjs scripts/chat-audio-enhancements.test.mjs`

Expected: PASS.

Run: `pnpm run build`

Expected: exits 0 with no unresolved imports.

- [ ] **Step 5: Commit Task 7**

```bash
git add src/main.jsx chatEnhancements.js chatAudioEnhancements.js chat-enhancements.css chat-audio.css scripts/chat-enhancements.test.mjs scripts/chat-audio-enhancements.test.mjs src/chat
git commit -m "refactor: move chat presentation ownership into React"
```

### Task 8: Full browser matrix, failure recovery, themes, and extreme content

**Files:**
- Modify: `scripts/chat-browser.mjs`
- Modify: `src/chat/chat.css`
- Modify: `src/chat/ChatConversation.jsx`
- Modify: `src/chat/ChatComposer.jsx`
- Modify: `package.json:8-18`

**Interfaces:**
- Consumes: complete shared chat UI from Tasks 1-7.
- Produces: a repeatable browser acceptance suite covering both roles and all required breakpoints.

- [ ] **Step 1: Expand the browser fixture before polishing failures**

Run the same behavioral fixture at widths `[320, 360, 375, 390, 414, 768, 1440]`, using 560 px and 900 px heights for mobile. Seed:

- no avatar and a 70-character contact name;
- empty history and 120-message history;
- a 300-character unbroken token and emoji message;
- image, audio, deleted, sending, failed, and sent messages;
- two calendar dates and grouped consecutive senders.

Add assertions for text, rapid messages, draft reload, failure/retry uniqueness, cancel audio, send audio, image open, date separators, unseen indicator, wallpaper, dark mode, tab focus order, reduced motion, no native audio controls, no horizontal overflow, and composer accessibility.

- [ ] **Step 2: Run the expanded suite and record each genuine failure**

Run: `pnpm run test:chat-browser`

Expected: any failing assertion identifies a specific geometry, state, or accessibility defect; no assertion may be weakened merely to pass.

- [ ] **Step 3: Fix only defects demonstrated by the matrix**

Apply targeted changes in shared components/CSS. For example, use `min-width:0` on every flex/grid content child, `overflow-wrap:anywhere` for text, `padding-bottom:max(0.75rem, env(safe-area-inset-bottom))` for the composer, stable image aspect constraints, and `scrollbar-gutter:stable` only where supported. Keep focus outlines and live-region messages visible to assistive technology.

- [ ] **Step 4: Validate keyboard-height behavior with visual viewport emulation**

In the browser fixture, dispatch a mocked visual viewport resize and set `--chat-visual-height` to 560 px. Assert the composer remains inside the chat shell and the last message can be scrolled above it. Restore height and assert no stale inline geometry remains.

- [ ] **Step 5: Run the complete chat acceptance suite**

Run: `pnpm run test:chat-browser`

Expected: every width/role reports PASS, screenshots are generated under `__qa-output/readiness-chat`, and collected `pageerror`/console error arrays are empty.

Run: `pnpm test`

Expected: exits 0.

- [ ] **Step 6: Commit Task 8**

```bash
git add scripts/chat-browser.mjs src/chat package.json
git commit -m "test: validate chat across roles and breakpoints"
```

### Task 9: Final regression, visual review, and branch checkpoint

**Files:**
- Modify only files implicated by a failing verification command or confirmed visual defect.
- Verify: `docs/superpowers/specs/2026-09-20-chat-redesign-design.md`
- Verify: `docs/superpowers/plans/2026-09-20-chat-redesign.md`

**Interfaces:**
- Consumes: all previous tasks.
- Produces: verified chat branch ready for review, with no schema or migration changes.

- [ ] **Step 1: Run static and unit quality gates**

Run in order:

```bash
pnpm run lint
pnpm run typecheck
pnpm test
pnpm run build
```

Expected: all commands exit 0. Fix only chat-related regressions introduced by this branch and rerun the failing command from a clean terminal invocation.

- [ ] **Step 2: Run browser gates**

```bash
pnpm run test:chat-browser
pnpm run test:browser
pnpm run test:profiles-browser
```

Expected: all commands exit 0 with no browser console/page errors.

- [ ] **Step 3: Inspect screenshots at required widths**

Open the generated screenshots for 320, 360, 375, 390, 414, 768, and 1440 px. Confirm no overlap, clipping, horizontal scroll, illegible wallpaper contrast, hidden composer, oversized header, native audio UI, or ambiguous primary action. Inspect both themes and both roles.

- [ ] **Step 4: Review the branch diff for scope and secrets**

Run:

```bash
git diff --check origin/main...HEAD
git status --short
git diff --stat origin/main...HEAD
```

Expected: no whitespace errors, no `.env`, secrets, `node_modules`, `dist`, or `__qa-output` changes, and no Supabase migration/schema changes.

- [ ] **Step 5: Create the verified checkpoint**

If visual fixes were necessary, commit them:

```bash
git add src/chat src/App.jsx src/main.jsx scripts package.json chatEnhancements.js chatAudioEnhancements.js chat-enhancements.css chat-audio.css
git commit -m "fix: polish chat acceptance regressions"
```

If no files changed after verification, keep the Task 8 commit as the checkpoint. Record the final commit hash with `git rev-parse --short HEAD` and report whether any real-device keyboard behavior remains unconfirmed.

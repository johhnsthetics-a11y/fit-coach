# Coach Messenger UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the existing Coach Fit chat into a familiar, WhatsApp-like professional messenger while preserving the current messaging backend and behavior.

**Architecture:** Keep the existing React/Supabase chat flow untouched. Extend the existing DOM enhancement layer (`chatEnhancements.js`) to add stable semantic classes, compact suggestion controls, composer affordances, conversation metadata decoration, and mobile navigation markers; implement the visual redesign entirely in `chat-enhancements.css` so the change is isolated and reversible.

**Tech Stack:** React 18, Vite, vanilla DOM enhancement JavaScript, CSS, Node test runner.

**Spec:** Approved chat direction from 2026-09-17 conversation: conversation list with familiar messenger hierarchy; compact header; light conversation canvas; own/other message bubbles; compact suggested-reply chip; integrated attachment/audio/send composer; smart scroll; responsive full-screen mobile behavior; no Supabase or RLS changes.

## Global Constraints

- Do not change Supabase schema, RLS, message persistence, or APIs.
- Do not change unrelated app pages.
- Preserve existing Enter-to-send, Shift+Enter newline, smart autoscroll, attachments, audio, and message submit behavior.
- Keep the production entrypoint in `src/main.jsx`.
- Prefer additive DOM classes and CSS over editing the 1 MB `src/App.jsx` monolith.
- Respect reduced-motion preferences.

---

### Task 1: Regression contract for the messenger semantics

**Files:**
- Modify: `scripts/chat-enhancements.test.mjs`

**Interfaces:**
- Consumes: exports from `chatEnhancements.js`.
- Produces: regression coverage for new exported class-name contract and helper behavior.

- [ ] **Step 1: Write the failing tests**

Add tests that expect exported messenger class constants for workspace, thread list, header, suggestion, viewport, composer, send action, and attachment action; also verify the production CSS contains the messenger-specific selectors.

- [ ] **Step 2: Run the chat enhancement test and verify failure**

Run: `pnpm exec node --test scripts/chat-enhancements.test.mjs`
Expected: FAIL because the new exported class contract does not exist yet.

- [ ] **Step 3: Commit the red test**

Commit only the test change.

### Task 2: Messenger DOM enhancement layer

**Files:**
- Modify: `chatEnhancements.js`

**Interfaces:**
- Consumes: current rendered chat DOM and existing composer selectors.
- Produces: semantic classes and lightweight UI affordances without changing message persistence.

- [ ] **Step 1: Export the messenger class contract**

Add a single immutable `CHAT_MESSENGER_CLASSES` object containing class names for workspace, thread list, thread, header, suggestion, viewport, composer, send button, and attachment button.

- [ ] **Step 2: Decorate the coach chat shell**

Walk up from the coach composer to identify the two-column chat workspace, mark the conversations pane and conversation panel, decorate the active chat header, and preserve existing labels/text except for presentational wrappers/classes.

- [ ] **Step 3: Compact the suggested reply block**

Detect the existing suggested-response block from its button/text structure, add a dedicated class, and allow CSS to render it as a compact assistant strip above the composer.

- [ ] **Step 4: Refine composer semantics**

Mark send/attachment/audio controls with dedicated classes, keep Enter/Shift+Enter behavior unchanged, enable auto-growing textarea height on input, and reset height after submit.

- [ ] **Step 5: Run the focused test and verify green**

Run: `pnpm exec node --test scripts/chat-enhancements.test.mjs`
Expected: PASS.

### Task 3: WhatsApp-like Coach Fit visual system

**Files:**
- Modify: `chat-enhancements.css`

**Interfaces:**
- Consumes: classes produced by `chatEnhancements.js`.
- Produces: desktop and mobile messenger layout.

- [ ] **Step 1: Replace the dark conversation canvas**

Use a light/neutral canvas with a subtle Coach Fit tech texture, comfortable message spacing, clear contrast, and no large black panel.

- [ ] **Step 2: Redesign message bubbles**

Render coach messages on the right with Coach Fit teal/green styling, student messages on the left in white/light neutral, natural width, compact timestamp treatment, and restrained shadows.

- [ ] **Step 3: Redesign conversation list and header**

Use compact rows, round avatars, selected-row highlight, stronger name hierarchy, and a compact chat header with online/status accent.

- [ ] **Step 4: Redesign the composer**

Create a single rounded messenger composer with integrated attachment/audio controls and compact send action; remove the form-like appearance while keeping all original controls usable.

- [ ] **Step 5: Add mobile messenger behavior**

On narrow screens, prioritize the active conversation as a full-width chat surface, keep touch targets large, keep composer visually anchored, and avoid horizontal overflow.

- [ ] **Step 6: Honor reduced motion**

Disable message entrance transitions for `prefers-reduced-motion`.

### Task 4: Full verification and release

**Files:**
- No production files beyond the files above.

**Interfaces:**
- Produces: evidence that the change is safe to merge.

- [ ] **Step 1: Run typecheck**

Run: `pnpm run typecheck`
Expected: exit 0.

- [ ] **Step 2: Run lint/theme smoke**

Run: `pnpm run lint`
Expected: exit 0.

- [ ] **Step 3: Run full test suite**

Run: `pnpm test`
Expected: all tests pass.

- [ ] **Step 4: Run database regression suite**

Run: `pnpm run test:database`
Expected: exit 0 and no database behavior regression.

- [ ] **Step 5: Run production build**

Run: `pnpm run build`
Expected: exit 0.

- [ ] **Step 6: Create PR, verify CI, merge, and confirm production deployment**

Create a PR from `gpt56/coach-messenger-ui-20260917` to `main`, wait for required checks, merge only after all required checks pass, and confirm the production deployment check succeeds.

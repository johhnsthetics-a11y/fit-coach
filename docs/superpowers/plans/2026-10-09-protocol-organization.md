# Organização de Protocolos Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a persistent, coach-scoped protocol task planner as a second tab inside Agenda, with student links, day/week organization, status tracking, notes, filters, and browser-generated PDF.

**Architecture:** Keep appointments unchanged. Store protocol tasks in a dedicated RLS-protected Supabase table; use a focused model/API layer and a component mounted in Agenda only when its tab is selected. Generate printable PDF HTML locally and fetch tasks on tab entry or explicit refresh, with no polling.

**Tech Stack:** React, existing Tailwind/CSS, existing REST helpers in `src/supabaseApi.js`, Supabase Postgres/RLS, PGlite tests, browser print.

**Spec:** `docs/superpowers/specs/2026-10-09-protocol-organization-design.md`

## Global Constraints

- No new runtime or development dependencies.
- Categories: `training`, `nutrition`, `follow_up`, `general`; priorities: `low`, `normal`, `high`; statuses: `pending`, `in_progress`, `done`, `canceled`.
- Every row belongs to the authenticated professional; any linked student must belong to that same professional.
- Keep appointments and student portal behavior unchanged; protocol tasks are not student-visible and do not mutate prescriptions.
- PDF generation stays in the browser; no media or PDF upload to Supabase.
- Load on tab entry and explicit refresh; no recurring polling.

## Review Focus

- Cross-coach student IDs on create/update must be rejected by database RLS; cover in Task 1.
- One coach must not read or mutate another coach's tasks; cover in Task 1.
- Deleting a student must preserve the coach's task with `student_id = null`; cover in Task 1.
- Empty/invalid title, category, date, priority, or status must not create malformed data; cover in Task 2.
- User-provided notes and names must be HTML-escaped in printable output; cover in Task 2.

---

### Task 1: Database and RLS

**Files:**
- Create: `supabase/migrations/<CLI-generated>_coach_protocol_tasks.sql`
- Create: `scripts/protocol-organization-database.test.mjs`
- Modify: `package.json` to expose the focused database test.

**Interfaces:**
- Produces table `public.coach_protocol_tasks` with UUID `id`, `coach_id`, nullable `student_id`, `title`, `category`, `planned_date`, `priority`, `notes`, `status`, `created_at`, and `updated_at`.
- Database checks require a non-empty title and restrict category, priority, and status to the enum values listed above.
- `coach_id` references `public.users(id) ON DELETE CASCADE`; `student_id` references `public.students(id) ON DELETE SET NULL`.
- Grant authenticated CRUD; RLS policies scope every operation to `coach_id = auth.uid()` and validate student ownership in insert/update `WITH CHECK`. Do not grant table access to `anon`.

- [ ] **Step 1: Add PGlite tests** for authenticated owner CRUD, cross-coach row isolation, rejecting a foreign student's ID, anonymous denial, and preserving a task when its student is deleted.
- [ ] **Step 2: Run the new database test** and confirm it fails because the migration/table is missing.
- [ ] **Step 3: Generate the migration** with `pnpm dlx supabase migration new coach_protocol_tasks`; write the table, constraints, indexes, grants, and owner/student RLS policies.
- [ ] **Step 4: Run the focused database test** and confirm all ownership and referential-integrity assertions pass.
- [ ] **Step 5: Add the database test to `pnpm test:database`** and add `test:protocol-organization` to run both focused model and database tests.

### Task 2: Task Model and Supabase API

**Files:**
- Create: `src/protocolTasks.js`
- Create: `scripts/protocol-organization-model.test.mjs`
- Modify: `src/supabaseApi.js`
- Modify: `package.json` to expose the focused model test.

**Interfaces:**
- `normalizeProtocolTaskDraft(draft)` validates and returns trimmed UI data with the exact allowed enums and a valid `YYYY-MM-DD` planned date.
- `protocolTaskFromRow(row)` maps snake_case database fields to the app's camelCase task shape.
- `protocolTaskToRow(task, coachId)` maps a validated task to an ownership-bound database payload.
- `formatProtocolDateKey(dateKey)` formats a `YYYY-MM-DD` value without UTC day shifts.
- `loadRemoteProtocolTasks(coachId, { fromDate, toDate } = {})` returns rows scoped to coach and date range.
- `saveRemoteProtocolTask(task, coachId)` inserts or updates and returns the mapped saved row.
- `deleteRemoteProtocolTask(taskId, coachId)` deletes one owner-scoped row.
- `buildProtocolTasksPrintHtml({ tasks, students, professional, fromDate, toDate, filters })` returns escaped, printable HTML.

- [ ] **Step 1: Add model tests** for enum/date/title validation, row mapping, coach ownership in payload, local date labels, and escaping `</script>`/HTML in print output.
- [ ] **Step 2: Run the focused model test** and confirm it fails before implementation.
- [ ] **Step 3: Implement the model and API functions** using the existing `request()` auth/session helper; include coach and date constraints in queries.
- [ ] **Step 4: Run** `pnpm test:protocol-organization` and confirm the model tests pass.

### Task 3: Agenda Tab and Responsive Planner

**Files:**
- Create: `src/OrganizationProtocols.jsx`
- Create: `src/OrganizationProtocols.css`
- Modify: `src/App.jsx`

**Interfaces:**
- `OrganizationProtocols({ coachId, students, professionalType, professional, uiTheme })` owns loading, filters, draft, save/delete, status, refresh, and print state.
- The component uses Task 2's API functions and displays `Aluno` or `Paciente` according to `professionalType`.
- `Agenda` gains `Compromissos` and `Organização de Protocolos` tabs; the current appointment UI remains intact in its tab.

- [ ] **Step 1: Add the tab shell** while leaving the existing appointment form/list behavior unchanged; verify both tabs are selectable on narrow and wide layouts.
- [ ] **Step 2: Implement planner controls** for day/week navigation, category/priority/status/person filters, counts, empty/loading/error states, and retry/refresh.
- [ ] **Step 3: Implement create/edit/complete/reopen/delete** with saved changes reflected only after the remote operation succeeds; preserve draft values and show recovery feedback on errors.
- [ ] **Step 4: Add printable PDF action** using the tested escaped HTML builder and the browser print flow.
- [ ] **Step 5: Run the build** and manually verify 390px and 1440px layouts, tab switching, CRUD, filters, and print preview with synthetic task data.

### Task 4: Integration Verification

**Files:**
- Modify only files from Tasks 1-3 if fixes are needed.

- [ ] **Step 1: Run** `pnpm test:protocol-organization` and `pnpm test:database`; confirm all focused assertions pass.
- [ ] **Step 2: Run** `pnpm test` and `pnpm run build`; confirm no regressions or build failures.
- [ ] **Step 3: Review the final diff** for changes outside Agenda/protocol tasks and confirm the exercise PR checkout remains untouched.

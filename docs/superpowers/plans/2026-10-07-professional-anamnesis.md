# Professional Anamnesis Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a trainer/nutritionist review a linked student's full anamnesis while prescribing a diet and securely fill or update the existing standard anamnesis for that student.

**Architecture:** Reuse the existing anamnesis fields and `ProfessionalAnamnesisSummary`. Add a professional form in the student profile and a collapsible read-only summary in the diet editor, keyed strictly by the diet's student ID. Persist professional edits through an authenticated Supabase RPC that validates `auth.uid()` against `students.coach_id`, records authorship, and does not grant direct table writes.

**Tech Stack:** React, existing Supabase JS RPC wrapper, PostgreSQL migration, Node test runner, PGlite.

**Spec:** User-approved standard form: the professional fills the existing student-facing anamnesis field set; custom question builder is out of scope.

## Global Constraints

- Keep the existing student self-submission route and access flow working.
- Do not weaken or bypass the existing RLS read policy; do not grant direct `INSERT`/`UPDATE` to authenticated clients.
- A professional may only write anamnesis for a student whose `coach_id` equals the authenticated user ID.
- Keep the record and all health data isolated by student/professional ownership.
- No remote migration execution, deployment, unrelated UI redesign, or schema refactor in this task.

## Review Focus

- A different professional must be unable to save or read another professional's student's anamnesis; cover with a database integration test.
- An edit to one student's anamnesis must not replace the selected student's diet context; cover by asserting student-ID matching in the UI contract.
- Empty/partial anamnesis and existing student-submitted records must remain viewable/editable without losing answers; cover with form/API contract tests.
- Role copy must say aluno for trainer and paciente for nutritionist; cover in UI assertions.
- Student self-submission remains callable only through its existing active-invite path; include an existing regression test in verification.

---

### Task 1: Secure professional write and authorship

**Files:**
- Create: `SUPABASE/migrations/20261007183500_professional_student_anamnesis.sql`.
- Create: `scripts/anamnesis-professional-write.test.mjs`.
- Modify: `src/supabaseApi.js`.

**Interfaces:**
- Add `saveRemoteProfessionalAnamnesis(studentId, answers)` and call `save_professional_student_anamnesis` with the student UUID and the standard answer object.
- The database function returns the saved `student_anamneses` row and records whether the source was professional or student, plus the authenticated author for professional writes.

- [x] Write a PGlite regression test for own-student save/update, foreign-student rejection, and no direct authenticated table write.
- [x] Confirm the UI contract fails before the interface implementation. The PGlite package was inaccessible in the default sandbox; the database regression test was run after obtaining access to the existing local dependency.
- [x] Add an additive migration with explicit auth/ownership checks, restricted execute grants, and provenance columns; preserve existing student submission behavior.
- [x] Implement the RPC wrapper and map provenance in `fromAnamnesisRow`.
- [x] Run the new database test and the existing anamnesis/student-access checks.

**Ruling:** The Supabase CLI is not installed in this environment, so the migration file was created directly with the repository's timestamped naming convention rather than with `supabase migration new`. Cost if wrong: only local migration-history tooling may expect the CLI-generated timestamp; the SQL was applied to PGlite for verification.

**Verification note:** The database test did not get a pre-implementation red run because the installed PGlite package initially returned an access error; after running with permission to read the existing dependency, the migrated database scenarios passed.

### Task 2: Professional form and diet-side review

**Files:**
- Modify: `src/App.jsx`.
- Create: `scripts/anamnesis-professional-ui.test.mjs`.

**Interfaces:**
- Reuse the existing anamnesis field set and `ProfessionalAnamnesisSummary`.
- Student profile exposes “Preencher anamnese” or “Editar anamnese”; save refreshes the remote data and displays an actionable error without closing the form.
- Diet editor displays a compact expand/collapse control for the full anamnesis matching `formStudent.id`, with role-appropriate “aluno/paciente” labels.

- [x] Add UI contract tests for field reuse, role labels, and student-ID-only matching; verify they fail first.
- [x] Implement the smallest UI change, keeping existing diet controls and visual language intact.
- [x] Run the new UI test and existing nutrition/access tests.

### Task 3: Full verification

**Files:**
- No additional files.

- [x] Run the project test suite, lint, typecheck, and production build.
- [x] Review the migration diff for RLS, function grants, ownership validation, and preservation of student submission.
- [x] Report that the migration is prepared locally and must be applied to the intended Supabase project before the new write action works; do not claim remote verification or publish.

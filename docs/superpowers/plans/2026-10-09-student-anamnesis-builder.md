# Busca de Alunos e Construtor de Anamnese - Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar busca por nome, e-mail ou CPF na carteira e um fluxo de anamnese personalizável, agendável e prioritário que atualize a ficha mais recente usada na prescrição nutricional.

**Architecture:** O motor existente de questionários será generalizado com `questionnaire_type`, agendamento e prioridade nas atribuições. Modelos do tipo `anamnesis` terão uma página própria dentro de Alunos, mas usarão o mesmo snapshot, renderizador e validação existentes; a conclusão atualizará transacionalmente `student_anamneses`, mantendo o histórico nas atribuições.

**Tech Stack:** React 18, Vite 5, JavaScript ESM, Supabase/PostgreSQL 17, Row Level Security, Node test runner, PGlite.

**Spec:** `docs/superpowers/specs/2026-10-09-student-anamnesis-builder-design.md`

## Global Constraints

- Não bloquear treino, dieta, chat ou outras ferramentas quando uma anamnese prioritária estiver pendente.
- Não criar um segundo motor de formulários; reutilizar questionários, snapshots e respostas atuais.
- Não expor perguntas agendadas ao aluno antes de `scheduled_for`.
- Não conceder escrita direta nas atribuições para `anon` ou `authenticated`.
- Preservar questionários nutricionais, gamificação e anamnese manual existentes.
- Não adicionar dependências de frontend ou backend.
- Manter os arquivos de migration equivalentes nos caminhos `supabase/migrations` e `SUPABASE/migrations` usados pelo repositório.

## Review Focus

- Busca com CPF formatado e sem pontuação deve encontrar o mesmo aluno sem alterar a seleção atual.
- Um modelo de nutrição nunca deve aparecer na página Anamnese, nem um modelo de anamnese na área de questionários nutricionais.
- Horários futuros não podem revelar snapshots ao aluno, mas devem ficar disponíveis ao retornar ao aplicativo após o horário.
- Uma resposta de anamnese incompleta não pode concluir a atribuição nem modificar a ficha canônica.
- Respostas concorrentes ou de outra conta não podem sobrescrever a anamnese de um aluno sem vínculo.

---

### Task 1: Busca Normalizada da Carteira

**Files:**
- Create: `src/studentDirectory.js`
- Create: `scripts/student-directory.test.mjs`
- Modify: `src/App.jsx:7023-7306`
- Modify: `package.json`

**Interfaces:**
- Produces: `normalizeStudentSearch(value: unknown): string`
- Produces: `filterStudents(students: Array<object>, query: string): Array<object>`
- Search fields: `name`, `email`, `cpf`; CPF compares digit-only text in addition to normalized text.

- [ ] **Step 1: Write the failing directory tests**

Add tests named:

- `busca alunos por nome sem diferenciar acentos ou maiúsculas`;
- `busca alunos por e-mail parcial`;
- `busca CPF formatado e somente dígitos`;
- `consulta vazia preserva ordem e todos os alunos`;
- `consulta sem correspondência retorna lista vazia`.

Assert deterministic filtering and that input records are not mutated.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `node --test scripts/student-directory.test.mjs`

Expected: FAIL because `src/studentDirectory.js` does not exist.

- [ ] **Step 3: Implement the search model**

Implement the two exported functions in `src/studentDirectory.js`. Normalize Unicode accents and case; build both searchable text and digit-only CPF text; do not sort or mutate the source array.

- [ ] **Step 4: Run the focused test and verify GREEN**

Run: `node --test scripts/student-directory.test.mjs`

Expected: all directory tests pass.

- [ ] **Step 5: Integrate search into `Students`**

Add local `studentSearch`, derive `visibleStudents` with `filterStudents`, render an accessible search input above the student list, update the displayed count, and show a specific empty result without clearing `selectedStudent`.

- [ ] **Step 6: Add the focused test to `pnpm test` and commit**

Run: `pnpm test`

Expected: existing suite and new directory tests pass.

Commit: `feat: add student directory search`

---

### Task 2: Schema, Agendamento e Atualização Canônica

**Files:**
- Create via CLI: `supabase/migrations/<generated>_student_anamnesis_builder.sql`
- Mirror the generated migration under: `SUPABASE/migrations/<same-generated-name>.sql`
- Create: `scripts/student-anamnesis-builder-database.test.mjs`
- Modify: `package.json`

**Interfaces:**
- Adds `nutrition_questionnaires.questionnaire_type` with values `nutrition | anamnesis`.
- Adds `nutrition_questionnaire_assignments.scheduled_for timestamptz` and `priority_required boolean`.
- Produces RPC `assign_student_anamnesis(selected_questionnaire_id text, selected_student_id uuid, scheduled_for_value timestamptz, priority_required_value boolean) returns jsonb`.
- Extends RPCs `student_nutrition_questionnaires(text)` and `submit_nutrition_questionnaire(text, uuid, jsonb)` without changing their signatures.

- [ ] **Step 1: Create the migration with the Supabase CLI**

Run `pnpm dlx supabase --version`, then `pnpm dlx supabase migration new --help`, then create `student_anamnesis_builder` using the documented command. Use the generated filename everywhere below; do not invent a timestamp.

- [ ] **Step 2: Write failing PGlite database tests**

Cover:

- existing questionnaire rows default to `nutrition`;
- only `nutrition` and `anamnesis` are accepted;
- coach A cannot assign coach B's model or student;
- future assignment is absent from the student RPC result;
- due assignment is present;
- resend of a pending anamnesis updates snapshot, schedule and priority instead of duplicating it;
- missing required answer leaves assignment pending and canonical anamnesis untouched;
- valid answer atomically completes assignment, preserves history, upserts `student_anamneses` and creates one professional notification;
- a later completed anamnesis replaces only the canonical version;
- direct anonymous table access remains revoked.

- [ ] **Step 3: Run database tests and verify RED**

Run: `node --test scripts/student-anamnesis-builder-database.test.mjs`

Expected: FAIL because the new columns and RPC do not exist.

- [ ] **Step 4: Implement the migration**

Use idempotent `alter table ... add column if not exists`, explicit checks, ownership validation with `auth.uid()`, `security definer set search_path = ''`, schema-qualified objects, advisory locking for pending upsert, size/type validation and explicit revoke/grant statements.

The student listing RPC must return only due or completed assignments. The submit RPC must lock the assignment and, only for snapshots whose `questionnaire_type` is `anamnesis`, update `student_anamneses` and notify in the same transaction.

- [ ] **Step 5: Run database tests and verify GREEN**

Run: `node --test scripts/student-anamnesis-builder-database.test.mjs`

Expected: all database contract tests pass, including applying the migration twice.

- [ ] **Step 6: Run existing database regressions and commit**

Run: `pnpm test:database`

Expected: existing and new database tests pass.

Commit: `feat: add scheduled anamnesis assignments`

---

### Task 3: Questionnaire Model and Supabase API Contracts

**Files:**
- Create: `src/questionnaireModel.js`
- Create: `scripts/questionnaire-model.test.mjs`
- Modify: `src/supabaseApi.js:1420-1470`
- Modify: `src/App.jsx:14519-14840`
- Modify: `package.json`

**Interfaces:**
- Produces: `QUESTIONNAIRE_TYPES = { NUTRITION: 'nutrition', ANAMNESIS: 'anamnesis' }`.
- Produces: `createQuestionnaireDraft(source?: object, type?: string): object`.
- Produces: `validateQuestionnaireDraft(draft: object): { valid: boolean, message: string }`.
- Produces: `moveQuestion(questions: Array<object>, questionId: string, direction: -1 | 1): Array<object>`.
- Extends `saveRemoteNutritionQuestionnaire(questionnaire, coachId)` with `questionnaireType`.
- Produces: `assignRemoteStudentAnamnesis({ questionnaireId, studentId, scheduledFor, priorityRequired }): Promise<object>`.
- Assignment mapping adds `scheduledFor` and `priorityRequired`.

- [ ] **Step 1: Write failing questionnaire model tests**

Cover stable IDs, preservation of known question IDs, type separation, validation of selection options, removal without mutation, moving at array boundaries and invalid model types falling back to `nutrition`.

- [ ] **Step 2: Run the focused model tests and verify RED**

Run: `node --test scripts/questionnaire-model.test.mjs`

Expected: FAIL because `src/questionnaireModel.js` does not exist.

- [ ] **Step 3: Extract reusable questionnaire behavior**

Move only pure draft, validation and reordering rules into `src/questionnaireModel.js`. Update the existing nutrition builder to use these exports without changing visible copy or behavior.

- [ ] **Step 4: Extend Supabase row mapping and requests**

Map `questionnaire_type`, `scheduled_for` and `priority_required`; persist `questionnaire_type`; implement the anamnesis assignment RPC call with ISO timestamps and boolean priority.

- [ ] **Step 5: Run focused and existing questionnaire tests**

Run: `node --test scripts/questionnaire-model.test.mjs scripts/nutrition-plan-access.test.mjs scripts/anamnesis-professional-ui.test.mjs`

Expected: all focused tests pass.

- [ ] **Step 6: Commit the shared model and API**

Commit: `refactor: share questionnaire model for anamnesis`

---

### Task 4: Página Profissional de Anamnese em Alunos

**Files:**
- Create: `src/StudentAnamnesisWorkspace.jsx`
- Create: `src/StudentAnamnesisWorkspace.css`
- Create: `scripts/student-anamnesis-workspace.test.mjs`
- Modify: `src/App.jsx:7023-7306`
- Modify: `src/main.jsx`
- Modify: `package.json`

**Interfaces:**
- Produces React component `StudentAnamnesisWorkspace({ nutritionist, students, templates, assignments, selectedStudent, onSelectStudent, onSaveTemplate, onAssignTemplate, uiTheme })`.
- Consumes model functions from Task 3.
- Calls `onSaveTemplate({ ...draft, questionnaireType: 'anamnesis' })`.
- Calls `onAssignTemplate({ questionnaireId, studentId, scheduledFor, priorityRequired })`.

- [ ] **Step 1: Write failing workspace contract tests**

Assert:

- Students has `Carteira` and `Anamnese` tabs;
- workspace lists only anamnesis templates/assignments;
- editor supports add, remove, move up/down, type, required and options;
- send panel requires student and offers `Agora` or `Agendar`;
- past schedule is normalized to immediate send;
- priority copy states that access is not blocked;
- history renders scheduled, pending and completed states;
- trainer copy says aluno and nutritionist copy says paciente.

- [ ] **Step 2: Run workspace tests and verify RED**

Run: `node --test scripts/student-anamnesis-workspace.test.mjs`

Expected: FAIL because the workspace component and tabs do not exist.

- [ ] **Step 3: Build the responsive workspace**

Implement model list, editor, delivery panel and history with no nested cards, stable control dimensions, theme-aware colors, visible focus states and mobile stacking. Preserve unsaved draft and display actionable errors on failed save/send.

- [ ] **Step 4: Wire the Students tabs and handlers**

Keep the existing Carteira markup intact under the first tab. Filter `nutritionQuestionnaires` and assignments by `questionnaireType`; connect the existing save handler and the new assignment handler from Task 3.

- [ ] **Step 5: Run workspace and navigation regressions**

Run: `node --test scripts/student-anamnesis-workspace.test.mjs scripts/navigation-polish.test.mjs scripts/anamnesis-professional-ui.test.mjs`

Expected: all tests pass.

- [ ] **Step 6: Commit the professional workspace**

Commit: `feat: add anamnesis workspace to students`

---

### Task 5: Prioridade do Aluno e Anamnese Mais Recente na Dieta

**Files:**
- Create: `scripts/student-anamnesis-priority.test.mjs`
- Modify: `src/App.jsx:13530-14108`
- Modify: `src/App.jsx:15802-16182`
- Modify: `src/App.jsx:16280-17310`
- Modify: `src/supabaseApi.js:1070-1110`
- Modify: `src/index.css`
- Modify: `package.json`

**Interfaces:**
- Consumes assignment fields `questionnaireType`, `scheduledFor`, `priorityRequired` from Task 3.
- Student priority selects the oldest due pending anamnesis before ordinary questionnaire priorities.
- Diet panel consumes only the canonical `student_anamneses` row and displays `updatedAt`, `source` and current custom answers.

- [ ] **Step 1: Write failing priority and synchronization tests**

Cover:

- due pending anamnesis appears as the first priority;
- future anamnesis is absent;
- priority card opens the questionnaire center but does not gate other tabs;
- nutrition questionnaire copy and XP behavior remain unchanged;
- returning the document to visible state refreshes remote portal data at most once per focus transition;
- diet summary shows latest update timestamp, origin and custom question labels/answers;
- unanswered assignments never appear in the diet summary.

- [ ] **Step 2: Run priority tests and verify RED**

Run: `node --test scripts/student-anamnesis-priority.test.mjs`

Expected: FAIL because anamnesis-specific priority and custom summary do not exist.

- [ ] **Step 3: Implement priority rendering without blocking**

Derive due anamnesis assignments separately, render professional copy and priority badge in `StudentHomeDashboard`, and reuse `StudentQuestionnaireCenter` with anamnesis-aware labels. Do not modify access-lock predicates.

- [ ] **Step 4: Refresh due work on foreground return**

Attach one `visibilitychange` listener in the authenticated student portal lifecycle. When visibility becomes `visible`, call the existing remote refresh path; remove the listener on cleanup and guard concurrent refreshes.

- [ ] **Step 5: Extend the professional anamnesis summary**

Render `updatedAt`, source label and answers by matching the current answer keys to the latest snapshot labels when available; fall back to readable key labels. Continue rendering standardized fields and never read pending assignment answers.

- [ ] **Step 6: Run focused and portal regressions**

Run: `node --test scripts/student-anamnesis-priority.test.mjs scripts/student-access-funnel.test.mjs scripts/anamnesis-professional-ui.test.mjs scripts/nutrition-plan-access.test.mjs scripts/workouts-regression.test.mjs`

Expected: all tests pass.

- [ ] **Step 7: Commit the student and nutrition synchronization**

Commit: `feat: prioritize and sync student anamnesis`

---

### Task 6: Full Verification and Release Readiness

**Files:**
- Modify only files required by failures directly caused by Tasks 1-5.

**Interfaces:**
- No new interfaces; validates the complete feature contract.

- [ ] **Step 1: Run static checks**

Run: `pnpm run typecheck && pnpm run lint`

Expected: exit code 0.

- [ ] **Step 2: Run all application tests**

Run: `pnpm test`

Expected: all tests pass with zero failures.

- [ ] **Step 3: Run all database tests**

Run: `pnpm test:database`

Expected: all database suites pass with zero failures.

- [ ] **Step 4: Build production assets**

Run: `pnpm run build`

Expected: Vite exits 0; existing chunk-size warnings are acceptable, new errors are not.

- [ ] **Step 5: Review security advisors before applying production migration**

Use Supabase MCP `get_advisors` for security and performance. Confirm the new tables/functions add no new warnings; do not change unrelated historical findings in this feature branch.

- [ ] **Step 6: Perform final branch review**

Review `git diff origin/main...HEAD`, migration duplication, RLS grants, account isolation, portal availability timing, empty states and responsive layout. Confirm no generated `dist` changes or secrets are committed.

- [ ] **Step 7: Commit any verification-only corrections**

If needed, commit narrowly with `fix: harden student anamnesis workflow`; otherwise leave the branch unchanged.

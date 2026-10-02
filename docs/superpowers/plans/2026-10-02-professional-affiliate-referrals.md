# Professional Affiliate Referrals Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add secure professional-to-professional referrals that pay an active affiliate 50% of every confirmed trainer or nutritionist subscription payment.

**Architecture:** Keep student/patient and professional commission ledgers separate, extend the existing report RPCs backward-compatibly, and reuse the current professional signup, subscription selection, Cartpanda webhook, affiliate dashboard, and Admin Master finance screens. Attribution is persisted server-side from a one-time opaque invite token and commission creation remains webhook-driven and idempotent.

**Tech Stack:** React 18, Vite, JavaScript/JSX, Tailwind CSS, Supabase Auth/PostgreSQL/RPC/RLS/Edge Functions, Cartpanda, Node test runner, PGlite, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-01-professional-affiliate-referrals-design.md`

## Global Constraints

- Professional referrals pay 50% of the gross amount actually confirmed by Cartpanda for monthly, semiannual, and annual plans.
- Every confirmed renewal produces a new commission; pending or failed payments do not.
- Refunds and chargebacks remain in history but are excluded from payable totals.
- Existing student/patient commissions remain at 25% and keep their current ledger and behavior.
- Attribution requires an opaque invite token, matching authenticated e-mail, compatible professional type, and a persisted server-side relationship.
- Keep RLS enabled, never place `service_role` in the frontend, and expose only narrowly scoped authenticated RPCs.
- Migrations are additive and report responses remain backward-compatible with the currently published frontend.
- Reuse the existing professional subscription screen and Cartpanda checkout URLs; do not create a parallel checkout flow.

## Review Focus

1. An authenticated e-mail mismatch must not consume or cancel a valid invite; Task 2 and Task 3 explicitly test that it remains pending.
2. Two affiliates racing to invite the same normalized e-mail must yield one success and one safe conflict without exposing the winning affiliate; Task 2 tests the database constraint and RPC response.
3. A confirmed professional payment without a trustworthy amount may activate the subscription but must not invent commission; Task 4 tests this split outcome.
4. An affiliate disabled after claim but before payment must receive no new commission; Task 4 tests active status at payment time.
5. Different webhook event IDs representing the same Cartpanda order must not produce duplicate commission; Task 2 and Task 4 test both event and provider-order idempotency.

---

### Task 1: Professional Referral Domain Helpers

**Files:**
- Create: `src/professionalReferral.js`
- Create: `scripts/professional-affiliate-referrals.test.mjs`
- Modify: `package.json`

**Interfaces:**
- Produces: `normalizeProfessionalReferralType(value: unknown): "trainer" | "nutritionist" | null`
- Produces: `normalizeProfessionalReferralToken(value: unknown): string | null`, accepting only 64 lowercase hexadecimal characters after normalization.
- Produces: `buildProfessionalReferralUrl(token: string, baseUrl?: string): string`, using the official login URL and `professional_ref` query parameter.
- Produces: `PROFESSIONAL_REFERRAL_STORAGE_KEY: string`

- [ ] **Step 1: Write focused failing tests for domain normalization and official invite URLs**

Add assertions that trainer/nutritionist aliases normalize correctly, unknown values return `null`, malformed tokens are rejected, and a valid token is added to the official login URL using `URL`/`URLSearchParams` without losing existing query parameters.

- [ ] **Step 2: Run the focused test and verify it fails for missing exports**

Run: `node --test scripts/professional-affiliate-referrals.test.mjs`

Expected: FAIL because `src/professionalReferral.js` does not exist.

- [ ] **Step 3: Implement the minimal pure helpers**

Keep this module free of React, browser globals at import time, and Supabase calls so later UI and API tasks share one validation contract.

- [ ] **Step 4: Add the focused test to the existing `pnpm test` command without removing current suites**

Modify only the relevant test script composition in `package.json`.

- [ ] **Step 5: Run the focused test and the existing aggregate test command**

Run: `node --test scripts/professional-affiliate-referrals.test.mjs`

Expected: PASS.

Run: `pnpm test`

Expected: all existing and new tests PASS.

- [ ] **Step 6: Commit the domain contract**

```bash
git add src/professionalReferral.js scripts/professional-affiliate-referrals.test.mjs package.json
git commit -m "test: define professional referral contract"
```

---

### Task 2: Referral and Professional Commission Database Model

**Files:**
- Create: `supabase/migrations/20261002_professional_affiliate_referrals.sql`
- Create: `SUPABASE/migrations/20261002_professional_affiliate_referrals.sql`
- Create: `scripts/professional-affiliate-referrals-database.test.mjs`
- Modify: `package.json`

**Interfaces:**
- Produces RPC: `create_affiliate_professional_referral(p_referred_email text, p_professional_type text) returns jsonb`
- Produces RPC: `claim_affiliate_professional_referral(p_token text) returns jsonb`
- Produces RPC: `cancel_affiliate_professional_referral(p_referral_id uuid) returns jsonb`
- Produces RPC: `get_my_professional_referrals() returns jsonb`
- Extends RPC: `get_my_commission_report(p_start_date date, p_end_date date) returns jsonb`
- Extends RPC: `get_affiliate_finance_report(p_start_date date, p_end_date date) returns jsonb`
- Produces tables: `affiliate_professional_referrals`, `affiliate_professional_payments`
- Extends table: `affiliate_professionals.professional_type`

- [ ] **Step 1: Write failing PGlite tests for schema, RPC authorization, and reporting**

Cover active affiliate creation, inactive affiliate rejection, self-referral rejection, invalid type, already-active subscriber rejection, normalized duplicate e-mail conflict, concurrent first-writer-wins behavior, token stored only as SHA-256 hash, matching claim, e-mail mismatch remaining pending, type mismatch, cancellation ownership, report isolation, and separate/consolidated totals.

- [ ] **Step 2: Add explicit idempotency tests for two event IDs sharing one provider order**

Assert the payment ledger permits one economic payment only and preserves a single 50% commission row.

- [ ] **Step 3: Run only the new database test and verify it fails**

Run: `node --test scripts/professional-affiliate-referrals-database.test.mjs`

Expected: FAIL because the migration and RPCs do not exist.

- [ ] **Step 4: Add the professional type to `affiliate_professionals` with a safe backfill**

Constrain values to `trainer` and `nutritionist`; backfill from the existing user role when available and use `trainer` only for legacy rows that cannot be resolved, leaving them visible for Admin review.

- [ ] **Step 5: Create `affiliate_professional_referrals` with database-enforced attribution rules**

Use `pgcrypto` to generate 32 random bytes, store only `digest(raw_token, 'sha256')`, add status constraints, foreign keys, timestamps, and a partial unique index that permits only one active (`pending`, `claimed`, or `converted`) referral per normalized e-mail.

- [ ] **Step 6: Create `affiliate_professional_payments` with immutable economic fields and dual idempotency**

Store gross amount, fixed `0.5000` rate, calculated cents, status, provider identifiers, and reversal metadata. Add uniqueness for webhook event ID and a provider-order identity that prevents duplicate economic payments across different webhook event IDs.

- [ ] **Step 7: Implement the four authenticated referral RPCs**

Resolve the caller through `auth.uid()`, validate active affiliate status, normalize e-mail, prevent self-referral and retroactive attribution, compare token hashes server-side, enforce e-mail/type match on claim, and return stable JSON error codes without revealing another affiliate's identity.

- [ ] **Step 8: Apply least-privilege RLS and grants**

Enable RLS on both new tables, revoke direct writes from `anon` and `authenticated`, expose only the RPCs needed by authenticated users, fix `search_path`, and keep Admin/report access aligned with the current Admin Master authorization pattern.

- [ ] **Step 9: Extend both report RPCs without removing existing keys**

Preserve all current student commission fields and add explicit `studentCommissions`, `professionalCommissions`, source totals, and consolidated totals. Include referrals that are pending/claimed so the affiliate can manage invites before conversion.

- [ ] **Step 10: Keep lowercase and uppercase migration trees byte-identical**

Run: `fc /b supabase\migrations\20261002_professional_affiliate_referrals.sql SUPABASE\migrations\20261002_professional_affiliate_referrals.sql`

Expected: no differences.

- [ ] **Step 11: Add the new database test to `test:database` and run it**

Run: `pnpm run test:database`

Expected: all database tests PASS, including race/conflict, e-mail mismatch preservation, idempotency, RLS isolation, and backward-compatible reports.

- [ ] **Step 12: Commit the additive database model**

```bash
git add supabase/migrations/20261002_professional_affiliate_referrals.sql SUPABASE/migrations/20261002_professional_affiliate_referrals.sql scripts/professional-affiliate-referrals-database.test.mjs package.json
git commit -m "feat: add professional affiliate referral ledger"
```

---

### Task 3: Frontend API and Secure Invite Claim

**Files:**
- Modify: `src/supabaseApi.js`
- Modify: `src/App.jsx`
- Modify: `scripts/professional-affiliate-referrals.test.mjs`

**Interfaces:**
- Consumes: Task 1 referral token helpers and Task 2 RPCs.
- Produces: `createRemoteProfessionalReferral({ email, professionalType }): Promise<object>`
- Produces: `claimRemoteProfessionalReferral(token: string): Promise<object>`
- Produces: `cancelRemoteProfessionalReferral(referralId: string): Promise<object>`
- Produces: `loadRemoteProfessionalReferrals(): Promise<object>`
- Produces behavior: capture `professional_ref`, preserve it through authentication, claim after authenticated identity is available, and continue into the existing `CoachSubscription` flow.

- [ ] **Step 1: Add failing contract tests for the four API wrappers**

Assert exact RPC names/parameters, normalized values, consistent Supabase error mapping, and no use of privileged client credentials.

- [ ] **Step 2: Add failing tests for invite lifecycle in `App.jsx`**

Cover URL capture, removal of the token from the visible address, temporary storage under `PROFESSIONAL_REFERRAL_STORAGE_KEY`, successful claim clearing storage, terminal invalid/canceled token clearing storage, and e-mail mismatch preserving the token for the correct account.

- [ ] **Step 3: Run the focused tests and verify the new assertions fail**

Run: `node --test scripts/professional-affiliate-referrals.test.mjs`

Expected: FAIL on missing wrappers and invite lifecycle.

- [ ] **Step 4: Implement the four minimal RPC wrappers in `src/supabaseApi.js`**

Follow current authenticated RPC conventions and reuse existing error normalization.

- [ ] **Step 5: Implement invite capture and authenticated claim in `src/App.jsx`**

Capture only a Task 1-valid token, persist it across login/signup, use `history.replaceState` to remove it from the visible URL, and call the claim RPC only after the authenticated professional identity is loaded.

- [ ] **Step 6: Route a successful claim through the existing professional activation screen**

Do not add another checkout component; keep the current monthly, semiannual, and annual choices in `CoachSubscription`.

- [ ] **Step 7: Run the focused tests**

Run: `node --test scripts/professional-affiliate-referrals.test.mjs`

Expected: PASS, including e-mail mismatch preserving the invite.

- [ ] **Step 8: Commit the secure claim flow**

```bash
git add src/supabaseApi.js src/App.jsx scripts/professional-affiliate-referrals.test.mjs
git commit -m "feat: claim professional referral after authentication"
```

---

### Task 4: Cartpanda Professional Commission Processing

**Files:**
- Modify: `supabase/functions/cartpanda-webhook/index.ts`
- Modify: `SUPABASE/functions/cartpanda-webhook/index.ts`
- Modify: `scripts/cartpanda-payment-policy.test.mjs`
- Modify: `scripts/professional-affiliate-referrals.test.mjs`

**Interfaces:**
- Consumes: Task 2 referral/payment tables and the existing professional subscription update path.
- Produces: `findCommissionableProfessionalReferral(...)`
- Produces: `recordAffiliateProfessionalPayment(...)`
- Produces: `reverseAffiliateProfessionalPayment(...)`
- Preserves: current student/patient 25% commission flow and professional subscription activation.

- [ ] **Step 1: Add failing webhook tests for monthly, semiannual, annual, and renewal payments**

Assert `commission_cents === Math.round(gross_amount_cents * 0.5)`, one row per confirmed economic payment, referral conversion on first payment, and another row for a distinct confirmed renewal.

- [ ] **Step 2: Add failing tests for disabled affiliate, missing amount, and duplicate provider order**

Assert a disabled affiliate receives no new commission, missing trustworthy amount still permits the existing valid subscription activation but records no invented commission, and two event IDs for the same order produce one ledger row.

- [ ] **Step 3: Add failing reversal tests**

Assert refunds and chargebacks set a terminal ledger status, remove the amount from payable totals, retain audit history, and cannot be reverted to paid by a delayed event.

- [ ] **Step 4: Run only webhook-related tests and verify failure**

Run: `node --test scripts/cartpanda-payment-policy.test.mjs scripts/professional-affiliate-referrals.test.mjs`

Expected: FAIL because professional referral commission processing is absent.

- [ ] **Step 5: Add referral lookup after the existing professional subscription update**

Match the claimed referral by authenticated professional user/e-mail relationship, then re-check that the affiliate is active at payment time.

- [ ] **Step 6: Record 50% commission from the confirmed payload amount**

Normalize the provider amount to integer cents, persist the plan cycle and provider identifiers, rely on database uniqueness for idempotency, and mark the referral converted only after a successful ledger insertion or confirmed existing row.

- [ ] **Step 7: Handle missing amount as an auditable partial outcome**

Keep subscription activation behavior intact, emit structured server-side diagnostics with no secrets, return the existing accepted/processable response expected by Cartpanda, and never synthesize an amount.

- [ ] **Step 8: Implement refund and chargeback transitions**

Resolve by provider order/subscription, update only non-terminal paid rows, set reversal timestamp, and preserve the original financial values.

- [ ] **Step 9: Keep both Edge Function copies byte-identical**

Run: `fc /b supabase\functions\cartpanda-webhook\index.ts SUPABASE\functions\cartpanda-webhook\index.ts`

Expected: no differences.

- [ ] **Step 10: Run webhook and database tests**

Run: `node --test scripts/cartpanda-payment-policy.test.mjs scripts/professional-affiliate-referrals.test.mjs`

Expected: PASS.

Run: `pnpm run test:database`

Expected: PASS.

- [ ] **Step 11: Commit webhook commission processing**

```bash
git add supabase/functions/cartpanda-webhook/index.ts SUPABASE/functions/cartpanda-webhook/index.ts scripts/cartpanda-payment-policy.test.mjs scripts/professional-affiliate-referrals.test.mjs
git commit -m "feat: record professional referral commissions"
```

---

### Task 5: Admin Affiliate Type Selection

**Files:**
- Modify: `src/supabaseApi.js`
- Modify: `src/App.jsx`
- Modify: `scripts/affiliate-billing.test.mjs`

**Interfaces:**
- Consumes: Task 2 `affiliate_professionals.professional_type`.
- Changes: `saveRemoteAffiliateProfessional(email, professionalType)` requires `trainer` or `nutritionist`.
- Produces behavior: Admin Master must choose a type before `Vincular profissional`; stored type remains visible for pending accounts.

- [ ] **Step 1: Add failing tests for required type and persisted payload**

Assert the API sends normalized e-mail plus `professional_type`, rejects missing/invalid type, and the UI disables submission until both fields are valid.

- [ ] **Step 2: Add a failing test for existing-profile role mismatch**

Assert a selected trainer type cannot silently overwrite an existing nutritionist account, and the Admin receives a clear validation message.

- [ ] **Step 3: Run the focused affiliate test and verify failure**

Run: `node --test scripts/affiliate-billing.test.mjs`

Expected: FAIL on missing professional type behavior.

- [ ] **Step 4: Update the API wrapper and `AffiliateProfessionalsPanel`**

Add a compact required trainer/nutritionist selector before the current action, preserve the selected type in pending rows, and reuse existing panel styling in light/dark themes.

- [ ] **Step 5: Run the focused test**

Run: `node --test scripts/affiliate-billing.test.mjs`

Expected: PASS.

- [ ] **Step 6: Commit Admin affiliate classification**

```bash
git add src/supabaseApi.js src/App.jsx scripts/affiliate-billing.test.mjs
git commit -m "feat: classify affiliate professionals by role"
```

---

### Task 6: Affiliate Professional Referral and Commission UI

**Files:**
- Modify: `src/App.jsx`
- Modify: `src/index.css`
- Modify: `scripts/affiliate-billing.test.mjs`
- Modify: `scripts/billing-commissions-browser.mjs`

**Interfaces:**
- Consumes: Task 1 URL helper, Task 2 report/referral RPCs, and Task 3 API wrappers.
- Extends: `ProfessionalCommissionsPage` with professional referrals while retaining current student/patient commission information.
- Produces: referral creation, one-time link display, copy/native share, cancellation, separate source totals, consolidated total, and combined PDF export.

- [ ] **Step 1: Add failing component contract tests for referral creation states**

Cover required e-mail/type, loading, generated link shown once, copy, native share fallback, safe conflict, cancellation, empty state, and retryable load error.

- [ ] **Step 2: Add failing report presentation tests**

Assert 25% student/patient and 50% professional sections remain visibly distinct, trainer accounts use `Aluno` and nutritionist accounts use `Paciente`, and the consolidated total equals both sources without double counting.

- [ ] **Step 3: Add failing PDF content tests**

Assert exported rows include origin, referred identity, professional type where applicable, payment date, gross amount, rate, commission, and status.

- [ ] **Step 4: Run focused tests and verify failure**

Run: `node --test scripts/affiliate-billing.test.mjs scripts/professional-affiliate-referrals.test.mjs`

Expected: FAIL on missing professional referral UI/report content.

- [ ] **Step 5: Add the compact `Cadastrar Treinador/Nutricionista` workflow**

Place it within the existing Commissions page hierarchy, require e-mail and type, show the official link only after successful creation, and expose copy/share/cancel actions without revealing internal IDs.

- [ ] **Step 6: Add separate and consolidated commission sections**

Show counts for invited, converted, and confirmed payments; list e-mail, type, status, plan, last payment, paid amount, and commission; preserve current student/patient rows unchanged.

- [ ] **Step 7: Extend the current PDF export**

Reuse the existing export mechanism and include both ledgers with explicit origin/rate columns rather than merging unlike records.

- [ ] **Step 8: Add only the CSS required for responsive light/dark behavior**

Verify no horizontal overflow at 390px, clear focus states, 44px touch targets, and efficient desktop use at 1440px.

- [ ] **Step 9: Extend browser QA for 390px and 1440px**

Cover form visibility, generated-link actions, distinct commission sections, table/card responsiveness, theme contrast, and PDF action reachability.

- [ ] **Step 10: Run focused tests and browser QA**

Run: `node --test scripts/affiliate-billing.test.mjs scripts/professional-affiliate-referrals.test.mjs`

Expected: PASS.

Run: `node scripts/billing-commissions-browser.mjs`

Expected: PASS with screenshots for both viewports and no console/page errors.

- [ ] **Step 11: Commit affiliate UI**

```bash
git add src/App.jsx src/index.css scripts/affiliate-billing.test.mjs scripts/billing-commissions-browser.mjs
git commit -m "feat: add professional referrals to commissions"
```

---

### Task 7: Admin Master Professional Referral Finance Detail

**Files:**
- Modify: `src/App.jsx`
- Modify: `scripts/affiliate-billing.test.mjs`
- Modify: `scripts/billing-commissions-browser.mjs`

**Interfaces:**
- Consumes: Task 2 extended `get_affiliate_finance_report` response.
- Extends: `AffiliateFinancePage` with source-separated and consolidated metrics, expandable professional referral history, and CSV/PDF exports.

- [ ] **Step 1: Add failing tests for per-source Admin totals and expanded rows**

Assert each affiliate exposes student/patient count and 25% commission separately from professional count and 50% commission, plus a correct consolidated total.

- [ ] **Step 2: Add failing tests for professional payment history and exports**

Assert the expanded view and CSV/PDF include referred e-mail, type, plan, provider order/subscription, gross amount, rate, commission, date, origin, and reversal status.

- [ ] **Step 3: Run the focused affiliate test and verify failure**

Run: `node --test scripts/affiliate-billing.test.mjs`

Expected: FAIL on missing professional finance fields.

- [ ] **Step 4: Extend `AffiliateFinancePage` without adding a second page header**

Use source filters only when both sources exist, keep existing student/patient history intact, and make professional referral rows expandable under the owning affiliate.

- [ ] **Step 5: Extend CSV and PDF output with explicit origin and rate**

Keep current columns compatible and append the new professional fields so old data remains exportable.

- [ ] **Step 6: Run focused tests and browser QA**

Run: `node --test scripts/affiliate-billing.test.mjs`

Expected: PASS.

Run: `node scripts/billing-commissions-browser.mjs`

Expected: PASS at 390px and 1440px in light/dark coverage.

- [ ] **Step 7: Commit Admin finance reporting**

```bash
git add src/App.jsx scripts/affiliate-billing.test.mjs scripts/billing-commissions-browser.mjs
git commit -m "feat: report professional referral finance"
```

---

### Task 8: Full Verification and Controlled Rollout

**Files:**
- Modify only files required to fix a verified regression from the commands below.

**Interfaces:**
- Consumes: all prior tasks.
- Produces: verified migration, Edge Function, frontend build, and a safe deployment sequence.

- [ ] **Step 1: Run the database suite once**

Run: `pnpm run test:database`

Expected: PASS with referral authorization, isolation, report, and idempotency scenarios.

- [ ] **Step 2: Run all configured tests once**

Run: `pnpm test`

Expected: PASS with no student/patient commission regression.

- [ ] **Step 3: Run static validation once**

Run: `pnpm run lint`

Expected: PASS.

Run: `pnpm run typecheck`

Expected: PASS.

- [ ] **Step 4: Produce the production build**

Run: `pnpm run build`

Expected: exit code 0 and production assets generated.

- [ ] **Step 5: Run the targeted browser validation and inspect screenshots**

Run: `node scripts/billing-commissions-browser.mjs`

Expected: PASS at 390px and 1440px, no horizontal overflow, no duplicate header, readable light/dark themes, and usable referral controls.

- [ ] **Step 6: Perform a focused security review**

Confirm direct table writes are unavailable to browser roles, invite tokens are absent from database plaintext/logs after hashing, RPCs bind ownership to `auth.uid()`, report rows are isolated, and no secret/service-role value appears in frontend bundles or test output.

- [ ] **Step 7: Deploy in dependency order**

1. Apply the additive migration to Supabase homologation.
2. Smoke-test the four RPCs with controlled affiliate/professional accounts.
3. Deploy `cartpanda-webhook` while preserving existing secrets.
4. Send controlled paid, duplicate, renewal, refund, and chargeback fixtures in homologation.
5. Deploy the frontend only after database and webhook validation pass.
6. Smoke-test trainer and nutritionist referrals using the official application URL.

- [ ] **Step 8: Run final controlled end-to-end checks**

Verify one trainer referral and one nutritionist referral from invite through signup, existing plan selection, Cartpanda confirmation, 50% commission, renewal, duplicate delivery, and reversal. Confirm current student/patient 25% commission still posts independently.

- [ ] **Step 9: Commit only verified repair changes, if any**

```bash
git add <verified-files-only>
git commit -m "fix: resolve professional referral verification regressions"
```

Skip this commit when verification requires no code changes.

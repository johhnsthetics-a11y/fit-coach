# Web App readiness - 2026-09-19

Base: main 02c4766665aa40b6c8be50b074ca5cb705ae3336 (PR #14).
Working branch: audit/webapp-readiness-20260919.
Status: AINDA NAO PRONTO para liberacao irrestrita em producao.

## Changes

- Shared XP history/total/level/ranking calculation from persisted workout logs and completed questionnaire assignments. Historical months remain counted; completion tokens and assignment IDs prevent repeated credit in the display.
- Removed the misleading hydration XP claim: hydration remains a local tracker, not a persisted reward event. No parallel XP table or schema was introduced.
- Nutritionist patient ranking restored with appropriate labels; patient home links to an available diet when no workout is assigned.
- Workout preview has a scrollable desktop region and natural mobile height. Sidebar-only height rules no longer clip embedded preview asides; light-mode inputs remain legible.
- Message delivery reconciles optimistic and polling records by ID. Stale session responses remove their pending record without repopulating the next account; failed sends preserve the draft for retry without replacing another conversation's draft.
- Student chat uses the available viewport height, preserving navigation and composer visibility at reduced height. The chat decorator now targets the actual header instead of the entire conversation wrapper.
- XP gain status animation respects reduced motion and does not replay on refresh.

## Local verification

- 94 tests passed: Node test suite from package.json, including period-boundary and duplicate-session challenge counters.
- lint: scripts/theme-smoke.mjs passed.
- typecheck: scripts/typecheck.mjs passed. This existing script is a lightweight contract checker, not a full TypeScript semantic check.
- Vite production build passed. Existing warnings: large main bundle and mixed static/dynamic supabaseApi imports.
- Product browser: 152 checks, no reported page errors or horizontal overflow, 320/360/390/430/768/1440 px.
- Workouts browser: 72 route checks plus create/publish/reload, library, multiple exercises, full preview execution and empty/legacy records.
- Nutrition browser: multiple plans, search, visibility, editing, patient preview and refresh across six widths.
- Profile browser: master, trainer and nutritionist at 390/1440 px.
- Chat browser: trainer text/image/audio send and refresh; student connection failure/draft/retry; customization; 390/1440 px.
- Local PGlite tests passed for nutrition ownership, questionnaire answers/replay, workout progress/completion retry and message ownership/edit/soft-delete.

Browser scenarios use isolated test fixtures, not production accounts. PGlite checks execute migration contracts in a temporary database; they do not establish the deployed Supabase schema or policy state.

## Release gates still open

1. Authenticate real authorized test accounts for all roles in a Supabase staging project. Verify assignment, session resume/completion, XP after a new login, questionnaire delivery, cross-account isolation, uploads, expired sessions and reconnect.
2. Confirm deployed migrations, Storage policies/buckets and environment configuration. No migration or production data was changed in this audit.
3. Account deletion Edge Function is intentionally a 501 stub in supabase/functions/delete-coach-account/index.ts. Implement and validate a safe deletion/retention workflow before advertising self-service deletion.
4. Message synchronization uses existing polling, not a WebSocket Realtime subscription. Offline background delivery and persistent hydration/diet-adherence XP are not confirmed features.
5. XP is derived from loaded persisted completion records, not a separate authoritative server reward ledger. Validate full-history loading with production-scale data before relying on long-term rankings.

## Run / deploy

Use Node 22 and pnpm 10.11.1, matching CI/packageManager:

```sh
pnpm install --frozen-lockfile
pnpm run typecheck
pnpm run lint
pnpm test
pnpm run test:database
pnpm run build
pnpm run dev -- --host 127.0.0.1
```

Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY for the intended environment before building. Never expose a service-role key. Existing deployment uses Wrangler static assets from dist with SPA routing; pnpm run deploy builds and publishes using the account's configured credentials. Do not deploy the no-environment QA build.

Browser scripts additionally require Playwright and Chromium supplied by the QA environment (PLAYWRIGHT_MODULE_PATH / CHROMIUM_EXECUTABLE_PATH can point to installed runtimes). No browser dependency was added to production.

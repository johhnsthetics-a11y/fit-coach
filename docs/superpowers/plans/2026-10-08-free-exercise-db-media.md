# Free Exercise DB Media Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enrich compatible Coach Fit Pro exercises with start and finish images from Free Exercise DB served by the existing Cloudflare R2 custom domain.

**Architecture:** An offline Node importer matches the existing Portuguese catalog to Free Exercise DB, uploads approved source images to stable R2 keys, and generates a small runtime manifest. A focused frontend resolver enriches exercises locally, preserving coach videos and falling back to the existing muscle illustrations when no safe match exists.

**Tech Stack:** React 18, Vite 5, Node.js built-ins, Node test runner, Wrangler 4, Cloudflare R2.

**Spec:** `docs/superpowers/specs/2026-10-08-free-exercise-db-media-design.md`

## Global Constraints

- Runtime media URLs must use `https://media.coachfitpro.com.br` and must not use Supabase Storage, GitHub hotlinks, or a third-party runtime API.
- Do not add frontend or importer dependencies.
- Preserve source image formats; do not generate GIFs or videos.
- Coach-provided media has priority over catalog media.
- Only exact or equipment-compatible matches enter the production manifest.
- Ambiguous, missing, or conflicting matches retain the existing Coach Fit Pro fallback illustration.
- No Cloudflare or Supabase secret may enter committed files or the browser bundle.
- Preserve existing workout creation, student execution, and student preview contracts.

## Review Focus

- Accented and unaccented Portuguese names resolve to the same safe manifest key.
- A generic English alias cannot override a conflicting equipment-specific match.
- Missing or malformed image arrays return no catalog media and preserve the current fallback.
- A coach video remains visible when catalog images are also available.
- Failed remote images do not leave blank or layout-shifting exercise cards.

---

### Task 1: Shared exercise catalog extraction

**Files:**
- Create: `src/exerciseCatalog.js`
- Modify: `src/App.jsx` around `exerciseLibrary`, `exerciseCatalogBlueprints`, and `buildExpandedExerciseCatalog`
- Modify: `scripts/workouts-regression.test.mjs`

**Interfaces:**
- Produces: `exerciseLibrary: Array<object>`
- Produces: `buildExpandedExerciseCatalog(): Array<object>`

- [ ] **Step 1: Add failing catalog-preservation assertions**

Import the shared catalog directly and assert the existing minimum count, known names, aliases, and deterministic generation without changing the current application assertions.

- [ ] **Step 2: Run the workout regression test and verify RED**

Run: `node --test scripts/workouts-regression.test.mjs`

Expected: FAIL because `src/exerciseCatalog.js` does not exist.

- [ ] **Step 3: Move the existing catalog definitions into the shared module**

Move, without rewriting, the static records, blueprint records, and expansion function. Import `exerciseLibrary` back into `src/App.jsx`; preserve record order, names, aliases, metadata, and the current total.

- [ ] **Step 4: Run the workout regression test and verify GREEN**

Run: `node --test scripts/workouts-regression.test.mjs`

Expected: all existing workout tests and the new catalog assertions pass.

- [ ] **Step 5: Commit the extraction**

Commit files for this task with message `refactor: share exercise catalog`.

### Task 2: Runtime media resolver

**Files:**
- Create: `src/exerciseMedia.js`
- Create: `src/data/exerciseMediaManifest.js`
- Create: `scripts/exercise-media-resolver.test.mjs`
- Modify: `package.json`

**Interfaces:**
- Produces: `normalizeExerciseMediaKey(value: string): string`
- Produces: `resolveExerciseMedia(exercise: object, manifest?: object): { source: string, sourceId: string, matchType: string, images: Array<{ role: string, url: string }> } | null`
- Produces: `getExerciseMediaStartImage(exercise: object, manifest?: object): string`

- [ ] **Step 1: Write failing resolver tests**

Cover accents, punctuation, direct names, aliases, malformed records, equipment conflicts, unknown exercises, and custom-video priority inputs. Assert that only HTTPS URLs on `media.coachfitpro.com.br` are accepted from the generated manifest.

- [ ] **Step 2: Run the resolver test and verify RED**

Run: `node --test scripts/exercise-media-resolver.test.mjs`

Expected: FAIL because `src/exerciseMedia.js` does not exist.

- [ ] **Step 3: Implement the resolver and an empty generated manifest**

Keep normalization deterministic and side-effect free. Return `null` for unsafe, incomplete, ambiguous, or conflicting records; do not substitute the existing illustration inside this module.

- [ ] **Step 4: Run the resolver test and verify GREEN**

Run: `node --test scripts/exercise-media-resolver.test.mjs`

Expected: all resolver tests pass.

- [ ] **Step 5: Add the resolver test to `pnpm test` and commit**

Commit files for this task with message `feat: add exercise media resolver`.

### Task 3: Deterministic dataset matcher and coverage report

**Files:**
- Create: `scripts/exercise-media/freeExerciseDbImporter.mjs`
- Create: `scripts/exercise-media/import-free-exercise-db.mjs`
- Create: `scripts/exercise-media/coachfitMediaAliases.mjs`
- Create: `scripts/fixtures/free-exercise-db/exercises.json`
- Create: `scripts/fixtures/free-exercise-db/exercises/sample-start.jpg`
- Create: `scripts/fixtures/free-exercise-db/exercises/sample-finish.jpg`
- Create: `scripts/free-exercise-db-importer.test.mjs`
- Modify: `package.json`

**Interfaces:**
- Consumes: `exerciseLibrary` from Task 1 and `normalizeExerciseMediaKey(value)` from Task 2.
- Produces: `buildExerciseMediaPlan({ coachExercises, datasetExercises, mediaBaseUrl }): { manifest, matched, unmatched, ambiguous }`
- Produces CLI commands: `pnpm exercise-media:dry-run -- --dataset <path>` and `pnpm exercise-media:upload -- --dataset <path> --bucket coachfitpro-exercise-media`

- [ ] **Step 1: Write failing importer tests**

Use the fixture to assert stable `free-exercise-db/v1/<id>/start.jpg` and `finish.jpg` keys, exact-match preference, safe compatible matches, equipment-conflict rejection, deterministic report ordering, and idempotent plans.

- [ ] **Step 2: Run importer tests and verify RED**

Run: `node --test scripts/free-exercise-db-importer.test.mjs`

Expected: FAIL because the importer module does not exist.

- [ ] **Step 3: Implement matching, report generation, and CLI validation**

Read the current catalog from `src/exerciseCatalog.js` rather than parsing JSX or duplicating names. Validate dataset paths and both source images before creating an upload entry. The upload mode must invoke the existing Wrangler CLI without embedding credentials and must write the manifest only after every selected object uploads successfully.

- [ ] **Step 4: Run importer tests and verify GREEN**

Run: `node --test scripts/free-exercise-db-importer.test.mjs`

Expected: all importer tests pass and the fixture report totals are stable.

- [ ] **Step 5: Add package scripts and commit**

Commit files for this task with message `feat: add exercise media importer`.

### Task 4: Coach and student exercise UI integration

**Files:**
- Modify: `src/App.jsx` around `enrichExercise`, `ExerciseThumbnail`, and `ExerciseMedia`
- Modify: `scripts/workouts-regression.test.mjs`

**Interfaces:**
- Consumes: `resolveExerciseMedia` and `getExerciseMediaStartImage` from Task 2.
- Produces: enriched exercises with `catalogMedia` while preserving existing `videoUrl`, `videoPreviewUrl`, and fallback behavior.

- [ ] **Step 1: Add failing workout regression tests**

Assert lazy-loaded start thumbnails, labeled `Posição inicial` and `Posição final` frames, coach-video priority, no catalog panel for unmatched exercises, and fallback rendering after an image error. Exercise screens must still server-render for empty and populated accounts.

- [ ] **Step 2: Run the focused regression tests and verify RED**

Run: `node --test scripts/workouts-regression.test.mjs`

Expected: new media assertions fail while existing tests continue to run.

- [ ] **Step 3: Enrich exercises and render responsive image pairs**

Add the catalog media only during exercise enrichment. In compact lists render only the start frame with fixed dimensions, `loading="lazy"`, and `decoding="async"`. In details render two responsive labeled figures. Use local error state to replace failed images with `getExerciseFallbackImage(exercise)` and preserve all existing video branches before the image branch.

- [ ] **Step 4: Run focused and full tests**

Run: `node --test scripts/exercise-media-resolver.test.mjs scripts/free-exercise-db-importer.test.mjs scripts/workouts-regression.test.mjs`

Then run: `pnpm test`

Expected: all tests pass.

- [ ] **Step 5: Commit UI integration**

Commit files for this task with message `feat: show exercise demonstration images`.

### Task 5: Import approved production media into R2

**Files:**
- Modify: `src/data/exerciseMediaManifest.js`
- Create: `docs/third-party/free-exercise-db-UNLICENSE`
- Create: `docs/third-party/free-exercise-db-attribution.md`
- Create: `artifacts/exercise-media-coverage.json`

**Interfaces:**
- Consumes: importer CLI from Task 3 and the upstream Free Exercise DB checkout.
- Produces: production R2 objects, committed runtime manifest, and coverage report.

- [ ] **Step 1: Verify Cloudflare account and R2 bucket access**

Run: `pnpm dlx wrangler@4 whoami`

Run a read-only bucket listing command for `coachfitpro-exercise-media`. If authentication is missing, use Wrangler's browser login; never request a token in chat.

- [ ] **Step 2: Download the upstream dataset into a temporary ignored directory**

Clone the official `yuhonas/free-exercise-db` repository at a recorded commit. Verify its `UNLICENSE` and expected JSON/image structure before running the importer.

- [ ] **Step 3: Generate and inspect the dry-run coverage report**

Run: `pnpm exercise-media:dry-run -- --dataset <temporary-path> --report artifacts/exercise-media-coverage.json`

Expected: zero equipment conflicts in the matched set, zero ambiguous entries in the manifest, and every manifest record has start and finish source files.

- [ ] **Step 4: Curate only safe aliases and rerun tests**

Add aliases only where the report and dataset metadata establish movement and equipment compatibility. Run importer and resolver tests after each curated batch.

- [ ] **Step 5: Upload approved files and generate the production manifest**

Run: `pnpm exercise-media:upload -- --dataset <temporary-path> --bucket coachfitpro-exercise-media --report artifacts/exercise-media-coverage.json`

Expected: all planned objects upload, rerunning performs no destructive operation, and every generated URL begins with `https://media.coachfitpro.com.br/free-exercise-db/v1/`.

- [ ] **Step 6: Verify representative public objects and licensing files**

Request one upper-body, one lower-body, and one core object through the custom domain. Confirm successful image responses and cache headers. Record the upstream commit in attribution.

- [ ] **Step 7: Commit generated artifacts**

Commit only the manifest, report, aliases, and licensing documentation with message `data: import exercise demonstration media`. Do not commit the upstream dataset checkout or downloaded images.

### Task 6: Production verification and release

**Files:**
- Modify only if verification exposes a scoped defect in files already listed above.

**Interfaces:**
- Consumes: production manifest and R2 objects from Task 5.
- Produces: verified production build and deployed application.

- [ ] **Step 1: Run complete verification**

Run: `pnpm test`

Run: `pnpm run build`

Expected: both commands exit successfully with no missing-media import or browser-bundle secret.

- [ ] **Step 2: Verify locally at mobile and desktop widths**

Check the trainer exercise picker, trainer exercise detail, faithful student preview, and student workout execution. Confirm fixed card dimensions, no overlap, lazy image loading, two-frame detail layout, video priority, and fallback behavior.

- [ ] **Step 3: Review the final diff for scope and secrets**

Confirm no dataset checkout, R2 credentials, Supabase keys, unrelated `dist` churn, or unrelated source changes enter the release commit.

- [ ] **Step 4: Deploy with the existing Cloudflare command**

Run: `pnpm run deploy`

Expected: Wrangler reports a successful deployment for the existing `fit-coach` project.

- [ ] **Step 5: Verify production**

Open the production application, confirm one exact match and one fallback in coach and student contexts, and verify that image requests use `media.coachfitpro.com.br` rather than Supabase or GitHub.

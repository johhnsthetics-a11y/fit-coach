# Free Exercise DB Media Design

## Objective

Add real exercise demonstrations to Coach Fit Pro using the public-domain Free Exercise DB image dataset while keeping the existing Portuguese exercise catalog, workout flows, and custom coach media intact.

The integration must avoid Supabase Storage and database egress for exercise media. Public media is served from the existing Cloudflare R2 bucket through `https://media.coachfitpro.com.br`.

## Success Criteria

- Compatible catalog exercises show real start and finish images.
- Exercise lists load only the first image and use native lazy loading.
- Exercise details show both positions with clear Portuguese labels.
- Custom coach videos keep priority over catalog images.
- Unmatched or uncertain exercises keep the current muscle illustration rather than receiving misleading media.
- The importer reports matched, fallback, and ambiguous records before upload.
- Runtime exercise media does not require Supabase queries or secrets.
- Existing workout creation, student workout execution, and student preview behavior remain unchanged.

## Architecture

### Offline Import Pipeline

A maintenance script reads a local checkout of `yuhonas/free-exercise-db`, normalizes its exercise metadata, matches it against the Coach Fit Pro catalog, and generates a deterministic media manifest.

The script supports two modes:

1. `--dry-run` generates a coverage report without uploading anything.
2. `--upload` uploads only approved matched files to the R2 bucket and writes the final manifest.

The importer does not run in the browser or during normal application builds. Dataset downloads and Cloudflare authentication are maintenance operations only.

### Matching Rules

Matching is deterministic and conservative:

1. Normalize accents, punctuation, whitespace, case, equipment names, and known Portuguese/English synonyms.
2. Prefer an exact normalized name or exact alias match.
3. Allow a compatible family match only when movement family and equipment do not conflict.
4. Mark multiple equally plausible matches as ambiguous.
5. Never assign media when equipment or movement mechanics conflict.

The generated report lists the application exercise, selected dataset record, match type, and confidence. Ambiguous and unmatched records do not enter the production manifest.

### R2 Object Layout

Objects use stable, versioned keys:

```text
free-exercise-db/v1/<dataset-exercise-id>/start.<source-extension>
free-exercise-db/v1/<dataset-exercise-id>/finish.<source-extension>
```

The original source images and extensions are preserved to avoid adding a conversion dependency. Uploaded objects receive their correct content type and long-lived immutable cache metadata. Object URLs use only the custom media domain.

### Runtime Manifest

The generated application manifest maps normalized Coach Fit Pro names and aliases to:

```js
{
  source: 'free-exercise-db',
  sourceId: 'dataset-id',
  matchType: 'exact' | 'compatible',
  images: [
    { role: 'start', url: 'https://media.coachfitpro.com.br/...' },
    { role: 'finish', url: 'https://media.coachfitpro.com.br/...' },
  ],
}
```

The browser resolves this manifest locally. It does not fetch a media catalog from Supabase.

## Application Integration

A focused media resolver enriches existing exercise records without changing their persistence format.

Media priority is:

1. Coach-provided workout video.
2. Existing direct exercise video.
3. Exact Free Exercise DB image pair.
4. Compatible Free Exercise DB image pair.
5. Existing Coach Fit Pro muscle illustration.

Exercise list thumbnails show the start image with `loading="lazy"`, fixed dimensions, and `object-fit` styling so cards do not shift while loading. Exercise detail and student preview show start and finish frames labeled `Posicao inicial` and `Posicao final`. A failed image request falls back to the existing illustration without breaking the workout screen.

No automatic slideshow, autoplay, GIF conversion, or video generation is included. This keeps bandwidth and visual distraction low.

## Data and Security

- No Cloudflare token, R2 key, or Supabase service-role key is bundled into the frontend.
- Upload authentication stays in the developer CLI environment.
- R2 serves only public exercise image objects through the configured custom domain.
- Supabase schema and RLS policies are unchanged.
- The upstream `UNLICENSE` file and source attribution are copied into project documentation.

## Failure Handling

- Missing dataset checkout: importer exits before changing the manifest.
- Missing or invalid R2 credentials: dry-run remains available; upload exits with a clear error.
- Missing start/finish source image: record remains unmatched and is not uploaded.
- Upload interruption: stable keys make reruns idempotent.
- Browser image failure: UI falls back to the current muscle illustration.
- Ambiguous name mapping: report requires explicit alias curation before production use.

## Testing

- Unit tests cover normalization, accent handling, aliases, exact matches, compatible matches, equipment conflicts, ambiguity, and fallback.
- Importer tests use a small local fixture and verify stable object keys and report totals.
- UI contract tests verify lazy thumbnails, two labeled detail frames, coach-video priority, and fallback behavior.
- Existing workout regression tests and the production build run after integration.
- A final dry-run records catalog coverage before any R2 upload.

## Scope Boundaries

This work does not translate or import the entire Free Exercise DB catalog as new Coach Fit Pro exercises. It enriches the current catalog with safe compatible media. It does not replace coach-uploaded videos, change Supabase tables, add a runtime third-party API, or redesign unrelated workout interfaces.


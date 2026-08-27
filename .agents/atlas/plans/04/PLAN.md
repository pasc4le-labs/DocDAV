# PLAN — Plan 04: Content-driven Ask-menu config (`copy:`)

Replace the `AI_OVERRIDES` env mechanism for the page **Copy / Ask** menu with
a `copy:` map in the content.

## Goal
- Remove `AI_OVERRIDES` env (`src/lib/config.ts` + its test).
- `site.yaml`: optional `copy:` map = site-wide default. Per provider slug
  (`copy.claude`, `copy.chatgpt`, `copy.gemini`, `copy.perplexity`, …):
  - absent / `true` → enabled as "New chat with this page" (deep-link button)
  - `false` → disabled (hidden)
  - string href → enabled as a plain link anchor
  - All ON by default (backward compatible: no `copy:` → all providers behave
    as today).
- `docs.yaml`: optional `copy:` map that **overrides** `site.yaml` per key
  (docs precedence) for that product.

## Implementation
- `src/lib/server/dav.ts`: `CopyConfig` type, `coerceCopy()` (booleans + non-
  empty strings; drops anything else), parse `copy` from `site.yaml`
  (`Index.siteCopy`) and `docs.yaml` (`Manifest.copy`); effective per-product
  `ProductMeta.copy = { ...siteCopy, ...(docsCopy ?? {}) }`.
- `src/routes/[product]/+layout.server.ts`: expose `copy` via
  `meta.get(product)?.copy`.
- `src/lib/PageMenu.svelte`: read `page.data.copy`; skip `false`, anchor on
  string, button otherwise.
- Remove `AI_OVERRIDES` from `config.ts`, `config.test.ts` (deleted),
  `+layout.server.ts`, `playwright.config.ts` (second app instance dropped).
- Sample + unit + e2e coverage; docs updated (USAGE.md, README.md).

## Verification
- [x] `pnpm check` 0 errors
- [x] `pnpm test` 65 passed
- [x] `pnpm build` ok
- [x] `pnpm exec playwright test` 27 passed
- [x] `biome check` exit 0
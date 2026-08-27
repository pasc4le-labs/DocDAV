# PROGRESS — Plan 04: Content-driven Ask-menu config (`copy:`)

Updated: 2026-08-27

## Status
- [x] Plan
- [x] Implement
- [x] Verify
- [x] Docs
- [x] Merge (pending commit+push)

## Log
- **2026-08-27** — Implemented. `AI_OVERRIDES` env removed. Added `copy:`
  config to `site.yaml` (site-wide default) and `docs.yaml` (per-product
  override, docs wins per key). Effective per-product config flows via
  `[product]/+layout.server.ts` → `PageMenu.svelte`. A provider slug can be
  `false` (hidden), a string href (plain-link anchor), or absent/`true`
  (deep-link button); all providers remain enabled by default.
  Verification: `pnpm check` 0, vitest 65 passed, `pnpm build` ok,
  Playwright 27 passed (incl. two new copy-config e2e tests), biome exit 0.
# PROGRESS — Plan 03: Multi-language support (i18n)

Updated: 2026-08-25

## Status
- [x] Plan
- [ ] Implement
- [ ] Verify
- [ ] Docs
- [ ] Merge

## Log
- **2026-08-25** — Plan 03 created for review. Scoped as two independent
  phases: **A) UI chrome localization** (server-side `src/lib/i18n.ts`
  dictionary, ~30 strings) and **B) content i18n** (`site.yaml` language
  declaration, localized `docs.yaml` values + per-language `source` maps,
  `/<lang>/` URL prefix for non-default langs, per-language index cache,
  language-agnostic gating, topbar language switcher). Written under the
  project conventions: declared-not-discovered, lazy per-language discovery,
  SSR chroma, backwards compatible (no `languages` → single `en`, today's
  behaviour), gating shared across a product's language variants. No code
  written yet — awaiting scope confirmation before implementation.
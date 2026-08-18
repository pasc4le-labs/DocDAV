# PROGRESS — Plan 01: Multi-format content + per-product manifest

Updated: 2026-08-18

## Status
- [x] Implement
- [x] Verify
- [x] Docs
- [x] Merge

## Log
- **2026-08-18** — Plan 01 created. Scope agreed with user: per-product
  `docs.yaml` (single source of truth; category/order derived from page
  list), multi-format bodies (`md/txt/html/adoc/csv/docx/xlsx`), **no
  backwards compatibility** (drop gray-matter frontmatter + auto-include).
  No implementation started yet.
- **2026-08-18** — Implemented. Added deps `yaml/mammoth/xlsx/asciidoctor/
  sanitize-html` (and devDeps `svelte-check` + `type-fest` to make `pnpm
  check` green). Added `src/lib/server/format.ts` (render dispatch +
  `detectKind`); rewrote `dav.ts` to manifest-driven discovery (per-product
  `docs.yaml`, binary `arrayBuffer` reads, dangling-source skip with warn);
  `nav.ts` reads product metadata (description/cover) from manifests; root
  route passes product meta through. Removed `gray-matter` everywhere.
- **2026-08-18** — Migrated sample: stripped gray-matter frontmatter from all
  `content-sample` md files, added `atlas/docs.yaml` + `scorekeeper/docs.yaml`,
  added binary `atlas/pricing.xlsx` generated via SheetJS.
- **2026-08-18** — Verified end-to-end against a live local WebDAV server
  (rclone over `content-sample/`): products list with manifest descriptions;
  sidebar categories in first-appearance order (Overview→Guides→CLI
  Reference→Reference); page order = list position; xlsx rendered as a table;
  txt/html/adoc/csv all render correctly (html scripts sanitized); dangling
  source skipped (404, not in sidebar, product not broken). `pnpm check`
  (0 errors) and `pnpm build` both pass. No gray-matter references remain.
- **2026-08-18** — Docs updated: `README.md` (multi-format + manifest), `docs/
  USAGE.md` (authoring + format matrix), `docs/README.md` (content model,
  architecture, deps, notes). Added topic `00-architecture`.

## Next
- Committed; awaiting merge/PR. Future plans can build manifest-driven editing
  or a site-wide manifest (explicitly out of scope here).

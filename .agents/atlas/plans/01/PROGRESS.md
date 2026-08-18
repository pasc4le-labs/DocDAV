# PROGRESS — Plan 01: Multi-format content + per-product manifest

Updated: 2026-08-18

## Status
- [ ] Implement
- [ ] Verify
- [ ] Docs
- [ ] Merge

## Log
- **2026-08-18** — Plan 01 created. Scope agreed with user: per-product
  `docs.yaml` (single source of truth; category/order derived from page
  list), multi-format bodies (`md/txt/html/adoc/csv/docx/xlsx`), **no
  backwards compatibility** (drop gray-matter frontmatter + auto-include).
  No implementation started yet.

## Next
- Add deps (`yaml`, `mammoth`, `xlsx`, `asciidoctor`, `sanitize-html`).
- Rewrite `dav.ts` discovery + manifest loader; add `format.ts` dispatch;
  remove gray-matter. Migrate `content-sample/atlas`; verify build+render.

# Topic 00 — Architecture & content model

> Durable project summary. Read before starting a new plan.

## What this is

DocDAV (`~/prj/docdav`) is a SvelteKit app that turns a WebDAV share into a
live, multi-product documentation site. Content is read over standard WebDAV
on every request and cached in-memory for a short TTL (`WEBDAV_TTL_MS`,
default 30000). No build pipeline, no write-back; the drive is the source of
truth.

## Content model (manifest-driven)

```
<docsRoot>/
  site.yaml             # REQUIRED: site password + product index (display order)
  <product>/            # exactly those listed in site.yaml.products
    docs.yaml           # REQUIRED manifest (no manifest → product skipped with warn)
    …pages in any supported format
```

- **`site.yaml`** is the authoritative, ordered product index: top-level
  `password` (site/homepage gate) plus a `products` list, in display order.
  Product presentation order = `site.yaml.products` order (not sorted dir
  names). It is **required**; if missing/invalid the site serves no products
  (clear error, no fallback).
- **Discovery is pure direct GETs** — `GET <base>/site.yaml`, then
  `GET <base>/<product>/docs.yaml` per listed product, then lazy page GETs.
  There is **no PROPFIND, no directory enumeration, nothing auto-discovered**.
  Only the exact filenames `site.yaml` / `docs.yaml` are recognised (strict
  `.yaml` — no `.yml`, no case-insensitive matching). A product listed without
  a `docs.yaml` is skipped with a `console.warn`; a product not listed in
  `site.yaml` is never served.
- **`docs.yaml`** is the single source of truth: top-level `title`,
  `description`, `cover` (product metadata → homepage card), plus a `pages`
  list. Each page: `title` (default = filename), `source` (relative to product
  dir), `category` (default `General`), `description`, `updated` (default =
  file last-modified).
- **Categories** come from `pages[].category` in first-appearance order.
  **Order** = the page's index in the `pages` list. **id/path** = `source`
  minus extension.
- **Only listed pages are served** — no frontmatter, no auto-include.
  Dangling `source` (file missing) is skipped with a `console.warn`, never
  breaking the product.

## Formats

| Format | ext | notes |
|---|---|---|
| Markdown | `md/markdown` | `renderMd` (callouts/banners/toggles/procedures/mermaid/excalidraw) |
| text | `txt` | escape + wrap paragraphs |
| html | `html/htm` | `sanitize-html` (scripts stripped) |
| AsciiDoc | `adoc/asciidoc` | async `convert({header_footer:false})` |
| CSV | `csv` | parse → markdown table → `renderMd` |
| Word | `docx` | `mammoth.convertToHtml` (async) |
| Excel | `xlsx` | SheetJS first sheet → table |
| — | `doc` | **excluded** |

Dispatch lives in `src/lib/server/format.ts` (`detectKind`, `renderBody`,
`renderBodyAsync` — async for mammoth/asciidoctor).

## Key source files

- `src/lib/server/dav.ts` — discovery (`site.yaml` index → per-product
  `docs.yaml` via direct GETs), manifest parsing (`yaml`), page loading (text
  or `arrayBuffer`), TTL cache. Exports `getDocs()`, `getProductsMeta()`,
  `getDoc(id)`.
- `src/lib/server/format.ts` — multi-format render dispatch.
- `src/lib/server/md.ts` — marked + doc components (callouts, banners, toggles,
  procedures, mermaid/excalidraw).
- `src/lib/server/nav.ts` — `listProducts(docs, meta)` (metadata from maps) and
  `sidebarFor()` (categories/order from DocMeta).
- `src/routes/+page.server.ts` — passes `getProductsMeta()` to `listProducts`.
- `src/hooks.server.ts` + `auth.ts`/`gate.ts` — per-product (`password:` in
  `docs.yaml`) and site (`password:` in root `site.yaml`) gating before any
  page load. `auth.ts` sources secrets from `dav` (async).

## Env (canonical)

`WEBDAV_URL`, `WEBDAV_USER`, `WEBDAV_PASS`, `WEBDAV_TTL_MS`, `DOCS_BRAND`,
`DOCS_LOGO`. Access passwords are **not** env: per-product `password:` in that
product's `docs.yaml`, site/homepage `password:` in a root `site.yaml`.

## Local harness

- `pnpm webdav:sample` — rclone `serve webdav` over `sample/` (demo/
  secret).
- `pnpm dev` on :4323; prod: `pnpm build` + `node build` with `HOST/PORT`.

## Status

Plan 01 (per-product `docs.yaml` manifest + multi-format) and Plan 02
(required root `site.yaml` product index, pure direct-GET discovery, strict
`.yaml`) are implemented and merged. **Plan 02 replaced the root-PROPFIND
enumeration**: products are no longer discovered by listing the drive — they
come from `site.yaml`, in its list order. `.doc` not supported. Out of scope:
sidecar frontmatter for binaries, client-side editing/write-back.

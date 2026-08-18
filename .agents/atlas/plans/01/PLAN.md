# Plan 01 — Multi-format content + per-product manifest (no backwards compat)

**Status:** Implemented + merged (2026-08-18)
**Scope:** DocDAV (`~/prj/docdav`)
**Related:** topics 00-architecture (see PROGRESS when written)

## Goal

Replace the Markdown-only, per-file-frontmatter pipeline with:

1. A **per-product manifest** `docs.yaml` at the root of each product
   directory — the single source of truth for metadata, ordering and page
   membership.
2. **Multi-format bodies**: `md`, `txt`, `html`, `adoc`, `csv`, `docx`,
   `xlsx` (`.doc` is explicitly **not** supported).
3. **No backwards compatibility**: drop gray-matter frontmatter parsing and
   the old "unlisted files auto-include" behaviour. Every page must be listed
   in its product's `docs.yaml`.

## Content model

```
<base>/
  <product>/
    docs.yaml            # manifest (required; defines product + pages)
    index.md
    sdk-spec.docx
    pricing.xlsx
```

- Each top-level directory is a product (unchanged).
- `docs.yaml` at the product root is **required**. A product dir without a
  manifest contributes nothing.
- `source` paths resolve **relative to the product dir**.

## Manifest schema — `docs.yaml`

```yaml
title: Atlas                    # optional → product dir name
description: Our flagship.      # optional
cover: cover.png                # optional, relative path

pages:
  - title: Introduction
    source: index.md            # path relative to product dir
    category: Getting Started   # optional → "General"
    description: ...            # optional
    updated: 2026-08-01         # optional → fallback file last-modified
  - title: SDK Specification
    source: sdk-spec.docx
    category: API Reference
  - title: Pricing
    source: pricing.xlsx
    category: API Reference
```

### Derivation rules (explicit, per agreed design)
- **Category** = `pages[].category`. The sidebar category set and order come
  from **first-appearance order** in the `pages` list. Missing `category` →
  `General`.
- **Order** = the page's **index in the `pages` list** (array position). The
  list *is* the canonical ordering; interleaved categories still sort by
  global list position.
- **id / path** = `source` resolved against the product dir; `id` = path
  minus extension.
- **title / description / cover** = manifest values (top-level or per-page).
- **updated** = per-page `updated`, else the file's `last-modified` header.

## Format support matrix

| Format | Parser | Output |
|---|---|---|
| `md`/`markdown` | existing `marked` (`md.ts`, incl. callouts/toggles/procedures/mermaid/excalidraw) | HTML (unchanged) |
| `txt` | none (escape + wrap paragraphs) | HTML |
| `html` | sanitized pass-through (`sanitize-html`) | HTML |
| `adoc`/`asciidoc` | `asciidoctor` (pure JS) | HTML |
| `csv` | build markdown table → `renderMd` | HTML table |
| `docx` | `mammoth` (docx → HTML) | HTML |
| `xlsx` | SheetJS `xlsx` → markdown table → `renderMd` | HTML table |
| `doc` | **excluded** (dead format, high cost) | — |

## Architecture changes

### `dav.ts`
- Generalize discovery: `listMarkdownFiles` → a format-aware listing that
  returns `docs.yaml` manifests + known content files per product.
- Add `loadManifest(relPath)` → parse `docs.yaml` (via `yaml`/`js-yaml`).
- Build `DocMeta[]` from manifests only. **No auto-include**: files not
  listed in their product's manifest are ignored.
- Validate: dangling `source` (file missing) → skip the page + `console.warn`
  (keep the site up, don't 404 the whole product).
- `rawFetch`: support binary reads (`res.arrayBuffer()`) for `docx`/`xlsx`
  in addition to text reads.
- Keep the existing cache + TTL.

### New `format.ts` (render dispatch)
`renderBody(kind, data) → HTML`:
- `md` → `renderMd(data)` (text)
- `txt` → escape + `<p>` (text)
- `html` → `sanitize-html(data)` (text)
- `adoc` → `asciidoctor.convert(data)` (text)
- `csv` → escape + markdown table → `renderMd` (text)
- `docx` → `mammoth.convertToHtml({ buffer })` (binary)
- `xlsx` → SheetJS `xlsx.read(buffer)` → markdown table → `renderMd` (binary)

`detectKind(path)` maps extension → kind. Unsupported extension reported by
the validator.

### Removals
- `gray-matter` dependency and the frontmatter path in `loadDoc`.
- Frontmatter-driven `category`/`order`/`description`/`cover`/`updated`.
- Unlisted-file auto-include / hybrid fallback.

## Docs updates (user-facing, after code)
- `README.md`, `docs/USAGE.md`, `docs/DOCKER.md`: document the new
  manifest-driven content model, `docs.yaml` schema, and format support.
- Migrate `content-samples/atlas` to a `docs.yaml` and add at least one binary
  (`.docx` or `.xlsx`) so the new path is exercised by the sample.

## Verification
- `pnpm install` + `pnpm build` (+ `pnpm check`) pass.
- Run against the sample drive; confirm: manifest-only sidebar/ordering,
  category/order derivation, multi-format rendering (incl. one binary file),
  dangling-source skip.
- No gray-matter references remain.

## Dependencies to add
`yaml` (manifest), `mammoth` (docx), `xlsx` (SheetJS), `asciidoctor` (adoc),
`sanitize-html` (html). All pure JS / alpine-safe. Optionally a file-type
detector (magic bytes) instead of trusting the extension — deferred unless
needed.

## Out of scope
- `.doc` (legacy binary) — explicitly excluded.
- Site-wide (multi-product) manifest — per-product only.
- Sidecar frontmatter for binary files — manifest covers it.
- Client-side editing / write-back to WebDAV.

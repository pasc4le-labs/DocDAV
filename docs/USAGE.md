# Usage

A walkthrough of authoring documentation and running the site.

## Authoring a product

Each top-level folder on the drive is a **product**. A product is defined by a
`docs.yaml` manifest at its root, the single source of truth for metadata,
sidebar categories and page ordering. A product folder without a manifest is
ignored.

```
<docsRoot>/atlas/
  docs.yaml          # manifest (required)
  index.md
  getting-started.md
  reference/cli.md
  pricing.xlsx       # any supported format
```

```yaml
# docs.yaml
title: Atlas                 # optional → product folder name
description: Our flagship.   # optional → homepage card
cover: cover.png             # optional → homepage card image
pages:
  - title: Getting started
    source: getting-started.md   # path relative to the product folder
    category: Overview           # optional → "General"
    description: Fastest path to a running Atlas
    updated: 2026-08-01          # optional → file last-modified
  - title: CLI reference
    source: reference/cli.md
    category: CLI Reference
  - title: Pricing
    source: pricing.xlsx         # binary formats supported
```

- The sidebar's **categories** come from `pages[].category`, in
  first-appearance order (missing → `General`).
- **Page order** is the page's position in the `pages` list.
- A page's URL is its `source` minus the extension
  (`reference/cli.md` → `/atlas/reference/cli`).
- **Only pages listed in the manifest are served.** Unlisted files and dangling
  `source` entries are skipped (with a console warning); they never break the
  rest of the product.

## Multi-format support

| Format        | Extension                      | Notes                              |
| ------------- | ------------------------------ | ---------------------------------- |
| Markdown      | `.md`, `.markdown`             | Full component syntax (below)      |
| Plain text    | `.txt`                         | Escaped, wrapped in paragraphs     |
| Raw HTML      | `.html`, `.htm`                | Sanitized pass-through (scripts stripped) |
| AsciiDoc      | `.adoc`, `.asciidoc`           | Rendered to HTML                   |
| CSV           | `.csv`                         | Rendered as a table                |
| Word          | `.docx`                        | Converted to HTML                  |
| Excel         | `.xlsx`                        | First sheet rendered as a table    |

`.doc` (legacy binary) is **not** supported.

Add a page to the manifest and refresh; it appears in the sidebar immediately.
The sample harness uses a 2s directory cache so it behaves like a live drive.

## Running locally against sample content

```bash
pnpm install

# Terminal 1: local WebDAV server over sample/ on :8090
pnpm webdav:sample

# Terminal 2: dev server on :4323
pnpm dev
```

Open http://127.0.0.1:4323. The sample drive contains two products: `atlas`
and `scorekeeper`. `atlas` is protected with the key `atlaspass` (set via
`password:` in its `docs.yaml`).

## Using the content components

Full syntax reference is in [README.md](README.md#markdown-components). Quick
reminders:

```markdown
> [!NOTE]        Callout (or TIP / IMPORTANT / WARNING / CAUTION)
> [!BANNER]      High-emphasis strip for announcements
1. step          Numbered step badge
:::toggle Title  Collapsible section
```

## Restricting access

Passwords live in the content, not the environment.

- **Per-product:** add a top-level `password:` to that product's `docs.yaml`:

  ```yaml
  # <docsRoot>/atlas/docs.yaml
  title: Atlas
  password: atlaspass   # → /atlas and its pages require this key
  pages: …
  ```

- **Site / homepage:** add a `site.yaml` at the drive root:

  ```yaml
  # <docsRoot>/site.yaml
  password: site-secret   # → the landing page / requires this key
  ```

A product without `password:` (and a drive without `site.yaml`) is public.
Locked products are gated **before** rendering; the password works via
`?key=…`, an `X-Doc-Key` header, or the unlock form. Passwords are re-read with
the same TTL cache as the rest of the content.

## Production

```bash
pnpm build
HOST=127.0.0.1 PORT=4323 node build/index.js
```

Point `WEBDAV_URL` at your real WebDAV share and replace the demo credentials
in `.env` (see [Configuration](README.md#configuration-env)).

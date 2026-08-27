# Technical Overview

`DocDAV` is a SvelteKit app that turns a WebDAV share into a live,
multi-product documentation site. A required root `site.yaml` is the product
index — it lists the products and a site password. Each product is declared by
a `docs.yaml` manifest; its pages are rendered
server-side on request from multiple formats (`md/txt/html/adoc/csv/docx/xlsx`)
and cached in-memory for a short TTL, so content changes appear without a
rebuild.

## Architecture

```
src/
├── app.html                      entry point
├── hooks.server.ts               request gating (auth) before any page load
├── routes/
│   ├── +layout.svelte            shell: top bar, content, sticky footer
│   ├── +page.svelte              landing: searchable project grid
│   ├── [product]/                product shell: sidebar + content column
│   │   ├── +page.svelte          product index (list of doc sections)
│   │   └── [...slug]/+page.svelte  individual doc page
│   └── styles.css                design tokens + component styles
└── lib/
    ├── config.ts                 navbar branding (env-driven)
    ├── ui.svelte.ts              sidebar state (collapse / mobile drawer)
    └── server/
        ├── dav.ts                WebDAV multi-format loader + manifest + TTL cache
        ├── format.ts             render dispatch (md/txt/html/adoc/csv/docx/xlsx)
        ├── md.ts                 Markdown rendering + doc components
        ├── nav.ts                sidebar model (categories, ordering)
        └── auth.ts / gate.ts     per-product and site passwords
```

## Content model

```
<docsRoot>/
  site.yaml           ← REQUIRED: site password + product index (display order)
  <product>/          ← exactly those listed in site.yaml.products
    docs.yaml         ← REQUIRED per-product manifest (missing → product skipped with warn)
    <page>.md
    <subdir>/<page>.docx   ← pages can nest and use any supported format
```

Discovery is a few direct GETs against known paths — `GET <base>/site.yaml`,
then `GET <base>/<product>/docs.yaml` per listed product, then lazy page GETs.
There is **no PROPFIND, no directory enumeration and nothing auto-discovered**.
Only the exact filenames `site.yaml` and `docs.yaml` are recognised (strict
`.yaml` — no `.yml`, no case-insensitive matching); a product not listed in
`site.yaml` is never served. The product manifest (`docs.yaml`) is the single
source of truth for metadata, categories and ordering. Sidebar grouping and
order come from the `pages` list:

```yaml
title: Atlas
description: Our flagship platform.
cover: cover.png
pages:
  - title: Getting started
    source: getting-started.md
    category: Overview           # optional → "General"
    description: Fastest path to a running Atlas
    updated: 2026-08-01          # optional → file last-modified
  - title: Pricing
    source: pricing.xlsx         # binary formats supported
```

| Manifest key | Purpose                                                              |
| ------------ | ------------------------------------------------------------------- |
| (top) `title` / `description` / `cover` | product metadata → homepage card          |
| (top) `password` | optional per-product access password (product becomes gated)     |
| (top) `copy` | "Ask <provider>" menu config — per-provider `true`/`false`/href; overrides `site.yaml` per key |
| `pages[].title` | page title + sidebar label (default: filename)                    |
| `pages[].source` | file path relative to the product folder                          |
| `pages[].category` | sidebar group (default `General`, first-appearance order)        |
| (list position) | page order                                                        |
| `pages[].description` | shown under the page title                                          |
| `pages[].updated` | display date (default: file last-modified)                        |

Only pages listed in the manifest are served (no frontmatter, no
auto-include). `.doc` is not supported.

### Ask menu (`copy` config)

Each page's Copy / Ask menu can send the page to an AI assistant. Its contents
are driven by a `copy:` map in the content: a **site-wide default** in
`site.yaml`, overridable per product by the product's `docs.yaml` (`docs.yaml`
wins per key). For each provider slug (`copy.claude`, `copy.chatgpt`, …):

- absent / `true` → enabled as a "New chat with this page" deep-link button
- `false` → disabled (hidden)
- a string → enabled as a plain link to that href

See [USAGE.md](USAGE.md#customising-the-ask-menu) for the authoring walkthrough.

## Markdown components

Any page can use these user-facing components. They render server-side and
need no client JavaScript.

### Callouts

GitHub-style alert blockquotes. Types: `NOTE`, `TIP`, `IMPORTANT`, `WARNING`,
`CAUTION`. The body is full Markdown (multi-paragraph, lists, code).

```markdown
> [!NOTE]
> The stable channel updates **every Tuesday** at 16:00 UTC.

> [!TIP] Custom title
> You can override the heading text too.
```

### Banners

Same syntax, type `[!BANNER]`; renders as a large high-emphasis strip, good
for releases or version notices.

```markdown
> [!BANNER] v2.4 is now live
> This release includes the new sync engine. See [the changelog](reference/cli).
```

### Numbered procedures

A normal ordered list renders as a step list with `1.` `2.` `3.` badges.

```markdown
To configure a token:

1. Open the **Settings** page.
2. Click **API Keys** then **Create**.
3. Copy the generated key.
```

### Toggles (collapsible)

Wrap content in a `:::toggle` block. The first line is the always-visible
heading; the body is full Markdown and collapsed by default.

```markdown
:::toggle Can I self-host Atlas?
Yes: run `atlas run` anywhere you like. The agent talks to your own WebDAV
drive, so there is no cloud dependency.
:::
```

## Configuration (env)

| Variable              | Purpose                                                             |
| --------------------- | ------------------------------------------------------------------- |
| `WEBDAV_URL`          | WebDAV docs root                                                     |
| `WEBDAV_USER` / `WEBDAV_PASS` | Basic auth for the drive                                     |
| `WEBDAV_TTL_MS`       | in-memory freshness cache (default 30000)                           |
| `DOCS_BRAND`          | navbar brand text                                                    |
| `DOCS_LOGO`           | navbar logo `<img>` src (https URL or data: URI); replaces brand text when set |

## Authentication

- Passwords live in the content: **per-product** via `password:` in that
  product's `docs.yaml`; **site-wide** via `password:` in the root `site.yaml`
  (the same file also lists the products). A product without a password is
  public; a `site.yaml` without a `password:` keeps the landing page public
  too.
- A locked product is gated **before** rendering; the password is accepted via
  query param (`?key=…` / `?p=…`), an `X-Doc-Key` header, or a styled unlock
  form. On success a session cookie is set and you are redirected to a clean URL.
- Gating runs in `src/hooks.server.ts` **before** any page load, so locked
  content is never rendered. Password lookups share the same WebDAV + TTL cache
  as the content.
- There is no cross-product navigation in the navbar; each product is its own
  silo reached from the landing page.

## Look & feel

- top bar with a customizable navbar and product switcher
- sticky sidebar: categories from the manifest, active page highlighted
- mobile drawer: a hamburger toggle slides the sidebar in/out on small screens (with a backdrop)
- shadcn-style neutral design (Inter, subtle borders/radii, focus rings)
- server-side syntax highlighting (highlight.js) with a code toolbar (Copy, Copy as Markdown, Open in new tab)
- diagrams: ```` ```mermaid ```` fences render to SVG client-side, ```` ```excalidraw ```` fences to inline SVG
- responsive images in docs (public URLs or `/images/…` from `static/`)
- homepage: searchable project grid with cover images and descriptions, fuzzy-matched client-side
- sticky footer on every page

## Build / dependencies

```bash
pnpm install
pnpm dev        # dev server on :4323
pnpm build      # production build (adapter-node)
pnpm check      # svelte-kit sync + svelte-check
HOST=127.0.0.1 PORT=4323 node build/index.js   # run the production build
```

Core dependencies: `@sveltejs/kit`, `svelte` 5, `marked`, `yaml`, `mammoth`,
`xlsx`, `asciidoctor`, `sanitize-html`, `highlight.js`, `mermaid`, `remixicon`.

> `rclone` is used only by the local test harness (`pnpm webdav:sample`). In
> production the loader speaks WebDAV directly over HTTP, so it runs fine in a
> container or on managed/serverless hosts.

## Notes & trade-offs

- Discovery is pure direct GETs: `GET <base>/site.yaml` (product index), then
  `GET <base>/<product>/docs.yaml` per listed product, then exactly the pages
  listed in each manifest — cached for `WEBDAV_TTL_MS`. It performs **no
  PROPFIND, no directory enumeration, and never auto-includes unlisted files.**
  A product listed in `site.yaml` without a `docs.yaml` is skipped with a warn;
  a product not listed is never served.
- `updated` / manifest YAML `Date`s are coerced to ISO strings.
- Raw `.html` pages are sanitized (scripts/stripped attributes removed) before
  rendering.
- Passwords in `?key=` shared links travel in the URL. Fine for docs you hand
  out, not a substitute for real auth on sensitive content.

See [USAGE.md](USAGE.md) for a writing walkthrough and [DOCKER.md](DOCKER.md)
for building and publishing the container image.

## License

EUPL v1.2. See [LICENSE](../LICENSE).

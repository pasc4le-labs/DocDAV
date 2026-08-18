# Technical Overview

`DocDAV` is a SvelteKit app that turns a WebDAV share into a live,
multi-product documentation site. Every top-level folder on the drive is a
product; each Markdown page is rendered server-side on request and cached
in-memory for a short TTL, so content changes appear without a rebuild.

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
        ├── dav.ts                WebDAV Markdown loader + TTL cache
        ├── md.ts                 Markdown rendering + doc components
        ├── nav.ts                sidebar model (categories, ordering)
        └── auth.ts / gate.ts     per-product and site passwords
```

## Content model

```
<docsRoot>/
  <product>/            ← every top-level folder is a product
    <page>.md
    <subdir>/<page>.md  ← nested pages work too
```

Sidebar grouping and ordering come from each page's gray-matter frontmatter:

```yaml
---
title: Getting started
description: Fastest path to a running Atlas
category: Overview
order: 2
---
```

| Frontmatter    | Purpose                                                              |
| -------------- | ------------------------------------------------------------------- |
| `title`        | page title + sidebar label                                          |
| `category`     | sidebar group                                                        |
| `order`        | sort position within the category                                    |
| `description`  | shown under the page title; the index doc's becomes the homepage card description |
| `cover`        | (index doc only) homepage card cover image                           |

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
| `DOC_PASSWORDS`       | JSON `{product: password}`; per-product access control               |
| `DOCS_SITE_PASSWORD`  | protects the homepage `/` (leave empty for a public landing)        |
| `DOCS_BRAND`          | navbar brand text                                                    |
| `DOCS_LOGO`           | navbar logo `<img>` src (https URL or data: URI); replaces brand text when set |

## Authentication

- Any product listed in `DOC_PASSWORDS` becomes password-protected;
  `DOCS_SITE_PASSWORD` additionally protects the homepage `/`.
- The password is accepted via query param (`?key=…` / `?p=…`), an
  `X-Doc-Key` header, or a styled unlock form. On success a session cookie is
  set and you are redirected to a clean URL.
- Gating runs in `src/hooks.server.ts` **before** any page load, so locked
  content is never rendered.
- There is no cross-product navigation in the navbar; each product is its own
  silo reached from the landing page.

## Look & feel

- top bar with a customizable navbar and product switcher
- sticky sidebar: categories from gray-matter, active page highlighted
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

Core dependencies: `@sveltejs/kit`, `svelte` 5, `marked`, `gray-matter`,
`highlight.js`, `mermaid`, `remixicon`.

> `rclone` is used only by the local test harness (`pnpm webdav:sample`). In
> production the loader speaks WebDAV directly over HTTP, so it runs fine in a
> container or on managed/serverless hosts.

## Notes & trade-offs

- The loader **recursively** walks the share (PROPFIND per directory, since
  some servers reject `Depth: infinity`) and caches the whole index for
  `WEBDAV_TTL_MS`.
- Entries must match the expected shape; YAML `Date`s are coerced to ISO strings.
- Passwords in `?key=` shared links travel in the URL. Fine for docs you hand
  out, not a substitute for real auth on sensitive content.

See [USAGE.md](USAGE.md) for a writing walkthrough.

## License

EUPL v1.2. See [LICENSE](../LICENSE).

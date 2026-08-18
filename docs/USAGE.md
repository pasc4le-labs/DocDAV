# Usage

A walkthrough of authoring documentation and running the site.

## Authoring a page

Drop a Markdown file anywhere under a product folder. The file path (minus the
`.md` extension) becomes its URL; subfolders become nested routes.

```
<docsRoot>/atlas/getting-started.md   →  /atlas/getting-started
<docsRoot>/atlas/reference/cli.md     →  /atlas/reference/cli
```

Give each page a title and optional metadata in its frontmatter:

```markdown
---
title: Getting started
description: Fastest path to a running Atlas
category: Overview
order: 2
---
```

- Omitting `category` puts the page in a default group.
- `order` sorts pages within a category (lower first).
- The product `index.md` becomes the product's landing page. Its `cover`
  (path or data URI) and `description` feed the homepage card.

Add a file anywhere on the drive and refresh; it appears in the sidebar
immediately. The sample harness uses a 2s directory cache so it behaves like a
live drive.

## Running locally against sample content

```bash
pnpm install

# Terminal 1: local WebDAV server over content-sample/ on :8090
pnpm webdav:sample

# Terminal 2: dev server on :4323
pnpm dev
```

Open http://127.0.0.1:4323. The sample drive contains two products: `atlas`
and `scorekeeper`. `atlas` is protected with the key `atlaspass` (see
`.env.example`, `DOC_PASSWORDS`).

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

```bash
export DOC_PASSWORDS='{"atlas":"atlaspass"}'
export DOCS_SITE_PASSWORD=        # optional, protects the landing page
```

Locked products are gated before rendering; the password works via `?key=…`,
an `X-Doc-Key` header, or the unlock form.

## Production

```bash
pnpm build
HOST=127.0.0.1 PORT=4323 node build/index.js
```

Point `WEBDAV_URL` at your real WebDAV share and replace the demo credentials
in `.env` (see [Configuration](README.md#configuration-env)).

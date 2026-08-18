# DocDAV

Product documentation platform for a software company, built on **SvelteKit**.
Documentation lives on a **WebDAV drive** (one folder per product); the site
pulls and renders it **live** on every request. Edit a Markdown file on the
drive, refresh, done. No rebuild, no FUSE mount, no rclone daemon at runtime.

## Quick start

```bash
pnpm install

# Terminal 1: local WebDAV server over content-sample/ on :8090
pnpm webdav:sample

# Terminal 2: dev server on :4323
pnpm dev

# Production build + standalone server
pnpm build
HOST=127.0.0.1 PORT=4323 node build/index.js
```

Licensed under the **EUPL v1.2**.

See [docs/](docs/) for the full technical documentation (content model,
components, configuration, auth).

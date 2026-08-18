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

## Docker

Ready-made images are published to GHCR on tag
(`ghcr.io/pasc4le-labs/docdav`, multi-arch `linux/amd64,linux/arm64`).

```bash
docker run -d --name docdav -p 4323:4323 \
  -e WEBDAV_URL="https://<host>/<base>/<docsRoot>/" \
  -e WEBDAV_USER="user" \
  -e WEBDAV_PASS="pass" \
  ghcr.io/pasc4le-labs/docdav:<tag>
```

Or with Docker Compose (copy [docker-compose.yml](docker-compose.yml), set the
`WEBDAV_*` values in `.env`):

```yaml
services:
  docdav:
    image: ghcr.io/pasc4le-labs/docdav:<tag>
    ports:
      - "4323:4323"
    environment:
      WEBDAV_URL: https://<host>/<base>/<docsRoot>/
      WEBDAV_USER: user
      WEBDAV_PASS: pass
      DOC_PASSWORDS: '{"atlas":"atlaspass"}'
      DOCS_BRAND: "Pasc4le Docs"
```

See [docs/DOCKER.md](docs/DOCKER.md) for the full env reference.

Licensed under the **EUPL v1.2**.

See [docs/](docs/) for the full technical documentation (content model,
components, configuration, auth).

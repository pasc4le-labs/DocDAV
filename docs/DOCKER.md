# Docker & container image

DocDAV ships as an OCI image on GitHub Container Registry. It is built and
published automatically on every `v*` tag push (see
[`.github/workflows/ghcr-publish.yml`](../.github/workflows/ghcr-publish.yml)).

## Image

| Field  | Value                              |
| ------ | ---------------------------------- |
| Image  | `ghcr.io/pasc4le-labs/docdav`   |
| Tags   | `<git tag>` and `latest`           |
| Platforms | `linux/amd64`, `linux/arm64`     |
| Base   | `node:22-alpine` (runtime stage)   |
| Port   | `4323`                             |

Multi-stage build: stage 1 installs dev deps and runs `pnpm build`; stage 2
ships only production `node_modules` plus the adapter-node `build/` output.

## Run

```bash
docker run -d --name docdav -p 4323:4323 \
  -e WEBDAV_URL="https://<host>/<base>/<docsRoot>/" \
  -e WEBDAV_USER="user" \
  -e WEBDAV_PASS="pass" \
  -e DOCS_BRAND="Pasc4le Docs" \
  ghcr.io/pasc4le-labs/docdav:<tag>
```

Required env is the same as any deployment: `WEBDAV_URL`, `WEBDAV_USER`,
`WEBDAV_PASS`. See [README.md](README.md#configuration-env) for the full list
(note: access passwords now live in the content, per product in `docs.yaml`,
or a root `site.yaml` for the homepage; not in env).

## Docker Compose

A ready-made [docker-compose.yml](../docker-compose.yml) example ships in the
repo root. It reads its settings from `.env`:

```yaml
services:
  docdav:
    image: ghcr.io/pasc4le-labs/docdav:<tag>
    ports:
      - "4323:4323"
    environment:
      WEBDAV_URL: ${WEBDAV_URL:?set WEBDAV_URL in .env}
      WEBDAV_USER: ${WEBDAV_USER:?set WEBDAV_USER in .env}
      WEBDAV_PASS: ${WEBDAV_PASS:?set WEBDAV_PASS in .env}
      WEBDAV_TTL_MS: ${WEBDAV_TTL_MS:-30000}
      DOCS_BRAND: ${DOCS_BRAND:-DocDAV}
      DOCS_LOGO: ${DOCS_LOGO:-}
```

```bash
# 1. Fill in your WebDAV details
cp .env.example .env
vi .env                      # set WEBDAV_URL, WEBDAV_USER, WEBDAV_PASS

# 2. Run
docker compose up -d
```

`WEBDAV_URL`, `WEBDAV_USER` and `WEBDAV_PASS` are required; the rest are
optional with sensible defaults (a `:?` marker makes compose fail fast if a
required var is missing).

## Release workflow

1. Tag a commit: `git tag v1.0.0 && git push origin v1.0.0`.
2. The `publish-image` workflow builds for `linux/amd64` and `linux/arm64`,
   pushes both to GHCR, then smoke-tests the pushed image against a local
   WebDAV server serving `content-sample/`.
3. Pull with `docker pull ghcr.io/pasc4le-labs/docdav:v1.0.0`.

Pre-release tags (`v1.0.0-a.1`) work the same and are used to validate the
pipeline before a real release.

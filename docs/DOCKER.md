# Docker & container image

DocDAV ships as an OCI image on GitHub Container Registry. It is built and
published automatically on every `v*` tag push (see
[`.github/workflows/ghcr-publish.yml`](../.github/workflows/ghcr-publish.yml)).

## Image

| Field  | Value                              |
| ------ | ---------------------------------- |
| Image  | `ghcr.io/pasc4le-labs/DocDAV`      |
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
  -e DOC_PASSWORDS='{"atlas":"atlaspass"}' \
  -e DOCS_BRAND="Pasc4le Docs" \
  ghcr.io/pasc4le-labs/DocDAV:<tag>
```

Required env is the same as any deployment: `WEBDAV_URL`, `WEBDAV_USER`,
`WEBDAV_PASS`. See [README.md](README.md#configuration-env) for the full list.

## Release workflow

1. Tag a commit: `git tag v1.0.0 && git push origin v1.0.0`.
2. The `publish-image` workflow builds for `linux/amd64` and `linux/arm64`,
   pushes both to GHCR, then smoke-tests the pushed image against a local
   WebDAV server serving `content-sample/`.
3. Pull with `docker pull ghcr.io/pasc4le-labs/DocDAV:v1.0.0`.

Pre-release tags (`v1.0.0-a.1`) work the same and are used to validate the
pipeline before a real release.

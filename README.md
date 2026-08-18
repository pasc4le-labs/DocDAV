# DocDAV

Turn any WebDAV drive into a clean, modern documentation site for your
products.

You keep writing plain Markdown in your own cloud storage (or a self-hosted
server). DocDAV reads it over standard WebDAV and renders it as fast,
searchable, per-product docs. Edit a file, refresh the page, and it is live.
No rebuild, no build pipeline, no extra moving parts.

Each folder on the drive becomes a product. The site builds the sidebar,
search, and per-product access control automatically from your files, and it
runs anywhere a container runs.

## Works with any WebDAV drive

Because it speaks standard WebDAV, DocDAV works out of the box with most cloud
storage and file servers. Popular examples:

- **Nextcloud**
- **ownCloud**
- **pCloud**
- **Yandex.Disk**
- **Koofr**
- **Internxt**

It uses plain HTTP against your provider's WebDAV endpoint, so you are never
locked in, and nothing is cached or copied outside your drive.

## Run it

```bash
docker run -d --name docdav -p 4323:4323 \
  -e WEBDAV_URL="https://<host>/<base>/<docsRoot>/" \
  -e WEBDAV_USER="user" \
  -e WEBDAV_PASS="pass" \
  ghcr.io/pasc4le-labs/docdav:<tag>
```

A Docker Compose example ships as [docker-compose.yml](docker-compose.yml).

## License

Licensed under the **EUPL v1.2**, the European Union Public Licence.

See [docs/](docs/) for full technical documentation (content model,
components, configuration).

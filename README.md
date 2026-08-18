![DocDAV](static/docdav-hero.png)

DocDAV turns any WebDAV drive into a documentation site for your products.
Write in your own cloud storage, or on a self-hosted server; DocDAV reads the
files over WebDAV and renders them as clean, searchable, per-product docs.
Edit a file, refresh the page, and it is live. No build step, no pipeline, no
extra parts.

A product is a folder on the drive, described by a `docs.yaml` manifest that
defines its pages, their categories and their order. Pages render from
Markdown, plain text, raw HTML, AsciiDoc, CSV, .docx and .xlsx, each with
optional per-product password protection. A folder without a manifest
contributes nothing, and files not listed in one are not served.

Because it speaks standard WebDAV, it works out of the box with most cloud
storage and file servers:

- **Self-hosted**: Nextcloud, ownCloud, and any WebDAV-enabled server.
- **Managed / hosted**: Infomaniak kDrive, pCloud, Yandex.Disk, Koofr,
  Internxt, HiDrive, and others.

See [docs/](docs/) for full technical documentation (content model,
components, configuration).

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

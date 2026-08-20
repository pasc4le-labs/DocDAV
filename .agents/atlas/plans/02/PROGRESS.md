# PROGRESS — Plan 02: Site-wide `site.yaml` product index; remove PROPFIND crawl

Updated: 2026-08-19

## Status
- [x] Plan
- [x] Implement
- [x] Verify
- [x] Docs
- [ ] Merge

## Log
- **2026-08-19** — Plan 02 created. Scope agreed with user: make a required
  root `site.yaml` the authoritative product index (replacing root-PROPFIND
  enumeration), delete the entire PROPFIND crawl + WebDAV parsing from
  `dav.ts`, strict (required) yaml, `.yaml`-only filenames. Decided in
  discussion: no new env for products (drive self-declares), no `webdav`
  client dependency (no enumeration → plain `fetch` suffices), no fallback to
  root listing when `site.yaml` is missing (would reintroduce the crawl).
  Sample `atlas`/`scorekeeper` already carry `docs.yaml` from plan 01; only
  `sample/site.yaml` is new. Implementation not started.
- **2026-08-20** — Implementation, verification, and docs complete. **Implement:**
  `dav.ts` rewritten — `buildIndex()` reads the required root `site.yaml`
  (password + ordered `products`) and direct-GETs `<product>/docs.yaml` per listed
  product; the entire PROPFIND crawl + WebDAV multistatus parsing was deleted
  (`propfind()`, `PROPFIND_BODY`, namespace regexes, `relFor`/`relOf`).
  `htmlDecode` removed from `text.ts`. Tests added for `site.yaml`-ordered product
  list, a listed-but-manifest-less product skipped with warn, and a non-listed
  product never served. Suites: `pnpm test` = 64 passed; `pnpm check` = 0 errors.
  **Docs:** README.md, docs/USAGE.md, docs/README.md document the required root
  `site.yaml` + strict `.yaml`; topic `00-architecture.md` updated. **Verify (live
  HTTP)** against `pnpm build` adapter-node on 127.0.0.1:4323 (`WEBDAV_URL=
  http://127.0.0.1:8090/`, user demo / pass secret) backed by `pnpm webdav:sample`
  (rclone webdav over `sample/` on 127.0.0.1:8090): `GET /` → **401** (site gate);
  `GET /?key=site-secret` → **302** `location: /` then **200** with products in
  `site.yaml` order (landing HTML shows *Atlas* before *Scorekeeper*; no third
  product). `GET /atlas` → **401**; `GET /atlas?key=atlaspass` → **302**
  `location: /atlas` then **200** (page renders, 4364 bytes, contains "Atlas —
  Overview"). `GET /scorekeeper` → **200** (public, no key). `GET /ironclad` (not
  in `site.yaml`) → **404**. All background processes (rclone + node build) torn
  down with SIGINT; nothing left listening on 8090/4323. Merge left to the user.

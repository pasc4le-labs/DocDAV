# Plan 02 — Site-wide `site.yaml` product index; remove the PROPFIND crawl; strict `.yaml`

**Status:** Planned (2026-08-19)
**Scope:** DocDAV (`~/prj/docdav`)
**Related:** topics 00-architecture (update on close); plan 01 (per-product `docs.yaml`)

## Why

`dav.ts` currently *discovers* products by PROPFIND-enumerating the drive
root (`propfind('')` → all first-level dirs) and then PROPFINDing each product
dir to locate its `docs.yaml`. That two-level PROPFIND walk is the single
densest, least readable part of the loader (namespace-agnostic multistatus
regexes, href/path resolution, Depth:1 workarounds for kDrive). It also means
the loader *must* parse WebDAV, which is why we considered a client library.

We don't actually want to crawl the drive at all. Content should be fully
**declared**, not discovered. This plan makes the drive self-describing at
every level — `site.yaml` lists products, each `docs.yaml` lists pages — and
collapses discovery to a few direct GETs against known paths, deleting the
entire PROPFIND layer and every line of hand-rolled WebDAV parsing.

## Decisions (agreed in discussion)

1. **`site.yaml` = authoritative product index.** A new required manifest at
   the drive root lists the products. Discovery reads it instead of listing
   the root.
2. **Strict (required) yaml.** `site.yaml` is required; if missing/invalid,
   the site serves no products (log a clear error). **No fallback** to root
   listing — a fallback would silently reintroduce the crawl.
3. **`.yaml` extension only.** Drop the flexible `docs.ya?ml` / `site.ya?ml`
   case-insensitive matching. Canonical filenames are exactly `site.yaml` and
   `docs.yaml`.
4. **No new env for products.** The drive declares its own products via
   `site.yaml`; adding a product is an edit to the drive, not a deploy config
   change.
5. **Explicitly rejected:** the `webdav` npm client (we no longer enumerate,
   so plain `fetch` to fixed paths suffices — no new dependency, no heavy
   CRUD client) and the earlier "extract a transport module" middle-ground
   (superseded: the crawl is *deleted*, not quarantined).

## Content model (new)

```
<base>/
  site.yaml          # REQUIRED: site password + product index
  <product>/         # exactly those listed in site.yaml.products (first-level dirs)
    docs.yaml        # REQUIRED per-product manifest (unchanged from plan 01)
    …pages in any supported format (lazy GET on demand)
```

### `site.yaml` schema

```yaml
password: "site-secret"   # site/homepage gate (existing behaviour)
products:
  - atlas                 # first-level subdirs, in display order
  - scorekeeper
```

- `products` is **authoritative and ordered**: product presentation order =
  list order (replaces the previous "every top-level dir sorted by name").
- `password` keeps its existing role (site gate).
- A product listed in `site.yaml` whose `docs.yaml` is missing → skipped with
  a `console.warn` (typo surface), never breaking the rest of the site.

### Discovery (was a PROPFIND walk, now pure direct GETs)

```
GET <base>/site.yaml            # → password + products
GET <base>/<product>/docs.yaml  # → per listed product: pages metadata
GET <base>/<product>/<source>   # → lazy, only when a page is opened (unchanged)
```

- **Zero PROPFIND, zero enumeration.** Nothing is discovered by listing.
- Content pages stay lazy (`getDoc`/`loadDocContent`) with the existing
  TTL caches (`indexCache`/`fileCache`/`htmlCache`) — this is a feature, not
  protocol noise, and is preserved.

## Code changes — `src/lib/server/dav.ts`

- **Rewritten `buildIndex()`:**
  - `GET site.yaml` (required) → parse `password` + `products`.
  - For each `products` entry: `GET <product>/docs.yaml` → `loadManifest` →
    `metaFromSpec` per page; 404/missing → skip with warn.
- **Delete (all PROPFIND machinery):** `propfind()`, `PROPFIND_BODY`,
  `RESPONSE_BLOCK` / `HREF` / `IS_COLLECTION` regexes, `relFor()` / `relOf()`,
  the root + per-dir enumeration loop.
- **Delete `htmlDecode`** from `src/lib/server/text.ts` (only used by the
  removed PROPFIND href parsing).
- Keep: `loadManifest` (GET + yaml parse), `rawFetch` (GET + binary/text +
  TTL), `metaFromSpec`, `metaFromSpec` derive rules, `getDoc`/`getDocs`/
  `getProductsMeta`/`getPasswordMap`/`getSitePassword` public surface
  (unchanged callers in routes/hooks/nav/auth).
- Product ordering now sourced from `site.yaml.products` order instead of
  sorted dir names.

## Tests — `src/lib/server/dav.test.ts`

- **Remove** the `propfindXml()` helper and the "root PROPFIND lists atlas +
  scorekeeper" fixture; mock only `WEBDAV_URL/_USER/_PASS/_TTL_MS`.
- **Add** direct GET handlers for `site.yaml`, `atlas/docs.yaml`,
  `scorekeeper/docs.yaml`.
- Keep the assertions that survive: metadata derivation (title fallback,
  category default, order, updated), metadata-only index (no page GETs at
  index time), lazy single-page load, html TTL cache, Last-Modified fallback,
  unknown-id 404.
- **Add:** product list + order follows `site.yaml` order; a product listed
  in `site.yaml` with no `docs.yaml` is skipped (with warn); a product *not*
  listed in `site.yaml` is never served.

## Sample

- Add `sample/site.yaml` (e.g. `password: "site-secret"`, `products:
  [atlas, scorekeeper]`). `sample/atlas` and `sample/scorekeeper` already
  carry `docs.yaml` from plan 01 — no per-product content changes needed.

## Docs (user-facing, after code)

- `README.md`, `docs/USAGE.md`, `docs/README.md`: document required root
  `site.yaml` (product index + site password), strict `.yaml`, and that
  adding a product = add it to `site.yaml`.
- Update topic `00-architecture.md` on close (content model, new discovery
  path, env unchanged).

## Verification

- `pnpm install` + `pnpm build` (+ `pnpm check`) pass.
- Run against `pnpm webdav:sample` (rclone over `sample/`): products render
  in `site.yaml` order; gating still works (site.yaml password + per-product
  `docs.yaml` password); a product missing from `site.yaml` is absent; a
  listed-but-manifest-less product warns and is skipped.
- No `PROPFIND` remains in `dav.ts`; no `ya?ml`/case-insensitive filename
  matching remains.

## Out of scope

- Client-side editing / write-back to WebDAV.
- `.doc` (legacy binary) support.
- Per-file frontmatter parsing.
- The `webdav` npm client dependency (rejected by design).

## Env (unchanged)

`WEBDAV_URL`, `WEBDAV_USER`, `WEBDAV_PASS`, `WEBDAV_TTL_MS`, `DOCS_BRAND`,
`DOCS_LOGO`. No `WEBDAV_PRODUCTS` — products come from `site.yaml`.

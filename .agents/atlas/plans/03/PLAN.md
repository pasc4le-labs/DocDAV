# Plan 03 — Multi-language support (i18n)

**Status:** Planned (for review, 2026-08-25)
**Scope:** DocDAV (`~/prj/docdav`)
**Related:** topics 00-architecture (update on close); plan 02 (required `site.yaml` index)

## Why

Today every visible string is hardcoded English (topbar, landing page, code
toolbar, footer) and every product's docs are a single language. DocDAV should
serve both **a localized UI** and **per-language documentation**, declared in
the drive the same way everything else is: manifests, direct GETs, no
client-JS required.

Two independent scopes, both covered here (they can ship in either order):
- **Phase A — UI chrome localization.** Translate the site's own strings.
- **Phase B — content i18n.** Per-language titles/categories/descriptions and
  per-language source files, with `/<lang>/` URLs and a language switch.

## Driving constraints (from the existing design)

- **Declared, not discovered.** Languages must be declared in manifests;
  there is no PROPFIND, no drive enumeration, ever.
- **Lazy, cheap.** Index discovery reads only `site.yaml` + each
  `docs.yaml`. For a chosen language, only that language's pages are
  fetched. No fetching every language's content at index time.
- **Server-rendered chroma.** DocDAV renders UI text server-side (no client
  JS needed to localize). Translation must be available in SSR loaders.
- **Backwards compatible.** A drive that declares no languages behaves
  exactly as today (single `en`, no URL prefix).
- **Gating is language-agnostic.** A key accepted for `/atlas` must also
  unlock `/it/atlas` — a product's gate covers all its language variants.

---

## Phase A — UI chrome localization

A tiny server-side dictionary, keyed by the active `lang`. All ~30 hardcoded
strings move into it.

### New: `src/lib/i18n.ts`
```ts
export type Lang = string;            // narrow to declared langs at runtime
export const DEFAULT_LANG = 'en';
interface Dict { [key: string]: string }
const catalogs: Record<string, Dict> = {
  en: { 'brand.tagline': '…', 'search.placeholder': 'Search projects…', … },
  it: { … },
};
export function t(lang: string, key: string): string {
  return catalogs[lang]?.[key] ?? catalogs[DEFAULT_LANG][key] ?? key;
}
```
Keys for every current string:
- layout: `nav.toggleSidebar`, `brand.home`, `footer.tagline`
- landing: `landing.title`, `landing.tagline`, `search.placeholder`,
  `search.aria`, `search.clear`, `landing.noResults`,
  `landing.projectCount` (needs plural), `landing.browseDocs`
- product index: `product.noDocs`
- doc page: `doc.updated`, `tools.copied`, `tools.copyError`,
  `tools.copy`, `tools.moreActions`, `tools.openTab`, `tools.copyMd`,
  `tools.copyCode`, `tools.promptBar`
- plural helper `tN(lang, 'project', n)` for "N projects / N project".

### Wiring
- `+layout.server.ts` (root) resolves the active `lang` (Phase B URL logic,
  default `en`) and returns it in `data.lang`. `+layout.svelte`, landing,
  product layout, and doc page read `data.lang` and call `t(lang, key)`.
- Doc-page code toolbar (`[...slug]/+page.svelte`) is client-side; read the
  lang from `data.lang` at mount time (prop into the module scope) so the
  toolbar strings, `Copied!`, the standalone snippet page, are localized too.

## Phase B — content i18n

### 1. Language declaration — `site.yaml`

```yaml
password: "site-secret"        # unchanged
languages: [en, it]            # optional; first entry = default
defaultLanguage: en            # optional; default "en"
products: [atlas, scorekeeper] # unchanged
```
- `languages` absent → treated as `[en]` (today's behaviour, no prefix).
- `languages` present → default = `languages[0]` unless `defaultLanguage`
  says otherwise. Every URL resolves to exactly one language.

### 2. Localized manifest values — `docs.yaml`

Any of `title`, `description`, `cover` (product top-level) and per-page
`title`, `category`, `description` may be **either a scalar** (applies to all
languages — existing behaviour) **or a map** `{ en: …, it: … }` (localized,
missing key falls back to the default language's value, then to nothing).

Per-page `source` gains the same duality — the pivot for real content i18n:
```yaml
pages:
  - title: { en: "Getting started", it: "Per iniziare" }
    source: { en: getting-started.md, it: guide/avvio.md }  # per-lang file
    category: { en: Overview, it: Panoramica }
  - title: Pricing                    # scalar → shared across languages
    source: pricing.xlsx
```
- `source` scalar → one shared file for every language (labels may still be
  localized).
- `source` map → each language reads its own file. A language with no entry
  falls back to the default language's file.

### 3. URL scheme (minimal churn, SEO-friendly)

- **Default language → un-prefixed** (current URLs preserved:
  `/atlas/getting-started`, `/`).
- **Non-default language → `/<lang>/` prefix** (`/it/atlas/avvio`,
  `/it`, `/it/atlas`).
- A `resolveLang(path)` helper returns `{ lang, rest }`: if the first path
  segment is a declared non-default language, strip it; otherwise lang =
  default and `rest` is the whole path. No redirect gymnastics.

### 4. Routing & data flow

- **Keep** `/[product]/[...slug]` + `/[product]` + `/` for the default lang
  (unchanged).
- **Add** non-default trees: `/[lang]/` (landing), `/[lang]/[product]`,
  `/[lang]/[product]/[...slug]` (only bind to declared non-default langs).
- `dav.ts`: thread `lang` through index building so each `DocMeta` carries
  the *selected* language's title/category/description/source. Options that
  keep the index cheap:
  - **Per-language index cache** keyed `lang` (`Map<lang, Index>`), each
    built from the same `site.yaml`+`docs.yaml` but resolving localized
    values and only adding pages whose per-lang source resolves. This keeps
    discovery lazy per language (a page present only in `it` won't appear
    under `en`).
  - `getDoc(id, lang)` resolves the per-language source and lazy-fetches
    that file. Cache the rendered body per `(id, lang)`.
- All hrefs (landing cards, product sidebar, URL building) prepend the
  active `lang` prefix when it is non-default. `nav.ts`
  (`listProducts`/`sidebarFor`) accepts `lang` and emits prefixed `href`s +
  localized labels.

### 5. Site/password gating — language-agnostic

In `hooks.server.ts` the product is currently the **first** path segment.
With a lang prefix it's segment 0 or segment 1. Add `resolveLang(path)` and
derive the product from `rest` (segment 0 of the stripped path). The gate key
(`AUTH_COOKIE`, `AUTH_SITE`, product) is unchanged, so `/atlas` and `/it/atlas`
share one unlock. Landing gate: `/` and `/it` both check the `site.yaml`
password (same `AUTH_SITE` key).

### 6. Language switcher

A small control in the topbar (shown only when a product page declares >1
language for it, or on the landing when `site.yaml` declares >1 language).
For the current page it links to the **parallel page** in the other
language(s): given a per-language `source` map, the sibling URL is
deterministic; given a shared/scalar `source`, all languages point at the
same page. If the target language has no parallel page, fall back to the
product root (`/<lang>/atlas`).

## Sample content

- Add to `sample/site.yaml`: `languages: [en, it]`.
- `sample/atlas/docs.yaml`: localize `title`/`description`; give 2–3 pages a
  per-language `source` map (`it` files added under `sample/atlas/it/…`) and
  one shared page; localize a category. `scorekeeper` stays scalars to prove
  the shared-content path.
- Add corresponding `sample/atlas/it/` markdown.

## Tests

- `dav.test.ts`: localized title/category/description resolution; per-lang
  `source` picks the right file; scalar `source` shared across langs; a page
  present only in `it` absent from `en` index; missing map key falls back to
  default lang; no languages declared → single `en`, all current assertions
  unchanged.
- `hooks`/gate: `/it/atlas` accepted with a key set at `/atlas` (same cookie).
- Suites: `pnpm test`, `pnpm check` (0 errors), `pnpm build` green.

## Docs updates (after code)

- `README.md`, `docs/USAGE.md`, `docs/README.md`: `site.yaml` language
  declaration, localized `docs.yaml` values, `/<lang>/` URL scheme, language
  switcher.
- Update topic `00-architecture.md` on close (language config, localized
  manifests, per-lang cache, URL scheme).

## Verification

- `pnpm install` + `pnpm build` + `pnpm check` pass.
- Run against `pnpm webdav:sample` + `node build`: `/` shows en landing;
  `/it` shows it landing; `/atlas/…` resolves en page, `/it/atlas/…` the it
  page for per-lang sources and the shared page for scalar sources; sidebar
  categories localized; language switcher jumps between `/atlas/…` and
  `/it/atlas/…`; `/it/atlas` accepts the same `atlaspass` key as `/atlas`;
  UI strings localized on `/it`.
- A drive without `languages` serves exactly as today (regression check).

## Out of scope

- Automatic machine translation of content.
- Client-side editing / write-back.
- `.doc` support (unchanged).
- More than one `defaultLanguage` fallback chain — one default is enough.
- Transifex/PO-file tooling — a static TS catalog suffices at this size.

## Env (unchanged)

`WEBDAV_URL`, `WEBDAV_USER`, `WEBDAV_PASS`, `WEBDAV_TTL_MS`, `DOCS_BRAND`,
`DOCS_LOGO`. Languages come from `site.yaml`, not env.
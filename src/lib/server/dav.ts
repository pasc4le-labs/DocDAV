import { parse as parseYaml } from 'yaml';
import { env } from '$env/dynamic/private';
import { detectKind, isBinaryKind, renderBodyAsync } from './format';
import { humanize } from './text';

/**
 * Server-only WebDAV multi-format loader for drive-docs.
 *
 * Content model (self-describing drive — declared, not discovered):
 *   <baseUrl>/site.yaml                      # REQUIRED: site password + product index
 *   <baseUrl>/<product>/docs.yaml            # REQUIRED per-product manifest
 *   <baseUrl>/<product>/...                  # content files listed in the manifest
 *
 * Discovery is a handful of direct GETs against known paths — there is NO
 * PROPFIND and NO drive enumeration. `site.yaml` lists the products (in
 * display order); each product's `docs.yaml` lists its pages. A product
 * listed in `site.yaml` whose `docs.yaml` is missing is skipped (a
 * `console.warn`), never breaking the rest of the site. A product NOT listed
 * in `site.yaml` is never served.
 *
 * Every page must be listed in its product's `docs.yaml`. There is NO
 * auto-include and no frontmatter parsing: a file not listed in a manifest is
 * ignored. `source` paths resolve relative to the product dir.
 */
export interface DocMeta {
  id: string; // path relative to base, no extension (product/category/slug)
  title: string;
  description?: string;
  product: string;
  category: string;
  order: number;
  updated?: string;
  /** Product-level cover (populated only on the product's landing metadata). */
  cover?: string;
  path: string;
  /**
   * Rendered page body. NOT populated by index discovery — content is
   * lazily fetched + rendered on demand via `getDoc`. Present only on docs
   * returned from `getDoc`.
   */
  html?: string;
}

/** Product-level metadata from the manifest top level. */
export interface ProductMeta {
  description?: string;
  cover?: string;
  /** Optional per-product access password. Present → product is gated. */
  password?: string;
}

interface PageSpec {
  title?: string;
  source: string;
  category?: string;
  description?: string;
  updated?: string;
}

interface Manifest {
  title?: string;
  description?: string;
  cover?: string;
  password?: string;
  pages?: PageSpec[];
}

const base = ensureTrailingSlash(env.WEBDAV_URL || 'http://127.0.0.1:8090/');
const ttlMs = Number(env.WEBDAV_TTL_MS || 30_000);
const auth =
  'Basic ' +
  Buffer.from(`${env.WEBDAV_USER || 'demo'}:${env.WEBDAV_PASS || 'secret'}`).toString('base64');

interface CacheEntry {
  expiresAt: number;
  text?: string;
  buffer?: ArrayBuffer;
  lastModified?: string;
}
const fileCache = new Map<string, CacheEntry>();
interface Index {
  at: number;
  docs: DocMeta[];
  products: Map<string, ProductMeta>;
  /** Site-wide (homepage) password from <base>/site.yaml. */
  sitePassword?: string;
}
let indexCache: Index | null = null;

/**
 * Lazily-rendered page bodies, keyed by doc id. Populated only when a page is
 * actually requested (see `getDoc`), so index discovery never touches page
 * content — it fetches only `site.yaml` and each product's `docs.yaml`.
 */
const htmlCache = new Map<string, { at: number; html: string }>();

function ensureTrailingSlash(url: string): string {
  return url.endsWith('/') ? url : `${url}/`;
}

function coerceString(v: unknown): string | undefined {
  if (typeof v === 'string') return v;
  if (v instanceof Date) return v.toISOString();
  return undefined;
}

async function rawFetch(
  url: string,
  binary: boolean,
): Promise<{ text?: string; buffer?: ArrayBuffer; lastModified?: string }> {
  const hit = fileCache.get(url);
  if (hit && hit.expiresAt > Date.now()) return hit;
  const res = await fetch(url, { headers: { Authorization: auth } });
  if (!res.ok) {
    throw new Error(`WebDAV GET ${url} failed: ${res.status} ${res.statusText}`);
  }
  const lastModified = res.headers.get('last-modified') ?? undefined;
  const value = binary
    ? { buffer: await res.arrayBuffer(), lastModified }
    : { text: await res.text(), lastModified };
  fileCache.set(url, { ...value, expiresAt: Date.now() + ttlMs });
  return value;
}

/** Fetch and parse a product's `docs.yaml` manifest (direct GET). */
async function loadManifest(relYaml: string): Promise<Manifest> {
  const href = new URL(encodeURI(relYaml), base).href;
  const { text } = await rawFetch(href, false);
  const parsed = (parseYaml(text ?? '') ?? {}) as Partial<Manifest>;
  return {
    title: coerceString(parsed.title),
    description: coerceString(parsed.description),
    cover: coerceString(parsed.cover),
    password: coerceString(parsed.password),
    pages: Array.isArray(parsed.pages) ? (parsed.pages as PageSpec[]) : [],
  };
}

function titleFromPath(relPath: string): string {
  const baseName = relPath.split('/').pop() ?? relPath;
  return humanize(baseName.replace(/\.[^/.]+$/, ''));
}

/** Derive a metadata-only DocMeta entry from a manifest page spec. Cheap: no
 * content is fetched or rendered at index time. */
function metaFromSpec(relPath: string, spec: PageSpec, order: number, product: string): DocMeta {
  return {
    id: relPath.replace(/\.[^/.]+$/, ''),
    title:
      (typeof spec.title === 'string' && spec.title.trim() ? spec.title.trim() : undefined) ??
      titleFromPath(relPath),
    description: coerceString(spec.description) ?? undefined,
    product,
    category: (coerceString(spec.category) || 'General').trim(),
    order,
    updated: coerceString(spec.updated),
    path: relPath,
  };
}

/** Lazily fetch + render a single page's body (`doc.html`), cached per TTL.
 * This is the only place content bytes are pulled from WebDAV, so a request
 * for one page never fetches its siblings or other products. */
async function loadDocContent(doc: DocMeta): Promise<DocMeta> {
  const hit = htmlCache.get(doc.id);
  if (hit && Date.now() - hit.at < ttlMs) {
    return { ...doc, html: hit.html };
  }
  const kind = detectKind(doc.path);
  if (!kind) throw new Error(`Unsupported format for ${doc.path}`);
  const href = new URL(encodeURI(doc.path), base).href;
  const isBinary = isBinaryKind(kind);
  const { text, buffer, lastModified } = await rawFetch(href, isBinary);
  const sl = doc.path.lastIndexOf('/');
  const baseDir = sl === -1 ? '' : doc.path.slice(0, sl);
  const html = await renderBodyAsync(kind, { text, buffer }, { baseDir });
  htmlCache.set(doc.id, { at: Date.now(), html });
  return { ...doc, updated: doc.updated ?? lastModified, html };
}

/**
 * Build the full index from declared manifests only — no PROPFIND, no
 * enumeration.
 *
 *   1. GET <base>/site.yaml (REQUIRED) → `password` + `products` (in order).
 *   2. For each entry in `products`: GET <base>/<product>/docs.yaml →
 *      loadManifest → metaFromSpec per listed page.
 *
 * A product listed in `site.yaml` whose `docs.yaml` is missing (404) is
 * skipped with a `console.warn`. If `site.yaml` itself is missing/invalid,
 * the site serves no products and logs a clear error — there is NO fallback
 * to listing the drive root.
 *
 * Product display order follows `site.yaml.products` order.
 */
async function buildIndex(): Promise<Index> {
  const docs: DocMeta[] = [];
  const products = new Map<string, ProductMeta>();

  const siteUrl = new URL('site.yaml', base).href;
  let sitePassword: string | undefined;

  let siteText: string;
  try {
    const { text } = await rawFetch(siteUrl, false);
    siteText = text ?? '';
  } catch (err) {
    // site.yaml is required. No products, no fallback to root listing.
    console.error(
      `[dav] missing/invalid required site.yaml at ${siteUrl}; serving no products.`,
      err,
    );
    return { at: Date.now(), docs, products, sitePassword: undefined };
  }

  const parsed = (parseYaml(siteText) ?? {}) as Record<string, unknown>;
  sitePassword = coerceString(parsed.password);

  const productList = Array.isArray(parsed.products) ? parsed.products : [];
  for (const entry of productList) {
    if (typeof entry !== 'string' || !entry.trim()) continue;
    const product = entry.trim();

    let manifest: Manifest;
    try {
      manifest = await loadManifest(`${product}/docs.yaml`);
    } catch (err) {
      console.warn(`[dav] skipping product "${product}" (missing docs.yaml):`, err);
      continue;
    }

    products.set(product, {
      description: manifest.description,
      cover: manifest.cover,
      password: manifest.password,
    });

    const pages = manifest.pages ?? [];
    for (let i = 0; i < pages.length; i++) {
      const spec = pages[i];
      if (!spec || typeof spec.source !== 'string' || !spec.source) continue;
      const relPath = `${product}/${spec.source}`;
      if (!detectKind(relPath)) {
        // Unsupported format — skip at discovery (same as before), content
        // fetch/errors are deferred and surface only if the page is visited.
        console.warn(`[dav] skipping page "${relPath}": unsupported format`);
        continue;
      }
      docs.push(metaFromSpec(relPath, spec, i, product));
    }
  }

  return { at: Date.now(), docs, products, sitePassword };
}

async function getIndex(): Promise<Index> {
  const now = Date.now();
  if (indexCache && now - indexCache.at < ttlMs) {
    return indexCache;
  }
  indexCache = await buildIndex();
  return indexCache;
}

/** Full doc index, cached for the TTL. */
export async function getDocs(): Promise<DocMeta[]> {
  return (await getIndex()).docs;
}

/** Product-level metadata (title/description/cover) from manifests. */
export async function getProductsMeta(): Promise<Map<string, ProductMeta>> {
  return (await getIndex()).products;
}

/** Fetch a single doc by id (path without extension). Resolves metadata from
 * the index, then lazily fetches + renders only that page's body. Returns
 * undefined (→ 404) when the id is unknown or its content can't be loaded. */
export async function getDoc(id: string): Promise<DocMeta | undefined> {
  const docs = await getDocs();
  const doc = docs.find((d) => d.id === id);
  if (!doc) return undefined;
  try {
    return await loadDocContent(doc);
  } catch (err) {
    console.warn(`[dav] failed to lazy-load "${id}":`, err);
    return undefined;
  }
}

/** Per-product access passwords, keyed by product name (from docs.yaml). */
export async function getPasswordMap(): Promise<Map<string, string>> {
  const { products } = await getIndex();
  const map = new Map<string, string>();
  for (const [name, meta] of products) {
    if (meta.password) map.set(name, meta.password);
  }
  return map;
}

/** Site-wide (homepage) password from the root `site.yaml`. */
export async function getSitePassword(): Promise<string | undefined> {
  return (await getIndex()).sitePassword;
}

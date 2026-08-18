import { parse as parseYaml } from 'yaml';
import { env } from '$env/dynamic/private';
import { detectKind, isBinaryKind, renderBodyAsync } from './format';
import { htmlDecode, humanize } from './text';

/**
 * Server-only WebDAV multi-format loader for drive-docs.
 *
 * Content model (per-product manifest — single source of truth):
 *   <baseUrl>/<product>/docs.yaml      # manifest (required)
 *   <baseUrl>/<product>/...            # content files listed in the manifest
 *
 * Every page must be listed in its product's `docs.yaml`. There is NO
 * auto-include and no frontmatter parsing (backwards compatibility dropped):
 * a product dir without a manifest contributes nothing, and a file not listed
 * in a manifest is ignored. `source` paths resolve relative to the product dir.
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
 * content — it fetches only the first-level subdir manifests.
 */
const htmlCache = new Map<string, { at: number; html: string }>();

const PROPFIND_BODY = `<?xml version="1.0"?>
<d:propfind xmlns:d="DAV:"><d:allprop/></d:propfind>`;

// Namespace-agnostic regexes for parsing a PROPFIND multistatus response.
// Infomaniak/kDrive (like many servers) rejects `Depth: infinity` (RFC 4918
// allows it but most implementations refuse it), so we walk the tree one
// directory at a time with `Depth: 1` and pull `<href>` / `<collection>` out of
// each `<response>` block ourselves. A WebDAV client library wouldn't remove
// this constraint (lazy, per-directory discovery is inherent to our manifest
// model), so a ~30-line regex parse is kept over adding a dependency.
const RESPONSE_BLOCK = /<(?:[\w]+:)?response[^>]*>([\s\S]*?)<\/(?:[\w]+:)?response>/gi;
const HREF = /<(?:[\w]+:)?href[^>]*>([^<]*)<\/(?:[\w]+:)?href>/i;
const IS_COLLECTION =
  /<(?:[\w]+:)?resourcetype[^>]*>[\s\S]*?<(?:[\w]+:)?collection(?:\s[^>]*)?\/?>/i;

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

interface PropEntry {
  rel: string;
  isCollection: boolean;
}

/** PROPFIND a directory (Depth 1) and return its immediate children. */
async function propfind(relDir: string): Promise<PropEntry[]> {
  const url = relDir ? new URL(`${encodeURI(relDir)}/`, base).href : base;
  const res = await fetch(url, {
    method: 'PROPFIND',
    headers: { Authorization: auth, Depth: '1', 'Content-Type': 'application/xml' },
    body: PROPFIND_BODY,
  });
  if (!res.ok) {
    throw new Error(`WebDAV PROPFIND ${url} failed: ${res.status} ${res.statusText}`);
  }
  const xml = await res.text();
  const basePath = new URL(base).pathname;
  const relOf = (pathname: string) =>
    pathname.startsWith(basePath) ? pathname.slice(basePath.length) : pathname.replace(/^\/+/, '');

  const out: PropEntry[] = [];
  let block: RegExpExecArray | null;
  while ((block = RESPONSE_BLOCK.exec(xml)) !== null) {
    const inner = block[1];
    const rel = relFor(inner, url, relOf);
    if (rel) out.push({ rel, isCollection: IS_COLLECTION.test(inner) });
  }
  return out;
}

/** Parse one PROPFIND `<response>` block into a relative path, or null when it
 * has no `<href>` or it resolves to the directory itself. */
function relFor(inner: string, url: string, relOf: (p: string) => string): string | null {
  const href = HREF.exec(inner)?.[1];
  if (!href) return null;
  const pathname = new URL(decodeURIComponent(htmlDecode(href)), new URL(url)).pathname;
  const rel = relOf(pathname).replace(/\/+$/, '').replace(/^\/+/, '');
  return rel || null;
}

/** Fetch and parse a product's `docs.yaml` manifest. */
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
  const html = await renderBodyAsync(kind, { text, buffer });
  htmlCache.set(doc.id, { at: Date.now(), html });
  return { ...doc, updated: doc.updated ?? lastModified, html };
}

async function buildIndex(): Promise<Index> {
  const docs: DocMeta[] = [];
  const products = new Map<string, ProductMeta>();

  const top = await propfind('');
  const productDirs = top
    .filter((e) => e.isCollection)
    .map((e) => e.rel)
    .sort();

  // Optional site-wide config at the drive root: <base>/site.yaml
  let sitePassword: string | undefined;
  const siteEntry = top.find((e) => !e.isCollection && /^site\.ya?ml$/i.test(e.rel));
  if (siteEntry) {
    try {
      const { text } = await rawFetch(new URL(encodeURI(siteEntry.rel), base).href, false);
      const parsed = (parseYaml(text ?? '') ?? {}) as Record<string, unknown>;
      sitePassword = coerceString(parsed.password);
    } catch (err) {
      console.warn('[dav] site.yaml:', err);
    }
  }

  for (const dir of productDirs) {
    let manifest: Manifest;
    try {
      const entries = await propfind(dir);
      const yamlEntry = entries.find(
        (e) => !e.isCollection && /^docs\.ya?ml$/i.test(e.rel.split('/').pop() ?? ''),
      );
      if (!yamlEntry) continue; // no manifest → contributes nothing
      manifest = await loadManifest(yamlEntry.rel);
    } catch (err) {
      console.warn(`[dav] skipping product "${dir}":`, err);
      continue;
    }

    products.set(dir, {
      description: manifest.description,
      cover: manifest.cover,
      password: manifest.password,
    });

    const pages = manifest.pages ?? [];
    for (let i = 0; i < pages.length; i++) {
      const spec = pages[i];
      if (!spec || typeof spec.source !== 'string' || !spec.source) continue;
      const relPath = `${dir}/${spec.source}`;
      if (!detectKind(relPath)) {
        // Unsupported format — skip at discovery (same as before), content
        // fetch/errors are deferred and surface only if the page is visited.
        console.warn(`[dav] skipping page "${relPath}": unsupported format`);
        continue;
      }
      docs.push(metaFromSpec(relPath, spec, i, dir));
    }
  }

  docs.sort((a, b) => a.product.localeCompare(b.product) || a.order - b.order);
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

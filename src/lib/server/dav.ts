import matter from 'gray-matter';
import { env } from '$env/dynamic/private';
import { renderMd } from './md';

/**
 * Server-only WebDAV Markdown loader for drive-docs.
 *
 * Reads every .md file under a WebDAV share (recursively — PROPFIND per
 * directory, because some servers reject Depth: infinity), parses
 * gray-matter frontmatter, renders the body to HTML with server-side syntax
 * highlighting, and caches the whole result in-memory for a TTL.
 *
 * Content model:
 *   <baseUrl>/<product>/<category…>/<page>.md
 *   product  = top-level directory
 *   category / order = gray-matter frontmatter (drives the sidebar)
 */

export interface DocMeta {
  id: string; // path relative to base, no extension (product/category/slug)
  title: string;
  description?: string;
  product: string;
  category: string;
  order: number;
  updated?: string;
  cover?: string;
  path: string;
  html: string;
}

// Configure marked once: highlight code blocks server-side (see md.ts).

const base = ensureTrailingSlash(env.WEBDAV_URL || 'http://127.0.0.1:8090/');
const ttlMs = Number(env.WEBDAV_TTL_MS || 30_000);
const auth =
  'Basic ' +
  Buffer.from(
    `${env.WEBDAV_USER || 'demo'}:${env.WEBDAV_PASS || 'secret'}`
  ).toString('base64');

const fileCache = new Map<
  string,
  { expiresAt: number; text: string; lastModified?: string }
>();
const docsCache: { at: number; docs: DocMeta[] | null } = { at: 0, docs: null };

const PROPFIND_BODY = `<?xml version="1.0"?>
<d:propfind xmlns:d="DAV:"><d:allprop/></d:propfind>`;

function ensureTrailingSlash(url: string): string {
  return url.endsWith('/') ? url : url + '/';
}

function htmlDecode(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"');
}

function coerceString(v: unknown): string | undefined {
  if (typeof v === 'string') return v;
  if (v instanceof Date) return v.toISOString();
  return undefined;
}

async function rawFetch(url: string): Promise<{ text: string; lastModified?: string }> {
  const hit = fileCache.get(url);
  if (hit && hit.expiresAt > Date.now()) return hit;
  const res = await fetch(url, { headers: { Authorization: auth } });
  if (!res.ok) {
    throw new Error(`WebDAV GET ${url} failed: ${res.status} ${res.statusText}`);
  }
  const value = {
    text: await res.text(),
    lastModified: res.headers.get('last-modified') ?? undefined,
  };
  fileCache.set(url, { ...value, expiresAt: Date.now() + ttlMs });
  return value;
}

/** Recursively list all .md files under the share. */
async function listMarkdownFiles(): Promise<string[]> {
  const files: string[] = [];
  const seen = new Set<string>();
  const basePath = new URL(base).pathname;

  const relOf = (pathname: string) =>
    pathname.startsWith(basePath)
      ? pathname.slice(basePath.length)
      : pathname.replace(/^\/+/, '');

  async function propfind(relDir: string) {
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
    const out: { rel: string; isCollection: boolean }[] = [];
    const blockRe = /<(?:\w+:)?response[^>]*>([\s\S]*?)<\/(?:\w+:)?response>/gi;
    let block: RegExpExecArray | null;
    while ((block = blockRe.exec(xml)) !== null) {
      const inner = block[1];
      const hrefMatch = /<(?:\w+:)?href[^>]*>([^<]*)<\/(?:\w+:)?href>/i.exec(inner);
      if (!hrefMatch) continue;
      const pathname = new URL(decodeURIComponent(htmlDecode(hrefMatch[1])), new URL(url))
        .pathname;
      const rel = relOf(pathname).replace(/\/+$/, '').replace(/^\/+/, '');
      if (!rel) continue;
      const isCollection =
        /<(?:\w+:)?resourcetype[^>]*>[\s\S]*?<(?:\w+:)?collection(?:\s[^>]*)?\/?>/i.test(
          inner
        );
      out.push({ rel, isCollection });
    }
    return out;
  }

  async function walk(relDir: string) {
    const key = relDir || '.';
    if (seen.has(key)) return;
    seen.add(key);
    for (const entry of await propfind(relDir)) {
      if (entry.isCollection) await walk(entry.rel);
      else if (/\.(md|markdown)$/i.test(entry.rel)) files.push(entry.rel);
    }
  }

  await walk('');
  return files.sort();
}

async function loadDoc(relPath: string): Promise<DocMeta> {
  const href = new URL(encodeURI(relPath), base).href;
  const { text, lastModified } = await rawFetch(href);
  const file = matter(text);
  const fm = (file.data ?? {}) as Record<string, unknown>;
  const id = relPath.replace(/\.(md|markdown)$/i, '');
  const parts = relPath.split('/');
  return {
    id,
    title: typeof fm.title === 'string' && fm.title ? fm.title : id.split('/').pop() ?? id,
    description: typeof fm.description === 'string' ? fm.description : undefined,
    cover: typeof fm.cover === 'string' && fm.cover ? fm.cover : undefined,
    product: parts[0] ?? 'docs',
    category: typeof fm.category === 'string' && fm.category ? fm.category : 'General',
    order: typeof fm.order === 'number' ? fm.order : 9999,
    updated: coerceString(fm.updated) ?? lastModified,
    path: relPath,
    html: renderMd(file.content || ''),
  };
}

/** Full doc index for the share, cached for the TTL. */
export async function getDocs(): Promise<DocMeta[]> {
  const now = Date.now();
  if (docsCache.docs && now - docsCache.at < ttlMs) {
    return docsCache.docs;
  }
  const files = await listMarkdownFiles();
  const docs = await Promise.all(files.map(loadDoc));
  docsCache.at = now;
  docsCache.docs = docs;
  return docs;
}

/** Fetch a single doc by id (path without extension). */
export async function getDoc(id: string): Promise<DocMeta | undefined> {
  const docs = await getDocs();
  return docs.find((d) => d.id === id);
}

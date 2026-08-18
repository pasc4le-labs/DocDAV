import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DocMeta } from './dav';

// Deterministic env, resolved before dav.ts's module-top-level reads.
vi.mock('$env/dynamic/private', () => ({
  env: {
    WEBDAV_URL: 'https://webdav.example.test/',
    WEBDAV_USER: 'demo',
    WEBDAV_PASS: 'secret',
    WEBDAV_TTL_MS: '60000',
  },
}));

const BASE = 'https://webdav.example.test/';

const ATLAS_YAML = `title: Atlas Docs
description: Atlas product description
cover: https://x/cover.png
pages:
  - source: index.md
    title: Home
    category: Guide
    description: The index page
    updated: '2024-03-15'
  - source: getting-started.md
`;

const ZETA_YAML = `pages:
  - source: about.md
`;

function propfindXml(entries: { href: string; collection: boolean }[]): string {
  const blocks = entries
    .map(
      (e) =>
        `<d:response><d:href>${e.href}</d:href><d:propstat><d:prop><d:resourcetype>${
          e.collection ? '<d:collection/>' : ''
        }</d:resourcetype></d:prop></d:propstat></d:response>`,
    )
    .join('');
  return `<?xml version="1.0"?><d:multistatus xmlns:d="DAV:">${blocks}</d:multistatus>`;
}

interface Call {
  url: string;
  method: string;
}

describe('dav loader', () => {
  let calls: Call[] = [];

  beforeEach(() => {
    calls = [];
    vi.resetModules();

    const fetchMock = vi.fn(async (input: unknown, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : String((input as URL).href ?? input);
      const method = (init?.method ?? 'GET').toUpperCase();
      calls.push({ url, method });

      if (method === 'PROPFIND') {
        if (url === BASE) {
          return new Response(
            propfindXml([
              { href: `${BASE}atlas/`, collection: true },
              { href: `${BASE}zeta/`, collection: true },
            ]),
            { status: 200 },
          );
        }
        if (url.endsWith('/atlas/')) {
          return new Response(
            propfindXml([
              { href: `${BASE}atlas/index.md`, collection: false },
              { href: `${BASE}atlas/getting-started.md`, collection: false },
              { href: `${BASE}atlas/docs.yaml`, collection: false },
            ]),
            { status: 200 },
          );
        }
        if (url.endsWith('/zeta/')) {
          return new Response(
            propfindXml([
              { href: `${BASE}zeta/about.md`, collection: false },
              { href: `${BASE}zeta/docs.yaml`, collection: false },
            ]),
            { status: 200 },
          );
        }
      }

      if (url.endsWith('/atlas/docs.yaml')) {
        return new Response(ATLAS_YAML, {
          status: 200,
          headers: { 'last-modified': 'Mon, 01 Jan 2024 00:00:00 GMT' },
        });
      }
      if (url.endsWith('/zeta/docs.yaml')) {
        return new Response(ZETA_YAML, { status: 200 });
      }
      if (url.endsWith('/atlas/getting-started.md')) {
        return new Response('# Getting Started\n\nBody here.', {
          status: 200,
          headers: { 'last-modified': 'Tue, 02 Jan 2024 00:00:00 GMT' },
        });
      }
      if (url.endsWith('/atlas/index.md')) {
        return new Response('# Index', { status: 200 });
      }
      return new Response('not found', { status: 404 });
    });
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const contentGets = (path: string) =>
    calls.filter((c) => c.method === 'GET' && c.url.endsWith(path));

  it('builds metadata from manifests via metaFromSpec (title fallback, category default, passthrough)', async () => {
    const dav = await import('./dav');
    const docs = await dav.getDocs();

    // Sorted by product, then manifest order.
    expect(docs.map((d) => d.id)).toEqual(['atlas/index', 'atlas/getting-started', 'zeta/about']);

    const index = docs.find((d) => d.id === 'atlas/index')!;
    expect(index.title).toBe('Home');
    expect(index.category).toBe('Guide');
    expect(index.description).toBe('The index page');
    expect(index.updated).toBe('2024-03-15');
    expect(index.order).toBe(0);
    expect(index.product).toBe('atlas');
    expect(index.path).toBe('atlas/index.md');

    const gs = docs.find((d) => d.id === 'atlas/getting-started')!;
    expect(gs.title).toBe('Getting Started'); // humanized from filename
    expect(gs.category).toBe('General'); // default when absent
    expect(gs.order).toBe(1);
    expect(gs.description).toBeUndefined();

    // metaFromSpec strips the extension from the id but keeps it on the path.
    expect(gs.id).toBe('atlas/getting-started');
    expect(gs.path).toBe('atlas/getting-started.md');

    const zeta = docs.find((d) => d.id === 'zeta/about')!;
    expect(zeta.title).toBe('About');
    expect(zeta.category).toBe('General');
  });

  it('index discovery is metadata-only: it never GETs page content', async () => {
    const dav = await import('./dav');
    await dav.getDocs();
    expect(contentGets('getting-started.md')).toHaveLength(0);
    expect(contentGets('index.md')).toHaveLength(0);
    expect(calls.filter((c) => c.method === 'GET' && c.url.endsWith('.md'))).toHaveLength(0);
  });

  it('getDoc lazily fetches AND renders only the requested page', async () => {
    const dav = await import('./dav');
    const doc = (await dav.getDoc('atlas/getting-started')) as DocMeta;

    expect(doc.html).toContain('<h1');
    expect(doc.html).toContain('Body here.');
    // Only this one source file was pulled from WebDAV.
    expect(contentGets('getting-started.md')).toHaveLength(1);
    expect(contentGets('index.md')).toHaveLength(0);
    expect(contentGets('about.md')).toHaveLength(0);
  });

  it('loadDocContent caches rendered html: a 2nd call does NOT refetch within TTL', async () => {
    const dav = await import('./dav');
    const first = (await dav.getDoc('atlas/getting-started')) as DocMeta;
    const second = (await dav.getDoc('atlas/getting-started')) as DocMeta;

    expect(first.html).toContain('Body here.');
    expect(second.html).toBe(first.html);
    expect(contentGets('getting-started.md')).toHaveLength(1);
  });

  it('loadDocContent falls back to Last-Modified when the spec has no updated', async () => {
    const dav = await import('./dav');
    const doc = (await dav.getDoc('atlas/getting-started')) as DocMeta;
    expect(doc.updated).toBe('Tue, 02 Jan 2024 00:00:00 GMT');
  });

  it('getDoc returns undefined for an unknown id', async () => {
    const dav = await import('./dav');
    expect(await dav.getDoc('atlas/nope')).toBeUndefined();
  });
});

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

// Root manifest: declares the product index + site gate. `missing-prod` is
// listed but has NO docs.yaml on the drive; `zeta` HAS a docs.yaml but is
// NOT listed here.
const SITE_YAML = `password: site-secret
copy:
  claude: false
  gemini: https://site-custom.test
  junk: 123
products:
  - atlas
  - missing-prod
  - scorekeeper
`;

const ATLAS_YAML = `title: Atlas Docs
description: Atlas product description
cover: https://x/cover.png
copy:
  claude: true
  gemini: https://atlas-custom.test
pages:
  - source: index.md
    title: Home
    category: Guide
    description: The index page
    updated: '2024-03-15'
  - source: getting-started.md
`;

// NOTE: no `copy:` — scorekeeper inherits the site.yaml default.
const SCOREKEEPER_YAML = `pages:
  - source: scoring.md
    title: Scoring
`;

// A drive product that is intentionally absent from site.yaml.products.
const ZETA_YAML = `pages:
  - source: about.md
`;

interface Call {
  url: string;
  method: string;
}

describe('dav loader', () => {
  let calls: Call[] = [];
  // When null, the site.yaml GET returns 404 (simulating a missing root manifest).
  let siteYaml: string | null = SITE_YAML;

  beforeEach(() => {
    calls = [];
    siteYaml = SITE_YAML;
    vi.resetModules();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});

    const fetchMock = vi.fn(async (input: unknown, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : String((input as URL).href ?? input);
      const method = (init?.method ?? 'GET').toUpperCase();
      calls.push({ url, method });

      if (url === `${BASE}site.yaml`) {
        return siteYaml === null
          ? new Response('not found', { status: 404 })
          : new Response(siteYaml, { status: 200 });
      }
      if (url === `${BASE}atlas/docs.yaml`) {
        return new Response(ATLAS_YAML, {
          status: 200,
          headers: { 'last-modified': 'Mon, 01 Jan 2024 00:00:00 GMT' },
        });
      }
      if (url === `${BASE}scorekeeper/docs.yaml`) {
        return new Response(SCOREKEEPER_YAML, { status: 200 });
      }
      if (url === `${BASE}zeta/docs.yaml`) {
        // Present ONLY so the "never served" assertion can prove it is
        // never fetched: a product not listed in site.yaml must not be
        // discovered at all.
        return new Response(ZETA_YAML, { status: 200 });
      }
      if (url === `${BASE}atlas/getting-started.md`) {
        return new Response('# Getting Started\n\nBody here.', {
          status: 200,
          headers: { 'last-modified': 'Tue, 02 Jan 2024 00:00:00 GMT' },
        });
      }
      if (url === `${BASE}atlas/index.md`) {
        return new Response('# Index', { status: 200 });
      }
      if (url === `${BASE}scorekeeper/scoring.md`) {
        return new Response('# Scoring', { status: 200 });
      }
      return new Response('not found', { status: 404 });
    });
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  const contentGets = (path: string) =>
    calls.filter((c) => c.method === 'GET' && c.url.endsWith(path));

  it('serves only site.yaml-listed products, in site.yaml order', async () => {
    const dav = await import('./dav');
    const docs = await dav.getDocs();

    // atlas first, then scorekeeper — order follows site.yaml.products.
    // missing-prod is skipped; zeta (never listed) is absent.
    expect(docs.map((d) => d.id)).toEqual([
      'atlas/index',
      'atlas/getting-started',
      'scorekeeper/scoring',
    ]);
    expect(docs.map((d) => d.product)).toEqual(['atlas', 'atlas', 'scorekeeper']);

    const meta = await dav.getProductsMeta();
    expect([...meta.keys()]).toEqual(['atlas', 'scorekeeper']);
  });

  it('reads the site password from site.yaml', async () => {
    const dav = await import('./dav');
    expect(await dav.getSitePassword()).toBe('site-secret');
  });

  it('resolves per-product copy config, docs.yaml overriding site.yaml', async () => {
    const dav = await import('./dav');
    const meta = await dav.getProductsMeta();

    // atlas overrides site defaults per key (claude re-enabled, gemini href).
    expect(meta.get('atlas')!.copy).toEqual({
      claude: true,
      gemini: 'https://atlas-custom.test',
    });

    // scorekeeper has no docs copy → inherits site.yaml; `junk: 123` (a
    // non-boolean, non-string value) is dropped.
    expect(meta.get('scorekeeper')!.copy).toEqual({
      claude: false,
      gemini: 'https://site-custom.test',
    });
  });

  it('builds metadata from manifests via metaFromSpec (title fallback, category default, passthrough)', async () => {
    const dav = await import('./dav');
    const docs = await dav.getDocs();

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

    const scoring = docs.find((d) => d.id === 'scorekeeper/scoring')!;
    expect(scoring.title).toBe('Scoring');
    expect(scoring.category).toBe('General');
  });

  it('index discovery is metadata-only: it never GETs page content', async () => {
    const dav = await import('./dav');
    await dav.getDocs();
    expect(contentGets('getting-started.md')).toHaveLength(0);
    expect(contentGets('index.md')).toHaveLength(0);
    expect(contentGets('scoring.md')).toHaveLength(0);
    expect(calls.filter((c) => c.method === 'GET' && c.url.includes('.md'))).toHaveLength(0);
  });

  it('skips a product listed in site.yaml whose docs.yaml is missing (with warn)', async () => {
    const dav = await import('./dav');
    const docs = await dav.getDocs();
    const meta = await dav.getProductsMeta();

    expect(docs.some((d) => d.product === 'missing-prod')).toBe(false);
    expect(meta.has('missing-prod')).toBe(false);
    // The skip was reported, not silent.
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('skipping product "missing-prod"'),
      expect.anything(),
    );
  });

  it('never serves a product NOT listed in site.yaml (not even fetched)', async () => {
    const dav = await import('./dav');
    const docs = await dav.getDocs();
    const meta = await dav.getProductsMeta();

    expect(docs.some((d) => d.product === 'zeta')).toBe(false);
    expect(meta.has('zeta')).toBe(false);
    // The drive has zeta/docs.yaml, but since zeta isn't declared it must
    // never be queried at all.
    expect(contentGets('zeta/docs.yaml')).toHaveLength(0);
  });

  it('serves no products and logs an error when site.yaml is missing', async () => {
    siteYaml = null;
    const dav = await import('./dav');
    const docs = await dav.getDocs();
    const meta = await dav.getProductsMeta();

    expect(docs).toEqual([]);
    expect(meta.size).toBe(0);
    expect(await dav.getSitePassword()).toBeUndefined();
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('site.yaml'),
      expect.anything(),
    );
  });

  it('getDoc lazily fetches AND renders only the requested page', async () => {
    const dav = await import('./dav');
    const doc = (await dav.getDoc('atlas/getting-started')) as DocMeta;

    expect(doc.html).toContain('<h1');
    expect(doc.html).toContain('Body here.');
    // Only this one source file was pulled from WebDAV.
    expect(contentGets('getting-started.md')).toHaveLength(1);
    expect(contentGets('index.md')).toHaveLength(0);
    expect(contentGets('scoring.md')).toHaveLength(0);
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

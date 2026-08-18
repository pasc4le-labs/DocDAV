import { describe, expect, it } from 'vitest';
import type { DocMeta } from './dav';
import { listProducts, sidebarFor } from './nav';

function doc(
  id: string,
  overrides: Partial<DocMeta> & { product: string } = {} as Partial<DocMeta> & { product: string },
): DocMeta {
  return {
    id,
    title: id.split('/').pop() ?? id,
    product: overrides.product,
    category: 'General',
    order: 0,
    path: `${id}.md`,
    ...overrides,
  };
}

describe('listProducts', () => {
  it('groups docs by product and sorts products by name', () => {
    const products = listProducts([
      doc('zebra/a', { product: 'zebra' }),
      doc('alpha/b', { product: 'alpha' }),
      doc('alpha/c', { product: 'alpha' }),
      doc('mid/x', { product: 'mid' }),
    ]);
    expect(products.map((p) => p.name)).toEqual(['alpha', 'mid', 'zebra']);
    expect(products[0].count).toBe(2);
    expect(products[1].count).toBe(1);
    expect(products[2].count).toBe(1);
  });

  it('humanizes the product name into a label and builds the href', () => {
    const products = listProducts([doc('my-product/a', { product: 'my-product' })]);
    expect(products[0].label).toBe('My Product');
    expect(products[0].href).toBe('/my-product');
  });

  it('pulls description and cover from the meta map', () => {
    const meta = new Map([
      ['alpha', { description: 'My docs', cover: 'https://x/c.png', password: 'pw' }],
    ]);
    const products = listProducts([doc('alpha/a', { product: 'alpha' })], meta);
    expect(products[0].description).toBe('My docs');
    expect(products[0].cover).toBe('https://x/c.png');
  });

  it('only passes a non-empty string cover through', () => {
    const meta = new Map([
      ['empty', { cover: '' }],
      ['none', { cover: undefined }],
    ]);
    const products = listProducts(
      [doc('empty/a', { product: 'empty' }), doc('none/b', { product: 'none' })],
      meta,
    );
    expect(products.find((p) => p.name === 'empty')?.cover).toBeUndefined();
    expect(products.find((p) => p.name === 'none')?.cover).toBeUndefined();
  });

  it('defaults description/cover to undefined when no meta exists', () => {
    const products = listProducts([doc('alpha/a', { product: 'alpha' })]);
    expect(products[0].description).toBeUndefined();
    expect(products[0].cover).toBeUndefined();
  });

  it('returns an empty array for no docs', () => {
    expect(listProducts([])).toEqual([]);
  });
});

describe('sidebarFor', () => {
  const docs = [
    doc('p/a', { product: 'p', category: 'Setup', order: 2, title: 'Zebra' }),
    doc('p/b', { product: 'p', category: 'Setup', order: 1, title: 'Alpha' }),
    doc('p/c', { product: 'p', category: 'Guide', order: 0, title: 'Intro' }),
    doc('other/d', { product: 'other', category: 'X', order: 0, title: 'Other' }),
  ];

  it('groups by category and orders categories by their minimum item order', () => {
    const sidebar = sidebarFor(docs, 'p');
    expect(sidebar.map((c) => c.name)).toEqual(['Guide', 'Setup']);
    expect(sidebar[0].order).toBe(0);
    expect(sidebar[1].order).toBe(1);
  });

  it('sorts items within a category by order then title', () => {
    const setup = sidebarFor(docs, 'p').find((c) => c.name === 'Setup')!;
    expect(setup.items.map((i) => i.title)).toEqual(['Alpha', 'Zebra']);
    expect(setup.items[0].order).toBe(1);
    expect(setup.items[1].order).toBe(2);
  });

  it('ignores docs from other products', () => {
    const sidebar = sidebarFor(docs, 'p');
    expect(sidebar.flatMap((c) => c.items).map((i) => i.id)).not.toContain('other/d');
  });

  it('ties category order with name as a tiebreaker', () => {
    const tidied = [
      doc('p/x', { product: 'p', category: 'Beta', order: 0 }),
      doc('p/y', { product: 'p', category: 'Alpha', order: 0 }),
    ];
    expect(sidebarFor(tidied, 'p').map((c) => c.name)).toEqual(['Alpha', 'Beta']);
  });

  it('returns an empty array when the product has no docs', () => {
    expect(sidebarFor(docs, 'missing')).toEqual([]);
  });
});

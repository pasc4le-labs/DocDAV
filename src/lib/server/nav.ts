import type { DocMeta, ProductMeta } from './dav';

/** Turn collection entries into nav/sidebar structures. Sidebar grouping and
 * ordering come from each page's manifest entry (`category`, list position);
 * `product` comes from the top-level directory. */

export interface SidebarItem {
  id: string;
  title: string;
  order: number;
}
export interface SidebarCategory {
  name: string;
  order: number;
  items: SidebarItem[];
}
export interface ProductInfo {
  name: string;
  label: string;
  /** Link target for this product's landing page. */
  href: string;
  count: number;
  description?: string;
  cover?: string;
}

export function productLabel(name: string): string {
  return name
    .split(/[-_]/)
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(' ');
}

export function listProducts(
  docs: DocMeta[],
  meta: Map<string, ProductMeta> = new Map()
): ProductInfo[] {
  const byProduct = new Map<string, DocMeta[]>();
  for (const d of docs) {
    const arr = byProduct.get(d.product) ?? [];
    arr.push(d);
    byProduct.set(d.product, arr);
  }
  return [...byProduct.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([name, items]) => {
      const m = meta.get(name) ?? {};
      return {
        name,
        label: productLabel(name),
        href: `/${name}`,
        count: items.length,
        description: m.description,
        cover: typeof m.cover === 'string' && m.cover ? m.cover : undefined,
      };
    });
}

export function sidebarFor(docs: DocMeta[], product: string): SidebarCategory[] {
  const byCat = new Map<string, SidebarItem[]>();
  for (const d of docs.filter((x) => x.product === product)) {
    const arr = byCat.get(d.category) ?? [];
    arr.push({ id: d.id, title: d.title, order: d.order });
    byCat.set(d.category, arr);
  }
  return [...byCat.entries()]
    .map(([name, items]) => {
      items.sort((a, b) => a.order - b.order || a.title.localeCompare(b.title));
      const minOrder = items.reduce((m, x) => Math.min(m, x.order), Number.MAX_SAFE_INTEGER);
      return { name, order: minOrder, items };
    })
    .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
}

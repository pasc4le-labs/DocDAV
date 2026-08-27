import { error } from '@sveltejs/kit';
import { getDocs, getProductsMeta } from '$lib/server/dav';
import { sidebarFor } from '$lib/server/nav';
import { humanize } from '$lib/server/text';

export async function load({ params }) {
  const product = params.product as string;
  const docs = await getDocs();
  const sidebar = sidebarFor(docs, product);
  if (sidebar.length === 0) {
    throw error(404, 'Unknown product');
  }
  // Effective "Ask <provider>" copy config for this product (site default
  // from site.yaml, overridden per-key by this product's docs.yaml).
  const meta = await getProductsMeta();
  const copy = meta.get(product)?.copy ?? {};
  return { product, label: humanize(product), sidebar, copy };
}

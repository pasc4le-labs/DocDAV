import { error } from '@sveltejs/kit';
import { getDocs } from '$lib/server/dav';
import { sidebarFor, productLabel } from '$lib/server/nav';

export async function load({ params }) {
  const product = params.product as string;
  const docs = await getDocs();
  const sidebar = sidebarFor(docs, product);
  if (sidebar.length === 0) {
    throw error(404, 'Unknown product');
  }
  return { product, label: productLabel(product), sidebar };
}

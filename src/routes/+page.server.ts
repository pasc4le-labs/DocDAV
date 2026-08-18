import { getDocs, getProductsMeta } from '$lib/server/dav';
import { listProducts } from '$lib/server/nav';

export async function load() {
  const [docs, meta] = await Promise.all([getDocs(), getProductsMeta()]);
  return { products: listProducts(docs, meta) };
}

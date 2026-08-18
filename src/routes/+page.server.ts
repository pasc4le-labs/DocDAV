import { getDocs } from '$lib/server/dav';
import { listProducts } from '$lib/server/nav';

export async function load() {
  const docs = await getDocs();
  return { products: listProducts(docs) };
}

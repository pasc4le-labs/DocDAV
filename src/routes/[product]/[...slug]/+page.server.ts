import { error } from '@sveltejs/kit';
import { getDoc } from '$lib/server/dav';

export async function load({ params }) {
  const id = [params.product, params.slug].filter(Boolean).join('/');
  const doc = await getDoc(id);
  if (!doc) {
    throw error(404, 'Not found');
  }
  return { doc };
}

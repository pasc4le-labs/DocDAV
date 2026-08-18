import type { SidebarCategory } from '$lib/server/nav';

export async function load({ parent }) {
  const parentData = await parent();
  return { label: parentData.label as string, sidebar: parentData.sidebar as SidebarCategory[] };
}

<script lang="ts">
import { page } from '$app/state';
import type { SidebarCategory } from '$lib/server/nav';
import { closeSidebar, ui } from '$lib/ui.svelte';

let { data, children } = $props();
const activeId = $derived(page.params.slug ? `${data.product}/${page.params.slug}` : undefined);
const sidebar = $derived(data.sidebar as SidebarCategory[]);
</script>

<div class="shell" class:collapsed={ui.sidebarCollapsed}>
  <aside class="sidebar" class:open={ui.sidebarOpen}>
    {#each sidebar as cat (cat.name)}
      <div class="cat">
        <div class="cat-name">{cat.name}</div>
        {#each cat.items as item (item.id)}
          <a
            href="/{item.id}"
            class:active={item.id === activeId}
            onclick={closeSidebar}
          ><span class="link-text">{item.title}</span></a>
        {/each}
      </div>
    {/each}
  </aside>

  <div
    class="backdrop"
    class:show={ui.sidebarOpen}
    role="presentation"
    onclick={closeSidebar}
  ></div>

  <main class="content">
    {@render children()}
  </main>
</div>

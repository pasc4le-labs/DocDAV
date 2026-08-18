<script lang="ts">
  import { page } from '$app/state';
  import { ui, closeSidebar } from '$lib/ui.svelte';
  import type { SidebarCategory } from '$lib/server/nav';

  let { data, children } = $props();
  const activeId = $derived(
    page.params.slug ? `${data.product}/${page.params.slug}` : undefined
  );
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
          >{item.title}</a>
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

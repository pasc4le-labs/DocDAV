<script lang="ts">
  import type { SidebarCategory } from '$lib/server/nav';
  let { data } = $props();
  const label = $derived(data.label as string);
  const sidebar = $derived(data.sidebar as SidebarCategory[]);
</script>

<h1>{label}</h1>

{#if sidebar.length === 0}
  <p>No documentation found for this product yet.</p>
{:else}
  {#each sidebar as cat (cat.name)}
    <section>
      <h2>{cat.name}</h2>
      <ul>
        {#each cat.items as item (item.id)}
          <li><a href="/{item.id}">{item.title}</a></li>
        {/each}
      </ul>
    </section>
  {/each}
{/if}

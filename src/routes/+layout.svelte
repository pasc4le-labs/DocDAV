<script lang="ts">
import { page } from '$app/state';
import 'highlight.js/styles/github-dark.css';
import 'remixicon/fonts/remixicon.css';
import './styles.css';
import { toggleSidebar } from '$lib/ui.svelte';

let { data, children } = $props();
const onProduct = $derived(!!page.params.product);
const initial = $derived(data.brand.name.charAt(0).toUpperCase());
// Product display name for the navbar (e.g. folder "atlas" -> "Atlas").
const productName = $derived(
  page.params.product
    ? String(page.params.product)
        .split(/[-_]/)
        .filter(Boolean)
        .map((w) => w[0].toUpperCase() + w.slice(1))
        .join(' ')
    : '',
);
</script>

<div class="app">
  <header class="topbar">
    {#if onProduct}
      <button
        class="sidebar-toggle"
        type="button"
        aria-label="Toggle sidebar"
        title="Toggle sidebar"
        onclick={toggleSidebar}
      >
        <i class="ri-menu-2-line" style="font-size:18px;display:grid;place-items:center"></i>
      </button>
    {/if}

    <a class="brand" href="/" title="Home">
      {#if data.brand.logo}
        <img class="brand-logo" src={data.brand.logo} alt="" />
      {:else}
        <span class="brand-mark">{initial}</span>
      {/if}
      <span class="brand-name">{onProduct ? productName : data.brand.name}</span>
    </a>
  </header>

  <div class="app-main">
    {@render children()}
  </div>

  <footer class="footer">
    <div class="footer-inner">
      <span class="footer-left">
        {#if data.brand.logo}
          <img class="footer-logo" src={data.brand.logo} alt="" />
        {:else}
          <span class="brand-mark">{initial}</span>
        {/if}
        <span class="footer-name">{data.brand.name}</span>
      </span>
      <span class="footer-copy">Documentation, rendered live from your drive.</span>
      <span class="footer-year">© {new Date().getFullYear()}</span>
    </div>
  </footer>
</div>

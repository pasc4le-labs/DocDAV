<script lang="ts">
import type { ProductInfo } from '$lib/server/nav';

let { data } = $props();
const products = $derived(data.products as ProductInfo[]);

let query = $state('');

// Fuzzy subsequence matcher. Returns a score (higher = better match) or -1
// when the needle isn't a subsequence of the haystack.
function fuzzy(needle: string, haystack: string): number {
  const n = needle.toLowerCase();
  const h = haystack.toLowerCase();
  if (n === '') return 1;
  // Exact substring is always the best possible match.
  const exact = h.indexOf(n);
  if (exact !== -1) return 1000 - exact;
  // Otherwise require every char in order (subsequence) and reward runs.
  let score = 0;
  let prev = -1;
  for (let i = 0; i < n.length; i++) {
    const idx = h.indexOf(n[i], prev + 1);
    if (idx === -1) return -1;
    score += idx === prev + 1 ? 3 : 1;
    prev = idx;
  }
  return score;
}

const results = $derived.by(() => {
  const q = query.trim();
  if (!q) return products;
  return products
    .map((p) => {
      const s = Math.max(
        fuzzy(q, p.label),
        fuzzy(q, p.name),
        p.description ? fuzzy(q, p.description) : -1,
      );
      return { p, s };
    })
    .filter((x) => x.s >= 0)
    .sort((a, b) => b.s - a.s)
    .map((x) => x.p);
});
</script>

<div class="landing">
  <h1>Documentation</h1>
  <p class="tagline">Helpful guides and references for all of our products.</p>

  <div class="search">
    <i class="ri-search-line" aria-hidden="true"></i>
    <input
      type="search"
      placeholder="Search projects…"
      bind:value={query}
      aria-label="Search projects"
    />
    {#if query}
      <button
        class="search-clear"
        type="button"
        aria-label="Clear search"
        onclick={() => (query = '')}
      >
        <i class="ri-close-line" aria-hidden="true"></i>
      </button>
    {/if}
  </div>

  {#if results.length === 0}
    <p class="no-results">No projects match “{query}”.</p>
  {:else}
    <p class="result-count">
      {results.length} project{results.length === 1 ? '' : 's'}
    </p>
    <div class="cards">
      {#each results as p (p.name)}
        <a class="card" href={p.href}>
          {#if p.cover}
            <div class="cover-wrap">
              <img class="cover" src={p.cover} alt="" loading="lazy" />
            </div>
          {/if}
          <div class="card-body">
            <div class="card-top">
              <div class="name">{p.label}</div>
              <div class="n">{p.count}</div>
            </div>
            {#if p.description}
              <div class="desc">{p.description}</div>
            {/if}
            <div class="learn">Browse docs <i class="ri-arrow-right-line" aria-hidden="true"></i></div>
          </div>
        </a>
      {/each}
    </div>
  {/if}
</div>

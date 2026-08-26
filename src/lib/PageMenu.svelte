<script lang="ts">
import { onMount } from 'svelte';
import { page } from '$app/state';

// Visible only on a rendered doc page (has a slug). Puts a "Copy page"
// action + "Ask Claude / Ask ChatGPT" redirects in the topbar, one dropdown.
const isDoc = $derived(!!page.params.slug);
let open = $state(false);
let copied = $state(false);

// The whole page as plain text (title + rendered article body).
function pageText(): string {
  const article = document.querySelector('article');
  const body = article?.innerText?.trim() ?? '';
  const title = document.title.trim();
  if (!body) return title;
  return title ? `${title}\n\n${body}` : body;
}

let copyTimer: number | undefined;
async function copyPage() {
  try {
    await navigator.clipboard.writeText(pageText());
    copied = true;
    if (copyTimer) window.clearTimeout(copyTimer);
    copyTimer = window.setTimeout(() => (copied = false), 1600);
  } catch {
    copied = false;
  }
}

// Redirect to a new chat with the page content as the initial prompt.
function ask(baseUrl: string) {
  const q = encodeURIComponent(pageText());
  window.open(`${baseUrl}${q}`, '_blank', 'noopener');
  open = false;
}

function onDocClick(e: MouseEvent) {
  if (!(e.target as HTMLElement).closest('.page-menu')) open = false;
}
onMount(() => {
  document.addEventListener('click', onDocClick);
  return () => document.removeEventListener('click', onDocClick);
});
</script>

{#if isDoc}
  <div class="page-menu" class:open>
    <button
      type="button"
      class="page-menu-btn"
      aria-haspopup="menu"
      aria-expanded={open}
      title="Page actions"
      onclick={(e) => {
        e.stopPropagation();
        open = !open;
      }}
    >
      <i class="ri-file-copy-line"></i>
      Copy
    </button>
    <div class="page-menu-pop" role="menu">
      <button type="button" class:copied={copied} onclick={copyPage}>
        <i class="ri-file-copy-line"></i>
        <span class="pm-label">{copied ? 'Copied!' : 'Copy page'}</span>
        <span class="pm-sub">Whole page as plain text</span>
      </button>
      <button type="button" onclick={() => ask('https://claude.ai/new?q=')}>
        <i class="ri-sparkling-line"></i>
        <span class="pm-label">Ask Claude</span>
        <span class="pm-sub">New chat with this page</span>
      </button>
      <button type="button" onclick={() => ask('https://chatgpt.com?prompt=')}>
        <i class="ri-openai-fill"></i>
        <span class="pm-label">Ask ChatGPT</span>
        <span class="pm-sub">New chat with this page</span>
      </button>
    </div>
  </div>
{/if}
<script lang="ts">
import { onMount } from 'svelte';
import { page } from '$app/state';

// Page actions dropdown, rendered next to the current doc heading:
// copies the current page's text to the clipboard, or opens a new chat
// with that text in one of several AI assistants.
interface Provider {
  slug: string;
  label: string;
  icon: string;
  /** Base URL that prefills a new-chat prompt. `pageText()` is appended. */
  url: string;
}
const providers: Provider[] = [
  { slug: 'claude', label: 'Claude', icon: 'ri-sparkling-line', url: 'https://claude.ai/new?q=' },
  { slug: 'chatgpt', label: 'ChatGPT', icon: 'ri-openai-fill', url: 'https://chatgpt.com?prompt=' },
  {
    slug: 'gemini',
    label: 'Gemini',
    icon: 'ri-google-fill',
    url: 'https://gemini.google.com/app?q=',
  },
  {
    slug: 'perplexity',
    label: 'Perplexity',
    icon: 'ri-earth-line',
    url: 'https://www.perplexity.ai/search?q=',
  },
];

let open = $state(false);
let copied = $state(false);

// Optional per-provider fixed href overrides (from the AI_OVERRIDES env, keyed
// by provider slug). When set, the item becomes a plain link to that URL.
const aiOverrides = $derived(
  (page.data as { aiOverrides?: Record<string, string> }).aiOverrides ?? {},
);

// The CURRENT page as plain text — the doc's own <h1> plus its rendered
// body. Scoped to .content so the sidebar/index/nav never leaks in.
function pageText(): string {
  const article = document.querySelector<HTMLElement>('.content article');
  const body = article?.innerText?.trim() ?? '';
  const h1 = document.querySelector<HTMLElement>('.content h1')?.textContent?.trim() ?? '';
  return [h1, body].filter(Boolean).join('\n\n');
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
    <div class="page-menu-divider" role="separator"></div>
    {#each providers as p (p.slug)}
      {@const overrideHref = aiOverrides[p.slug]}
      {#if overrideHref}
        <a
          class="pm-item"
          href={overrideHref}
          target="_blank"
          rel="noopener"
          onclick={() => (open = false)}
        >
          <i class={p.icon}></i>
          <span class="pm-label">Ask {p.label}</span>
          <span class="pm-sub">Configured link</span>
        </a>
      {:else}
        <button type="button" onclick={() => ask(p.url)}>
          <i class={p.icon}></i>
          <span class="pm-label">Ask {p.label}</span>
          <span class="pm-sub">New chat with this page</span>
        </button>
      {/if}
    {/each}
  </div>
</div>
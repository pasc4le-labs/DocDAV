<script lang="ts">
  import { onMount } from 'svelte';
  import type { DocMeta } from '$lib/server/dav';

  let { data } = $props();
  const doc = $derived(data.doc as DocMeta);

  function escapeHtml(s: string): string {
    return s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // Client-side toolbar on every rendered code block: Copy, and a ⋯ menu with
  // "Copy as Markdown" and "Open in new tab" (a standalone prompt page).
  onMount(() => {
    let copyTimer: number | null = null;

    const flash = (btn: HTMLElement, msg: string) => {
      const orig = btn.innerHTML;
      btn.innerHTML = `<i class="ri-check-line"></i> ${msg}`;
      btn.classList.add('copied');
      if (copyTimer) window.clearTimeout(copyTimer);
      copyTimer = window.setTimeout(() => {
        btn.innerHTML = orig;
        btn.classList.remove('copied');
      }, 1400);
    };

    async function copyText(text: string, btn: HTMLElement) {
      try {
        await navigator.clipboard.writeText(text);
        flash(btn, 'Copied!');
      } catch {
        btn.innerHTML = '<i class="ri-close-line"></i> Error';
      }
    }

    function openStandalone(text: string, lang: string) {
      const safe = escapeHtml(text.replace(/\n$/, ''));
      const html = [
        '<!doctype html><html><head><meta charset="utf-8">',
        '<meta name="viewport" content="width=device-width, initial-scale=1">',
        `<title>${escapeHtml(lang || 'snippet')} — snippet</title>`,
        '<style>',
        '  html,body{margin:0}',
        '  body{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;',
        '    background:#0d1117;color:#e6edf3;line-height:1.6;}',
        '  .wrap{max-width:960px;margin:0 auto;padding:32px 24px;}',
        '  .bar{display:flex;justify-content:space-between;align-items:center;',
        '    margin-bottom:16px;font-size:12px;color:#8b949e;',
        '    font-family:ui-sans-serif,system-ui,sans-serif;}',
        '  pre{margin:0;background:#161b22;border:1px solid #30363d;',
        '    border-radius:8px;padding:18px;white-space:pre;overflow:auto;}',
        '  code{white-space:pre;font-size:13px;}',
        '</style></head><body><div class="wrap">',
        '<div class="bar"><span>Copy this prompt where you need it</span>',
        `<span>${escapeHtml(lang || 'text')}</span></div>`,
        `<pre><code>${safe}</code></pre>`,
        '</div></body></html>',
      ].join('');
      const url = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
      window.open(url, '_blank', 'noopener');
      window.setTimeout(() => URL.revokeObjectURL(url), 60000);
    }

    const closeAllMenus = () =>
      document.querySelectorAll('.code-menu.open').forEach((m) => m.classList.remove('open'));

    const wire = () => {
      document.querySelectorAll('pre.hljs').forEach((pre) => {
        if (pre.querySelector(':scope > .code-toolbar')) return;
        const code = pre.querySelector('code');
        const text = code?.textContent ?? '';
        const lang = (code?.className.match(/language-([\w-]+)/)?.[1]) || 'text';

        const toolbar = document.createElement('div');
        toolbar.className = 'code-toolbar';

        const copyBtn = document.createElement('button');
        copyBtn.type = 'button';
        copyBtn.className = 'copy-btn';
        copyBtn.innerHTML = '<i class="ri-file-copy-line"></i> Copy';
        copyBtn.addEventListener('click', () => copyText(text, copyBtn));

        const menuWrap = document.createElement('div');
        menuWrap.className = 'code-menu';
        const menuBtn = document.createElement('button');
        menuBtn.type = 'button';
        menuBtn.className = 'menu-btn';
        menuBtn.setAttribute('aria-label', 'More actions');
        menuBtn.setAttribute('aria-haspopup', 'menu');
        menuBtn.innerHTML = '<i class="ri-more-2-fill"></i>';
        menuBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          closeAllMenus();
          menuWrap.classList.toggle('open');
        });

        const menu = document.createElement('div');
        menu.className = 'menu';
        menu.innerHTML = [
          `<button type="button" data-act="open"><i class="ri-external-link-line"></i> Open in new tab</button>`,
          `<button type="button" data-act="copy-md"><i class="ri-file-code-line"></i> Copy as Markdown</button>`,
          `<button type="button" data-act="copy"><i class="ri-file-copy-line"></i> Copy code</button>`,
        ].join('');
        menu.addEventListener('click', (e) => {
          const btn = (e.target as HTMLElement).closest('button[data-act]') as HTMLElement | null;
          const act = btn?.getAttribute('data-act');
          if (act === 'open') {
            openStandalone(text, lang);
          } else if (act === 'copy-md') {
            copyText('```' + lang + '\n' + text.replace(/\n$/, '') + '\n```', btn!);
          } else if (act === 'copy') {
            copyText(text, btn!);
          } else if (btn) {
            e.stopPropagation();
            return;
          }
          menuWrap.classList.remove('open');
        });

        menuWrap.appendChild(menuBtn);
        menuWrap.appendChild(menu);
        toolbar.appendChild(copyBtn);
        toolbar.appendChild(menuWrap);
        pre.appendChild(toolbar);
      });
    };

    wire();

    // Render Mermaid diagrams (only if the page has any). Lazy-loaded so the
    // heavy mermaid chunk is only fetched on pages that use it.
    const runMermaid = async () => {
      const nodes = Array.from(document.querySelectorAll('pre.mermaid'));
      if (nodes.length === 0) return;
      try {
        const { default: mermaid } = await import('mermaid');
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: 'strict',
          fontFamily: 'ui-sans-serif, system-ui, sans-serif',
        });
        for (const el of nodes) {
          const id = 'dm' + Math.random().toString(36).slice(2, 10);
          try {
            const { svg } = await mermaid.render(id, el.textContent || '');
            el.innerHTML = svg;
          } catch {
            const code = document.createElement('code');
            code.textContent = el.textContent || '';
            el.className = 'hljs';
            el.replaceChildren(code);
          }
        }
      } catch {
        /* mermaid failed to load — blocks stay as plain text */
      }
    };
    void runMermaid();

    document.addEventListener('click', closeAllMenus);
    return () => document.removeEventListener('click', closeAllMenus);
  });
</script>

<h1>{doc.title}</h1>
{#if doc.description}
  <p class="doc-meta">{doc.description}</p>
{/if}
{#if doc.updated}
  <p class="doc-meta">Updated: {doc.updated}</p>
{/if}

<article>
  {@html doc.html}
</article>

import type { Brand } from '$lib/config';

function productLabel(name: string): string {
  return name
    .split(/[-_]/)
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(' ');
}

const LOCK_SVG = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>`;

/** Modernized password gate (401) — standalone HTML, no emoji. */
export function gatePage(product: string, path: string, brand: Brand, site = false): string {
  const display = site ? brand.name : productLabel(product);
  const heading = site ? 'Welcome back' : `${display} documentation`;
  const sub = site
    ? 'This site is protected. Enter the password to continue.'
    : `The ${display} docs are protected. Enter the password to continue.`;

  const brandHtml = brand.logo
    ? `<img class="brand-logo" src="${escapeAttr(brand.logo)}" alt=""/>`
    : `<span class="brand-name">${escapeHtml(brand.name)}</span>`;

  return `<!doctype html><html lang="en"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${escapeHtml(display)} · Protected</title>
<link rel="preconnect" href="https://fonts.googleapis.com"/>
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/>
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&family=Space+Grotesk:wght@600;700&display=swap" rel="stylesheet"/>
<style>
*{box-sizing:border-box}
body{margin:0;min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:1.5rem;background:#fafafa;color:#09090b;font-family:"Plus Jakarta Sans",ui-sans-serif,system-ui,sans-serif;-webkit-font-smoothing:antialiased}
.brand-top{display:flex;align-items:center;gap:.5rem;font-weight:700;font-size:.95rem;margin-bottom:1.6rem}
.brand-top .brand-logo{height:24px;max-width:150px;object-fit:contain}
.card{width:100%;max-width:340px;text-align:center}
.lock{width:46px;height:46px;margin:0 auto 1.1rem;border-radius:14px;background:#ececee;color:#18181b;display:grid;place-items:center}
h1{font-family:"Space Grotesk",sans-serif;font-size:1.3rem;font-weight:700;margin:0 0 .45rem;letter-spacing:-.01em}
.sub{color:#71717a;font-size:.9rem;line-height:1.5;margin:0 0 1.7rem}
form{display:flex;flex-direction:column;gap:.7rem}
input{padding:.72rem .9rem;border-radius:10px;border:1px solid #e4e4e7;background:#fff;color:#09090b;font-size:1rem;text-align:center;font-family:inherit;transition:border-color .12s,box-shadow .12s}
input::placeholder{color:#a1a1aa}
input:focus{outline:none;border-color:#18181b;box-shadow:0 0 0 4px rgba(24,24,27,.08)}
button{padding:.72rem;border-radius:10px;border:0;background:#18181b;color:#fafafa;font-weight:600;font-size:.95rem;cursor:pointer;font-family:inherit;transition:background .12s}
button:hover{background:#27272a}
.hint{font-size:.78rem;color:#a1a1aa;margin-top:1.4rem;display:flex;align-items:center;justify-content:center;gap:.35rem}
.hint code{font-family:ui-monospace,monospace;font-size:.74rem;background:#f4f4f5;padding:.1rem .35rem;border-radius:5px}
</style></head><body>
<div class="brand-top">${brandHtml}</div>
<div class="card">
<div class="lock">${LOCK_SVG}</div>
<h1>${escapeHtml(heading)}</h1>
<p class="sub">${escapeHtml(sub)}</p>
<form method="get" action="${escapeAttr(path)}">
<input type="password" name="key" placeholder="Password" autocomplete="current-password" autofocus/>
<button type="submit">Unlock</button>
</form>
<div class="hint">or open a link with <code>?key=…</code></div>
</div>
</body></html>`;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!
  );
}
function escapeAttr(s: string): string {
  return escapeHtml(s);
}

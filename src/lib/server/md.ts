import hljs from 'highlight.js/lib/common';
import { marked } from 'marked';
import { escapeHtml } from './text';

/** Remote dir (relative to the WebDAV root) of the doc being rendered, used to
 * resolve relative image hrefs to `/assets/...`. Set per renderMd call — the
 * marked renderer reads it synchronously while parsing. */
let imgBaseDir = '';

/**
 * Markdown → HTML renderer for drive-docs.
 *
 * Wraps `marked` with a small block preprocessor that adds the user-facing
 * components authors use in their docs. Because this is a *docs platform*,
 * the syntax is kept friendly and predictable:
 *
 *   Callouts   – GitHub-style alert blockquotes:
 *                  > [!NOTE]        (note | tip | important | warning | caution)
 *                  > Some body text — full Markdown, multi-paragraph OK
 *                  > [!TIP] Custom title
 *                  > ...
 *   Banners    – the same blockquote, type [!BANNER]: larger, high-emphasis
 *                  banner for announcements / version notices.
 *   Toggles    – collapsible sections:
 *                  :::toggle Can I self-host?
 *                  Body markdown here…
 *                  :::
 *   Procedures – just write a normal ordered list; it's styled server + client
 *                  as a numbered step list with badges.
 *
 * Implementation note: the preprocessor splits the source into alternating
 * "plain markdown" and "already-rendered component HTML" segments, renders
 * each plain segment through `marked` on its own, then joins. Rendering each
 * segment separately (rather than inlining raw HTML into the markdown) avoids
 * CommonMark's "HTML block ends at the first blank line" gotcha, which would
 * otherwise mangle multi-paragraph callouts and toggles.
 */

export interface CalloutSpec {
  title: string;
  icon: string;
  tone: string;
}

const CALLOUT_TYPES: Record<string, CalloutSpec> = {
  note: { title: 'Note', icon: 'ri-information-line', tone: 'note' },
  tip: { title: 'Tip', icon: 'ri-lightbulb-line', tone: 'tip' },
  important: { title: 'Important', icon: 'ri-alarm-warning-line', tone: 'important' },
  warning: { title: 'Warning', icon: 'ri-alert-line', tone: 'warning' },
  caution: { title: 'Caution', icon: 'ri-error-warning-line', tone: 'caution' },
  banner: { title: '', icon: 'ri-megaphone-line', tone: 'banner' },
};

// Configure marked once: highlight code server-side.
marked.use({
  renderer: {
    code({ text, lang }) {
      // Mermaid diagrams: emit a .mermaid block for the client renderer.
      if (lang === 'mermaid') {
        return `<pre class="mermaid">${escapeHtml(text.replace(/\n$/, ''))}</pre>`;
      }
      // Excalidraw: embed the scene interactively via excalidraw.com iframe.
      if (lang === 'excalidraw' || lang === 'excalidraw.json') {
        return renderExcalidraw(text);
      }
      const language = lang && hljs.getLanguage(lang) ? lang : 'plaintext';
      const value = hljs.highlight(text, { language }).value;
      const cls = lang ? `language-${lang}` : '';
      return `<pre class="hljs"><code class="${cls}">${value}</code></pre>`;
    },
    image({ href, title, text }) {
      // Relative image paths resolve against the source doc's remote dir and
      // are proxied from the WebDAV share (see /assets/[...path]). Absolute
      // URLs (/…, http…, data:, #anchors) pass through unchanged.
      const h = href ?? '';
      const src = /^(?:[a-z][a-z0-9+.-]*:|\/|#)/i.test(h)
        ? h
        : `/assets/${imgBaseDir ? imgBaseDir + '/' : ''}${h}`;
      let out = `<img src="${escapeHtml(src)}" alt="${escapeHtml(text ?? '')}"`;
      if (title) out += ` title="${escapeHtml(title)}"`;
      return out + '>';
    },
  },
});

/** Font-family map for Excalidraw text elements. */
const FONTS: Record<number, string> = {
  1: "'Kalam','Comic Sans MS',cursive",
  2: "'Helvetica','Arial',sans-serif",
  3: "'JetBrains Mono',Menlo,Consolas,monospace",
};

/** Render an Excalidraw fenced block to a self-contained inline SVG. Accepts a
 * full `.excalidraw` scene object or a bare `elements` array. Covers the
 * standard types (rectangle, ellipse, diamond, arrow, line, text) — enough for
 * the flow/arch/seq diagrams a docs author typically drops in. */
function renderExcalidraw(raw: string): string {
  let elements: any[];
  try {
    const parsed = JSON.parse(raw);
    elements = Array.isArray(parsed)
      ? parsed
      : ((parsed as { elements?: unknown[] })?.elements ?? []);
  } catch {
    return `<pre class="hljs"><code>${escapeHtml(raw)}</code></pre>`;
  }
  if (!Array.isArray(elements) || elements.length === 0) {
    return `<pre class="hljs"><code>${escapeHtml(raw)}</code></pre>`;
  }

  const byId = new Map<string, any>(elements.map((e) => [String(e.id), e] as const));
  const pad = 30;
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (const e of elements) {
    const x = Number(e.x) || 0,
      y = Number(e.y) || 0,
      w = Number(e.width) || 0,
      h = Number(e.height) || 0;
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x + w > maxX) maxX = x + w;
    if (y + h > maxY) maxY = y + h;
  }
  if (!Number.isFinite(minX)) {
    minX = minY = 0;
    maxX = maxY = 10;
  }

  const parts: string[] = [];
  for (const e of elements) {
    const x = Number(e.x) || 0,
      y = Number(e.y) || 0,
      w = Number(e.width) || 0,
      h = Number(e.height) || 0;
    const stroke = typeof e.strokeColor === 'string' ? e.strokeColor : '#1e1e1e';
    const fill =
      typeof e.backgroundColor === 'string' && e.backgroundColor !== 'transparent'
        ? e.backgroundColor
        : 'none';
    const sw = Number(e.strokeWidth) || 2;
    const dash =
      e.strokeStyle === 'dashed'
        ? ' stroke-dasharray="7 5"'
        : e.strokeStyle === 'dotted'
          ? ' stroke-dasharray="1.5 4" stroke-linecap="round"'
          : '';
    const opacity = (Number(e.opacity) ?? 100) / 100;
    const common = `stroke="${stroke}" stroke-width="${sw}" fill="${fill}"${dash} opacity="${opacity}"`;

    switch (e.type) {
      case 'rectangle': {
        const rx = e.roundness && e.roundness.type === 3 ? Math.min(w, h) * 0.15 : 0;
        parts.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" ${common}/>`);
        break;
      }
      case 'ellipse':
        parts.push(
          `<ellipse cx="${x + w / 2}" cy="${y + h / 2}" rx="${w / 2}" ry="${h / 2}" ${common}/>`,
        );
        break;
      case 'diamond': {
        const cx = x + w / 2,
          cy = y + h / 2;
        parts.push(
          `<polygon points="${cx},${y} ${x + w},${cy} ${cx},${y + h} ${x},${cy}" ${common}/>`,
        );
        break;
      }
      case 'line':
      case 'arrow': {
        const pts = (Array.isArray(e.points) ? e.points : [[0, 0]]).map((p: unknown) => {
          const arr = p as [number, number];
          return [x + (Number(arr?.[0]) || 0), y + (Number(arr?.[1]) || 0)];
        });
        parts.push(`<polyline points="${pts.map((p) => `${p[0]},${p[1]}`).join(' ')}" ${common}/>`);
        if (e.type === 'arrow' && e.endArrowhead !== null && pts.length >= 2) {
          const n = pts.length;
          const last = pts[n - 1],
            prev = pts[n - 2];
          const ang = Math.atan2(last[1] - prev[1], last[0] - prev[0]);
          const L = 12;
          const a1 = ang + (Math.PI * 5) / 6,
            a2 = ang - (Math.PI * 5) / 6;
          const p1 = [last[0] + L * Math.cos(a1), last[1] + L * Math.sin(a1)];
          const p2 = [last[0] + L * Math.cos(a2), last[1] + L * Math.sin(a2)];
          parts.push(
            `<polygon points="${last[0]},${last[1]} ${p1[0]},${p1[1]} ${p2[0]},${p2[1]}" fill="${stroke}"/>`,
          );
        }
        break;
      }
      case 'text': {
        const fs = Number(e.fontSize) || 20;
        const family = FONTS[Number(e.fontFamily)] || FONTS[2];
        const container = e.containerId ? byId.get(String(e.containerId)) : null;
        let tx: number, ty: number, anchor: string;
        if (container) {
          tx = container.x + container.width / 2;
          ty = container.y + container.height / 2;
          anchor = 'middle';
        } else {
          anchor = e.textAlign === 'left' ? 'start' : e.textAlign === 'right' ? 'end' : 'middle';
          tx = anchor === 'start' ? x : anchor === 'end' ? x + w : x + w / 2;
          ty = y + fs * 0.4;
        }
        parts.push(
          `<text x="${tx}" y="${ty}" font-family="${family}" font-size="${fs}" fill="${stroke}" text-anchor="${anchor}" dominant-baseline="central">${escapeHtml(String(e.text ?? ''))}</text>`,
        );
        break;
      }
    }
  }

  const viewX = Math.round(minX - pad);
  const viewY = Math.round(minY - pad);
  const viewW = Math.round(maxX - minX + pad * 2);
  const viewH = Math.round(maxY - minY + pad * 2);
  return `<div class="excalidraw-svg"><svg viewBox="${viewX} ${viewY} ${viewW} ${viewH}" role="img" aria-label="Excalidraw diagram" xmlns="http://www.w3.org/2000/svg">${parts.join('')}</svg></div>`;
}

type Segment = { kind: 'md'; value: string } | { kind: 'html'; value: string };

const FENCE_OPEN = /^\s*(`{3,}|~{3,})/;
const TOGGLE_OPEN = /^:::\s*toggle\b(.*)$/;
const TOGGLE_CLOSE = /^:::\s*$/;
const BLOCKQUOTE = /^>\s?/;
const CALLOUT_FIRST = /^\[!(\w+)\](?:\s*(.*))?$/;

/** Split a Markdown source into plain-markdown vs already-rendered-HTML segments. */
function scan(src: string, baseDir: string): Segment[] {
  const lines = src.split('\n');
  const segs: Segment[] = [];
  let buf: string[] = [];
  let i = 0;

  const flush = () => {
    if (buf.length > 0) {
      segs.push({ kind: 'md', value: buf.join('\n') });
      buf = [];
    }
  };

  while (i < lines.length) {
    const line = lines[i];

    // Fenced code block — copy through verbatim so nothing inside is processed.
    const fence = FENCE_OPEN.exec(line);
    if (fence) {
      const marker = fence[1];
      buf.push(line);
      i++;
      const close = new RegExp(`^\\s*${marker}`);
      while (i < lines.length && !close.test(lines[i])) {
        buf.push(lines[i]);
        i++;
      }
      if (i < lines.length) {
        buf.push(lines[i]);
        i++;
      }
      continue;
    }

    // Toggle:  :::toggle Title … :::
    const toggle = TOGGLE_OPEN.exec(line.trim());
    if (toggle) {
      const summary = toggle[1].trim() || 'Details';
      const inner: string[] = [];
      i++;
      while (i < lines.length && !TOGGLE_CLOSE.test(lines[i].trim())) {
        inner.push(lines[i]);
        i++;
      }
      i++; // consume the closing :::
      flush();
      segs.push({
        kind: 'html',
        value: `<details class="toggle"><summary><i class="ri-arrow-right-s-line toggle-chevron" aria-hidden="true"></i><span>${escapeHtml(summary)}</span></summary><div class="toggle-body">${renderMd(inner.join('\n'), { baseDir })}</div></details>`,
      });
      continue;
    }

    // Blockquote — might be a callout/banner.
    if (BLOCKQUOTE.test(line)) {
      const q: string[] = [];
      while (i < lines.length && BLOCKQUOTE.test(lines[i])) {
        q.push(lines[i]);
        i++;
      }
      const first = q[0].replace(BLOCKQUOTE, '').trim();
      const m = CALLOUT_FIRST.exec(first);
      const kind = m?.[1].toLowerCase() || '';
      const spec = CALLOUT_TYPES[kind];
      if (m && spec) {
        const customTitle = (m[2] || '').trim();
        const bodyMd = q
          .slice(1)
          .map((l) => l.replace(BLOCKQUOTE, ''))
          .join('\n');
        const body = renderMd(bodyMd, { baseDir });
        const title = escapeHtml(customTitle || spec.title);
        const icon = !customTitle || spec.tone === 'banner' ? spec.icon : '';
        const titleHtml =
          spec.tone === 'banner'
            ? `<div class="callout-title"><i class="${spec.icon}"></i><span>${title}</span></div>`
            : `<div class="callout-title">${icon ? `<i class="${icon}"></i>` : ''}<span>${title}</span></div>`;
        flush();
        segs.push({
          kind: 'html',
          value: `<aside class="callout callout-${spec.tone}">${titleHtml}<div class="callout-body">${body}</div></aside>`,
        });
        continue;
      }
      // Not a callout — treat as a normal blockquote.
      buf.push(...q);
      continue;
    }

    buf.push(line);
    i++;
  }
  flush();
  return segs;
}

/** Render a Markdown document (or block) to HTML, with components applied.
 * `opts.baseDir` is the source doc's directory relative to the WebDAV root,
 * used to resolve relative image references against the shared content. */
export function renderMd(src: string, opts?: { baseDir?: string }): string {
  imgBaseDir = opts?.baseDir ?? '';
  const out: string[] = [];
  for (const seg of scan(src, imgBaseDir)) {
    out.push(seg.kind === 'md' ? (marked.parse(seg.value) as string) : seg.value);
  }
  return out.join('\n');
}

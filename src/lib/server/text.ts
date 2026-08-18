/**
 * Tiny shared HTML/slug helpers used across the server.
 *
 * These were previously copy-pasted into several modules (format.ts, md.ts,
 * gate.ts, nav.ts, dav.ts). Consolidating them here removes the duplication
 * without pulling in a dependency for a few one-liners.
 */

/** Escape a string for safe inclusion in HTML text or (double-quoted) attributes. */
export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!
  );
}

/** Decode the HTML entities that appear in WebDAV PROPFIND `<href>` values. */
export function htmlDecode(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"');
}

/** Turn a slug/file-stem into a display label: "api-reference" → "Api Reference". */
export function humanize(name: string): string {
  return name
    .split(/[-_]/)
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(' ');
}

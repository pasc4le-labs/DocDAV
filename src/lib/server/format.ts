import { renderMd } from './md';
import sanitizeHtml from 'sanitize-html';
import mammoth from 'mammoth';
import * as XLSX from 'xlsx';
import { convert as asciidoctorConvert } from 'asciidoctor';
import { escapeHtml } from './text';

/**
 * Multi-format render dispatch for drive-docs.
 *
 * Given a content kind and its raw bytes/text, produces the HTML fragment that
 * is embedded into a doc page. Kept separate from `dav.ts` so discovery stays
 * format-agnostic and new formats are a one-file change.
 */

export type ContentKind =
  | 'md'
  | 'txt'
  | 'html'
  | 'adoc'
  | 'csv'
  | 'docx'
  | 'xlsx';

export interface ContentData {
  /** Raw text for text-based formats (`md/txt/html/adoc/csv`). */
  text?: string;
  /** Raw bytes for binary formats (`docx/xlsx`). */
  buffer?: ArrayBuffer;
}

const EXT_TO_KIND: Record<string, ContentKind> = {
  md: 'md',
  markdown: 'md',
  txt: 'txt',
  html: 'html',
  htm: 'html',
  adoc: 'adoc',
  asciidoc: 'adoc',
  csv: 'csv',
  docx: 'docx',
  xlsx: 'xlsx',
};

/** Map a filename/extension to a content kind, or null if unsupported. */
export function detectKind(path: string): ContentKind | null {
  const ext = path.split('.').pop()?.toLowerCase() ?? '';
  return EXT_TO_KIND[ext] ?? null;
}

export function isBinaryKind(kind: ContentKind): boolean {
  return kind === 'docx' || kind === 'xlsx';
}

/** Render a 2D array of string cells as a Markdown table (header = first row). */
function tableToMarkdown(rows: string[][]): string {
  if (rows.length === 0) return '_Empty table._';
  const header = rows[0];
  const body = rows.slice(1);
  const colCount = Math.max(header.length, ...body.map((r) => r.length));
  const pad = (cells: string[]) => {
    const arr = [...cells];
    while (arr.length < colCount) arr.push('');
    return arr;
  };
  const rowToMd = (cells: string[]) =>
    `| ${pad(cells)
      .map((c) => String(c).replace(/\|/g, '\\|').replace(/\r?\n/g, ' ').trim())
      .join(' | ')} |`;
  const sep = `| ${pad(header).map(() => '---').join(' | ')} |`;
  const lines = [rowToMd(header), sep, ...body.map((r) => rowToMd(r))];
  return lines.join('\n');
}

/** Render the first sheet of a workbook (CSV or XLSX) as a Markdown table.
 * SheetJS parses both formats, so the two tabular types share one code path.
 * Empty cells arrive as `undefined` (text-form CSV as empty strings) — normalize
 * to '' and drop all-blank rows, matching the previous CSV behavior. */
function sheetToMarkdown(wb: XLSX.WorkBook): string {
  const sheet = wb.Sheets[wb.SheetNames[0]];
  if (!sheet) return renderMd('_Empty workbook._');
  const rows = XLSX.utils
    .sheet_to_json<unknown[]>(sheet, { header: 1 })
    .map((r) => r.map((c) => (c == null ? '' : String(c))))
    .filter((r) => r.some((c) => c.trim() !== ''));
  return renderMd(tableToMarkdown(rows));
}

/** Render a document to an HTML fragment based on its content kind. */
export function renderBody(kind: ContentKind, data: ContentData): string {
  switch (kind) {
    case 'md':
      return renderMd(data.text ?? '');
    case 'txt': {
      // Escape, then wrap blank-line-separated paragraphs in <p>.
      const paras = (data.text ?? '')
        .split(/\n\s*\n/)
        .map((p) => p.trim())
        .filter(Boolean);
      return paras.map((p) => `<p>${escapeHtml(p).replace(/\n/g, '<br/>')}</p>`).join('\n');
    }
    case 'html':
      return sanitizeHtml(data.text ?? '', {
        allowedTags: sanitizeHtml.defaults.allowedTags.concat([
          'img', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'details', 'summary', 'iframe', 'pre',
        ]),
        allowedAttributes: {
          ...sanitizeHtml.defaults.allowedAttributes,
          img: ['src', 'alt', 'title', 'width', 'height'],
          iframe: ['src', 'width', 'height', 'title', 'allowfullscreen', 'loading'],
          a: ['href', 'name', 'target', 'rel'],
          h1: ['id'], h2: ['id'], h3: ['id'], h4: ['id'], h5: ['id'], h6: ['id'],
          table: ['border', 'cellpadding', 'cellspacing'],
        },
      });
    case 'csv': {
      // SheetJS parses RFC 4180 CSV (quoted fields, escaped quotes, CRLF).
      const wb = XLSX.read(data.text ?? '', { type: 'string' });
      return sheetToMarkdown(wb);
    }
    case 'xlsx': {
      const wb = XLSX.read(data.buffer ?? new ArrayBuffer(0), { type: 'array' });
      return sheetToMarkdown(wb);
    }
    default:
      return '';
  }
}

/** Async rendering (mammoth + asciidoctor are Promise-based). */
export async function renderBodyAsync(kind: ContentKind, data: ContentData): Promise<string> {
  if (kind === 'docx') {
    const { convertToHtml } = mammoth;
    const buffer = Buffer.from(data.buffer ?? new ArrayBuffer(0));
    const result = await convertToHtml({ buffer });
    return result.value;
  }
  if (kind === 'adoc') {
    return asciidoctorConvert(data.text ?? '', {
      header_footer: false,
      standalone: false,
    });
  }
  return renderBody(kind, data);
}

import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import { detectKind, isBinaryKind, renderBody, renderBodyAsync } from './format';

describe('detectKind', () => {
  it('maps known extensions to kinds', () => {
    expect(detectKind('a.md')).toBe('md');
    expect(detectKind('a.markdown')).toBe('md');
    expect(detectKind('a.txt')).toBe('txt');
    expect(detectKind('a.html')).toBe('html');
    expect(detectKind('a.htm')).toBe('html');
    expect(detectKind('a.adoc')).toBe('adoc');
    expect(detectKind('a.asciidoc')).toBe('adoc');
    expect(detectKind('a.csv')).toBe('csv');
    expect(detectKind('a.docx')).toBe('docx');
    expect(detectKind('a.xlsx')).toBe('xlsx');
  });

  it('is case-insensitive on the extension', () => {
    expect(detectKind('README.MD')).toBe('md');
    expect(detectKind('data.CSV')).toBe('csv');
    expect(detectKind('book.DOCX')).toBe('docx');
  });

  it('handles paths with directories', () => {
    expect(detectKind('atlas/guide/getting-started.md')).toBe('md');
  });

  it('returns null for unknown or missing extensions', () => {
    expect(detectKind('a.pdf')).toBeNull();
    expect(detectKind('a')).toBeNull();
    expect(detectKind('dir/file')).toBeNull();
    expect(detectKind('')).toBeNull();
  });
});

describe('isBinaryKind', () => {
  it('is true only for docx and xlsx', () => {
    expect(isBinaryKind('docx')).toBe(true);
    expect(isBinaryKind('xlsx')).toBe(true);
  });
  for (const kind of ['md', 'txt', 'html', 'adoc', 'csv'] as const) {
    it(`is false for ${kind}`, () => {
      expect(isBinaryKind(kind)).toBe(false);
    });
  }
});

describe('renderBody: md', () => {
  it('renders markdown to HTML', () => {
    const html = renderBody('md', { text: '# Heading\n\nSome *emphasis*.' });
    expect(html).toContain('<h1');
    expect(html).toContain('<em>emphasis</em>');
  });

  it('rewrites a relative image src through /assets/<baseDir>', () => {
    const html = renderBody(
      'md',
      { text: '![diagram](mock-diagram.svg "A diagram")' },
      { baseDir: 'atlas' },
    );
    expect(html).toContain('src="/assets/atlas/mock-diagram.svg"');
    expect(html).toContain('alt="diagram"');
    expect(html).toContain('title="A diagram"');
  });

  it('leaves absolute and external image srcs untouched', () => {
    const md = '![a](/images/x.png) ![b](https://ex.com/y.jpg) ![c](data:image/png;base64,AAA)';
    const html = renderBody('md', { text: md }, { baseDir: 'atlas' });
    expect(html).toContain('src="/images/x.png"');
    expect(html).toContain('src="https://ex.com/y.jpg"');
    expect(html).toContain('src="data:image/png;base64,AAA"');
    expect(html).not.toContain('/assets/atlas');
  });

  it('keeps baseDir for a relative image nested inside a callout', () => {
    const md = '> [!NOTE]\n> ![diagram](nested.png)';
    const html = renderBody('md', { text: md }, { baseDir: 'atlas' });
    expect(html).toContain('src="/assets/atlas/nested.png"');
  });
});

describe('renderBody: txt', () => {
  it('splits blank-line-separated text into <p> paragraphs', () => {
    const html = renderBody('txt', { text: 'first para\n\nsecond para' });
    expect(html).toBe('<p>first para</p>\n<p>second para</p>');
  });

  it('converts single newlines inside a paragraph to <br/>', () => {
    const html = renderBody('txt', { text: 'line1\nline2' });
    expect(html).toBe('<p>line1<br/>line2</p>');
  });

  it('HTML-escapes <, > and &', () => {
    const html = renderBody('txt', { text: 'a < b & c > d' });
    expect(html).toContain('a &lt; b &amp; c &gt; d');
  });

  it('returns an empty string for blank input', () => {
    expect(renderBody('txt', { text: '  \n\n ' })).toBe('');
  });
});

describe('renderBody: html (sanitize-html)', () => {
  it('strips <script>, event-handler attributes and javascript: URLs', () => {
    const html = renderBody('html', {
      text: '<script>alert(1)</script><p onclick="x()">ok</p><img src="/a.png" onerror="alert(2)"><a href="javascript:alert(3)">link</a>',
    });
    expect(html).not.toContain('<script');
    expect(html).not.toContain('alert');
    expect(html).not.toContain('onclick');
    expect(html).not.toContain('onerror');
    expect(html).not.toContain('javascript:');
    expect(html).toContain('<p>ok</p>');
  });

  it('keeps allowed block tags like <table>', () => {
    const html = renderBody('html', { text: '<table><tr><td>x</td></tr></table>' });
    expect(html).toContain('<table>');
    expect(html).toContain('<td>x</td>');
  });
});

describe('renderBody: csv (SheetJS)', () => {
  it('renders a basic CSV as a markdown/HTML table', () => {
    const html = renderBody('csv', { text: 'a,b\n1,2' });
    expect(html).toContain('<table');
    expect(html).toContain('>a<');
    expect(html).toContain('>b<');
    expect(html).toContain('>1<');
    expect(html).toContain('>2<');
  });

  it('keeps a quoted field containing a comma intact', () => {
    const html = renderBody('csv', { text: '"hello, world",b\n1,2' });
    expect(html).toContain('hello, world');
  });

  it('un-escapes a doubled quote inside a quoted field', () => {
    const html = renderBody('csv', { text: '"say ""hi""",b' });
    // SheetJS collapses the doubled quote to a single one; marked re-encodes it.
    expect(html).toContain('say &quot;hi&quot;');
    expect(html).not.toContain('say &quot;&quot;hi&quot;&quot;');
  });

  it('handles CRLF line endings', () => {
    const html = renderBody('csv', { text: 'a,b\r\n1,2\r\n3,4' });
    expect(html).toContain('>1<');
    expect(html).toContain('>3<');
  });

  it('drops all-blank rows', () => {
    const html = renderBody('csv', { text: 'a,b\n\n\n1,2' });
    expect(html).not.toMatch(/<tr><td[^>]*><\/td>/);
    expect(html).toContain('>1<');
  });

  it('renders a placeholder for an empty table', () => {
    const html = renderBody('csv', { text: '' });
    expect(html).toContain('Empty table');
  });

  it('renders a placeholder when the CSV is only blank lines', () => {
    const html = renderBody('csv', { text: '\n\n\n' });
    expect(html).toContain('Empty table');
  });

  it('treats a header-only CSV as a header row with no body', () => {
    const html = renderBody('csv', { text: 'name,qty' });
    expect(html).toContain('>name<');
    expect(html).toContain('>qty<');
  });
});

describe('renderBody: xlsx', () => {
  it('renders the first sheet as a markdown/HTML table', () => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.aoa_to_sheet([
        ['Name', 'Qty'],
        ['Apples', 3],
        ['Oranges', 7],
      ]),
      'Sheet1',
    );
    const buffer = XLSX.write(wb, { type: 'array' }) as ArrayBuffer;
    const html = renderBody('xlsx', { buffer });
    expect(html).toContain('<table');
    expect(html).toContain('>Apples<');
    expect(html).toContain('>Oranges<');
  });

  it('renders a placeholder for an empty workbook', () => {
    const html = renderBody('xlsx', { buffer: new ArrayBuffer(0) });
    expect(html).toContain('Empty');
  });
});

describe('renderBodyAsync', () => {
  it('renders AsciiDoc to HTML', async () => {
    const html = await renderBodyAsync('adoc', { text: '== Section\n\nHello asciidoc.' });
    expect(html).toContain('<h2');
    expect(html).toContain('Hello asciidoc.');
  });

  it('renders a .docx buffer to HTML via mammoth', async () => {
    const zip = new JSZip();
    zip.file(
      '[Content_Types].xml',
      `<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`,
    );
    zip.file(
      '_rels/.rels',
      `<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`,
    );
    zip.file(
      'word/document.xml',
      `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Hello docx world</w:t></w:r></w:p></w:body></w:document>`,
    );
    const buffer = (await zip.generateAsync({ type: 'arraybuffer' })) as ArrayBuffer;
    const html = await renderBodyAsync('docx', { buffer });
    expect(html).toContain('Hello docx world');
  });

  it('delegates non-binary kinds to renderBody', async () => {
    const html = await renderBodyAsync('md', { text: '# Sync' });
    expect(html).toContain('<h1');
  });
});

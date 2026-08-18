import { describe, expect, it } from 'vitest';
import { escapeHtml, htmlDecode, humanize } from './text';

describe('escapeHtml', () => {
  it('leaves plain text untouched', () => {
    expect(escapeHtml('hello world')).toBe('hello world');
  });

  it('escapes all five HTML-sensitive characters', () => {
    expect(escapeHtml(`<a href="x" title='y'>Tom & Jerry</a>`)).toBe(
      '&lt;a href=&quot;x&quot; title=&#39;y&#39;&gt;Tom &amp; Jerry&lt;/a&gt;',
    );
  });

  it('escapes each entity exactly once', () => {
    expect(escapeHtml('&<>"\'')).toBe('&amp;&lt;&gt;&quot;&#39;');
    // No double-encoding of an already-escaped string.
    expect(escapeHtml('&lt;')).toBe('&amp;lt;');
  });

  it('escapes an empty string to an empty string', () => {
    expect(escapeHtml('')).toBe('');
  });
});

describe('htmlDecode', () => {
  it('decodes the entities that appear in WebDAV href values', () => {
    expect(htmlDecode('a&amp;b&lt;c&gt;d&quot;e')).toBe('a&b<c>d"e');
  });

  it('is a no-op for strings with no entities', () => {
    expect(htmlDecode('plain/path.md')).toBe('plain/path.md');
  });
});

describe('humanize', () => {
  it('turns a slug into a display label', () => {
    expect(humanize('api-reference')).toBe('Api Reference');
  });

  it('handles underscores and mixed separators', () => {
    expect(humanize('getting_started_with-docs')).toBe('Getting Started With Docs');
  });

  it('drops empty segments (leading/trailing/repeated separators)', () => {
    expect(humanize('--foo--')).toBe('Foo');
    expect(humanize('_a__b_')).toBe('A B');
  });

  it('keeps a single word intact', () => {
    expect(humanize('install')).toBe('Install');
  });

  it('returns empty string for an empty input', () => {
    expect(humanize('')).toBe('');
  });
});

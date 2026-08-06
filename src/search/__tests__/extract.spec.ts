import { describe, expect, it } from 'bun:test';

import { extractPlainTextFromHtml } from '@/search/extract';

describe('extractPlainTextFromHtml', () => {
  it('strips scripts styles and tags then collapses whitespace', () => {
    const htmlDocument = `
      <html><head><style>.x{color:red}</style>
      <script>alert(1)</script></head>
      <body><h1>Hola</h1><p>Mundo &amp; amigos</p></body></html>
    `;
    const plainText = extractPlainTextFromHtml(htmlDocument);
    expect(plainText).toContain('Hola');
    expect(plainText).toContain('Mundo & amigos');
    expect(plainText).not.toContain('<');
    expect(plainText).not.toContain('alert');
    expect(plainText).not.toContain('color:red');
  });

  it('returns empty string for empty input', () => {
    expect(extractPlainTextFromHtml('')).toBe('');
  });
});

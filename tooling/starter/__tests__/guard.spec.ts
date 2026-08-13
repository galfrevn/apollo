import { describe, expect, it } from 'bun:test';

import { findForbiddenPatternViolationList } from '@/guard';
import { parseJsoncDocument } from '@/jsonc';

describe('findForbiddenPatternViolationList', () => {
  const ruleList = [
    { pattern: 'galfre.vn', allowedPathPrefixList: [] },
    { pattern: 'heyapollo', allowedPathPrefixList: ['README.md', 'documentation/'] },
  ];

  it('flags a forbidden pattern outside its allowed paths', () => {
    const violationList = findForbiddenPatternViolationList({
      fileContentByRelativePath: new Map([
        ['src/configuration/identity.ts', "const email = 'galfre.vn@gmail.com';"],
        ['src/index.ts', 'const consoleOrigin = "https://heyapollo.dev";'],
      ]),
      ruleList,
    });
    expect(violationList).toEqual([
      { relativePath: 'src/configuration/identity.ts', pattern: 'galfre.vn' },
      { relativePath: 'src/index.ts', pattern: 'heyapollo' },
    ]);
  });

  it('accepts allowed paths and matches case-insensitively', () => {
    const violationList = findForbiddenPatternViolationList({
      fileContentByRelativePath: new Map([
        ['README.md', 'the hosted console at HeyApollo.dev/console'],
        ['documentation/console/product.md', 'deployed at heyapollo.dev'],
      ]),
      ruleList,
    });
    expect(violationList).toHaveLength(0);
  });
});

describe('parseJsoncDocument', () => {
  it('strips comments and trailing commas without touching strings', () => {
    const parsedDocument = parseJsoncDocument(
      `{
        // line comment with a "quote"
        "url": "https://example.com/path", /* block */
        "list": [1, 2,],
      }`,
    );
    expect(parsedDocument).toEqual({ url: 'https://example.com/path', list: [1, 2] });
  });
});

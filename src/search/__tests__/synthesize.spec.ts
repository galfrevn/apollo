import { describe, expect, it } from 'bun:test';

import { parseResearchQueryPlan } from '@/search/synthesize';

describe('parseResearchQueryPlan', () => {
  it('accepts a json array of 3 to 5 non-empty queries', () => {
    expect(
      parseResearchQueryPlan(
        '["alpha beta","gamma","delta epsilon"]',
      ),
    ).toEqual(['alpha beta', 'gamma', 'delta epsilon']);
  });

  it('extracts json array from surrounding prose', () => {
    expect(
      parseResearchQueryPlan('Aqui va:\n["one","two","three"]\nfin'),
    ).toEqual(['one', 'two', 'three']);
  });

  it('rejects fewer than 3 queries', () => {
    expect(() => parseResearchQueryPlan('["a","b"]')).toThrow();
  });
});

import { describe, expect, it } from 'bun:test';

import { parseRouteFromHash } from '@/router/hash';

describe('hash router', () => {
  it('parses known routes with or without a leading slash', () => {
    expect(parseRouteFromHash('#/mcp')).toBe('mcp');
    expect(parseRouteFromHash('#memory')).toBe('memory');
    expect(parseRouteFromHash('#/schedules')).toBe('schedules');
  });

  it('falls back to status for unknown or empty hashes', () => {
    expect(parseRouteFromHash('')).toBe('status');
    expect(parseRouteFromHash('#/')).toBe('status');
    expect(parseRouteFromHash('#/unknown')).toBe('status');
  });
});

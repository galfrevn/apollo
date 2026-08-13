import { describe, expect, it } from 'bun:test';

import { parseRouteFromPathname } from '@/router/route';

describe('parseRouteFromPathname', () => {
  it('parses known console routes from the path', () => {
    expect(parseRouteFromPathname('/console/device')).toBe('device');
    expect(parseRouteFromPathname('/console/memory')).toBe('memory');
    expect(parseRouteFromPathname('/console/jobs/')).toBe('jobs');
  });

  it('falls back to status for the bare console path', () => {
    expect(parseRouteFromPathname('/console')).toBe('status');
    expect(parseRouteFromPathname('/console/')).toBe('status');
  });

  it('falls back to status for unknown segments', () => {
    expect(parseRouteFromPathname('/console/nonsense')).toBe('status');
    expect(parseRouteFromPathname('/elsewhere')).toBe('status');
  });
});

import { describe, expect, it } from 'bun:test';

import { resolveSurfaceFromLocation } from '@/router/path';

describe('resolveSurfaceFromLocation', () => {
  it('keeps unknown root hashes on the landing surface', () => {
    expect(resolveSurfaceFromLocation('/', '#/nonsense')).toEqual({
      kind: 'landing',
    });
    expect(resolveSurfaceFromLocation('/', '#listen')).toEqual({
      kind: 'landing',
    });
  });
});

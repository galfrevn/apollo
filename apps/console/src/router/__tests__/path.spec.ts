import { describe, expect, it } from 'bun:test';

import { resolveSurfaceFromLocation } from '@/router/path';

describe('resolveSurfaceFromLocation', () => {
  it('resolves the root path to the landing surface', () => {
    expect(resolveSurfaceFromLocation('/', '')).toEqual({ kind: 'landing' });
  });

  it('resolves unknown paths to the landing surface', () => {
    expect(resolveSurfaceFromLocation('/pricing', '')).toEqual({ kind: 'landing' });
  });

  it('resolves the console base path to the console surface', () => {
    expect(resolveSurfaceFromLocation('/console', '')).toEqual({ kind: 'console' });
    expect(resolveSurfaceFromLocation('/console/', '')).toEqual({ kind: 'console' });
  });

  it('keeps console hash routes on the console surface', () => {
    expect(resolveSurfaceFromLocation('/console', '#/memory')).toEqual({
      kind: 'console',
    });
  });

  it('does not treat path prefixes of /console as the console surface', () => {
    expect(resolveSurfaceFromLocation('/consoles', '')).toEqual({ kind: 'landing' });
  });

  it('redirects legacy root hash routes into the console surface', () => {
    expect(resolveSurfaceFromLocation('/', '#/device')).toEqual({
      kind: 'redirect',
      targetUrl: '/console#/device',
    });
    expect(resolveSurfaceFromLocation('/', '#/status')).toEqual({
      kind: 'redirect',
      targetUrl: '/console#/status',
    });
  });

  it('keeps unknown root hashes on the landing surface', () => {
    expect(resolveSurfaceFromLocation('/', '#/nonsense')).toEqual({ kind: 'landing' });
    expect(resolveSurfaceFromLocation('/', '#listen')).toEqual({ kind: 'landing' });
  });
});

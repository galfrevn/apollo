import { describe, expect, it } from 'bun:test';

import {
  APOLLO_DEVICE_PROTOCOL_VERSION,
  resolveDeclaredProtocolVersion,
} from '@/protocol/version';

describe('protocol version', () => {
  it('keeps a declared version', () => {
    expect(resolveDeclaredProtocolVersion('1.1')).toBe('1.1');
  });

  it('pins an absent declaration to 1.0', () => {
    expect(resolveDeclaredProtocolVersion(undefined)).toBe('1.0');
  });

  it('advertises a MAJOR.MINOR version', () => {
    expect(APOLLO_DEVICE_PROTOCOL_VERSION).toMatch(/^\d+\.\d+$/);
  });
});

import { describe, expect, it } from 'bun:test';

import { resolveDeskFaceEmotion } from '@/persona/face';

describe('desk face emotion mapping', () => {
  it('maps every ui state to a face emotion', () => {
    expect(resolveDeskFaceEmotion('idle')).toBe('neutral');
    expect(resolveDeskFaceEmotion('listening')).toBe('curious');
    expect(resolveDeskFaceEmotion('thinking')).toBe('focused');
    expect(resolveDeskFaceEmotion('confirm')).toBe('questioning');
    expect(resolveDeskFaceEmotion('speaking')).toBe('talking');
    expect(resolveDeskFaceEmotion('focus')).toBe('calm');
    expect(resolveDeskFaceEmotion('dashboard')).toBe('neutral');
  });
});

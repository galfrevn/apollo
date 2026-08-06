import { describe, expect, it } from 'bun:test';

import { shouldAnnounceDuringFocus, startDeskFocus, tickDeskFocus } from '@/focus/logic';

describe('focus logic', () => {
  it('suppresses normal announces while active', () => {
    const focusState = startDeskFocus(1000, 60);
    expect(shouldAnnounceDuringFocus(focusState, 'normal')).toBe(false);
    expect(shouldAnnounceDuringFocus(focusState, 'critical')).toBe(true);
  });

  it('expires when now passes endsAt', () => {
    const focusState = startDeskFocus(1000, 60);
    const expiredState = tickDeskFocus(focusState, 1000 + 60_000);
    expect(expiredState.active).toBe(false);
    expect(shouldAnnounceDuringFocus(expiredState, 'normal')).toBe(true);
  });
});

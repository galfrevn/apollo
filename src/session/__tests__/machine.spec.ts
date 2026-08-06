import { describe, expect, it } from 'bun:test';

import { createDeskUiMachine } from '@/session/machine';

describe('desk ui machine', () => {
  it('idle → listening → thinking → speaking → idle', () => {
    const machine = createDeskUiMachine('idle');
    expect(machine.transition('START_LISTEN')).toBe('listening');
    expect(machine.transition('START_THINK')).toBe('thinking');
    expect(machine.transition('START_SPEAK')).toBe('speaking');
    expect(machine.transition('SPEAK_DONE')).toBe('idle');
  });

  it('thinking → confirm → speaking', () => {
    const machine = createDeskUiMachine('thinking');
    expect(machine.transition('NEED_CONFIRM')).toBe('confirm');
    expect(machine.transition('START_SPEAK')).toBe('speaking');
  });

  it('returns to focus after speak when focus was active', () => {
    const machine = createDeskUiMachine('idle');
    expect(machine.transition('ENTER_FOCUS')).toBe('focus');
    expect(machine.transition('START_LISTEN')).toBe('listening');
    expect(machine.transition('START_THINK')).toBe('thinking');
    expect(machine.transition('START_SPEAK')).toBe('speaking');
    expect(machine.transition('SPEAK_DONE')).toBe('focus');
  });

  it('opens and closes dashboard', () => {
    const machine = createDeskUiMachine('idle');
    expect(machine.transition('OPEN_DASHBOARD')).toBe('dashboard');
    expect(machine.transition('CLOSE_DASHBOARD')).toBe('idle');
  });
});

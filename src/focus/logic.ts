export type DeskFocusState = {
  readonly active: boolean;
  readonly endsAt: number | null;
};

export type DeskAnnounceKind = 'critical' | 'normal';

export function createInactiveDeskFocusState(): DeskFocusState {
  return { active: false, endsAt: null };
}

export function startDeskFocus(
  nowMilliseconds: number,
  durationSeconds: number,
): DeskFocusState {
  return {
    active: true,
    endsAt: nowMilliseconds + durationSeconds * 1000,
  };
}

export function clearDeskFocus(): DeskFocusState {
  return createInactiveDeskFocusState();
}

export function tickDeskFocus(
  focusState: DeskFocusState,
  nowMilliseconds: number,
): DeskFocusState {
  if (
    focusState.active &&
    focusState.endsAt !== null &&
    nowMilliseconds >= focusState.endsAt
  ) {
    return clearDeskFocus();
  }
  return focusState;
}

export function shouldAnnounceDuringFocus(
  focusState: DeskFocusState,
  announceKind: DeskAnnounceKind,
): boolean {
  if (!focusState.active) {
    return true;
  }
  return announceKind === 'critical';
}

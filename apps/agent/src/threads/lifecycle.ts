export const THREAD_INACTIVITY_CUTOFF_MILLISECONDS = 30 * 60_000;

export const ACTIVE_THREAD_SESSION_PREFERENCE_KEY = 'activeThreadSessionId';
export const ACTIVE_THREAD_LAST_TURN_PREFERENCE_KEY = 'activeThreadLastTurnAt';
export const PREVIOUS_THREAD_SESSION_PREFERENCE_KEY = 'previousThreadSessionId';

export const COMMAND_THREAD_RETENTION_DAYS = 30;

export type ThreadRotationDecision =
  | { readonly action: 'reuse'; readonly sessionId: string }
  | { readonly action: 'start'; readonly previousSessionId: string | null };

export function decideThreadRotation(input: {
  readonly activeSessionId: string | null;
  readonly lastTurnAtMilliseconds: number | null;
  readonly nowMilliseconds: number;
  readonly inactivityCutoffMilliseconds?: number;
}): ThreadRotationDecision {
  const inactivityCutoffMilliseconds =
    input.inactivityCutoffMilliseconds ?? THREAD_INACTIVITY_CUTOFF_MILLISECONDS;
  if (input.activeSessionId === null) {
    return { action: 'start', previousSessionId: null };
  }
  if (input.lastTurnAtMilliseconds === null) {
    return { action: 'reuse', sessionId: input.activeSessionId };
  }
  const idleMilliseconds = input.nowMilliseconds - input.lastTurnAtMilliseconds;
  if (idleMilliseconds >= inactivityCutoffMilliseconds) {
    return { action: 'start', previousSessionId: input.activeSessionId };
  }
  return { action: 'reuse', sessionId: input.activeSessionId };
}

export function parseStoredLastTurnAt(storedValue: string | null): number | null {
  if (storedValue === null || storedValue.length === 0) {
    return null;
  }
  const parsedMilliseconds = Number(storedValue);
  return Number.isFinite(parsedMilliseconds) ? parsedMilliseconds : null;
}

export function buildDefaultThreadTitle(nowMilliseconds: number): string {
  return `Conversación del ${new Date(nowMilliseconds).toISOString().slice(0, 10)}`;
}

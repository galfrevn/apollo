import type { DeskUiStateName } from '@/protocol/schema';

export type DeskUiEventName =
  | 'START_LISTEN'
  | 'START_THINK'
  | 'NEED_CONFIRM'
  | 'START_SPEAK'
  | 'SPEAK_DONE'
  | 'OPEN_DASHBOARD'
  | 'CLOSE_DASHBOARD'
  | 'ENTER_FOCUS'
  | 'EXIT_FOCUS'
  | 'CANCEL';

export type DeskUiMachine = {
  readonly state: DeskUiStateName;
  transition(eventName: DeskUiEventName): DeskUiStateName;
};

export function createDeskUiMachine(
  initialState: DeskUiStateName = 'idle',
): DeskUiMachine {
  let currentState: DeskUiStateName = initialState;
  let returnAfterSpeakState: DeskUiStateName =
    initialState === 'focus' ? 'focus' : 'idle';

  function transition(eventName: DeskUiEventName): DeskUiStateName {
    switch (eventName) {
      case 'START_LISTEN': {
        if (
          currentState === 'idle' ||
          currentState === 'focus' ||
          currentState === 'dashboard'
        ) {
          returnAfterSpeakState = currentState === 'focus' ? 'focus' : 'idle';
          currentState = 'listening';
        }
        break;
      }
      case 'START_THINK': {
        if (currentState === 'listening') {
          currentState = 'thinking';
        }
        break;
      }
      case 'NEED_CONFIRM': {
        if (currentState === 'thinking') {
          currentState = 'confirm';
        }
        break;
      }
      case 'START_SPEAK': {
        if (currentState === 'thinking' || currentState === 'confirm') {
          currentState = 'speaking';
        }
        break;
      }
      case 'SPEAK_DONE': {
        if (currentState === 'speaking') {
          currentState = returnAfterSpeakState;
        }
        break;
      }
      case 'OPEN_DASHBOARD': {
        if (currentState === 'idle') {
          currentState = 'dashboard';
        }
        break;
      }
      case 'CLOSE_DASHBOARD': {
        if (currentState === 'dashboard') {
          currentState = 'idle';
        }
        break;
      }
      case 'ENTER_FOCUS': {
        if (currentState === 'idle' || currentState === 'dashboard') {
          currentState = 'focus';
          returnAfterSpeakState = 'focus';
        }
        break;
      }
      case 'EXIT_FOCUS': {
        if (currentState === 'focus') {
          currentState = 'idle';
          returnAfterSpeakState = 'idle';
        }
        break;
      }
      case 'CANCEL': {
        if (
          currentState === 'listening' ||
          currentState === 'thinking' ||
          currentState === 'confirm' ||
          currentState === 'speaking'
        ) {
          currentState = returnAfterSpeakState;
        }
        break;
      }
    }
    return currentState;
  }

  return {
    get state() {
      return currentState;
    },
    transition,
  };
}

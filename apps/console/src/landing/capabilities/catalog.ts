export interface CapabilityRow {
  readonly indexLabel: string;
  readonly name: string;
  readonly description: string;
  readonly tag: string;
}

export const CAPABILITY_ROW_LIST: readonly CapabilityRow[] = [
  {
    indexLabel: '3.1',
    name: 'Voice turns',
    description: 'Short spoken replies, tuned for a device on a desk, not a chat window.',
    tag: 'Always on',
  },
  {
    indexLabel: '3.2',
    name: 'Memory',
    description: 'Remembers what you tell it, and recalls it when it matters.',
    tag: 'Vectorize',
  },
  {
    indexLabel: '3.3',
    name: 'Reminders',
    description: 'Timers and schedules that fire on the device itself.',
    tag: 'On device',
  },
  {
    indexLabel: '3.4',
    name: 'Live answers',
    description: 'Web research condensed into a sentence you can act on.',
    tag: 'Search',
  },
  {
    indexLabel: '3.5',
    name: 'Coding agent',
    description:
      'Delegates real repository work to a sandboxed engine, then reports back out loud.',
    tag: 'Sandbox',
  },
  {
    indexLabel: '3.6',
    name: 'Your tools',
    description:
      'Connects to the services you already use over MCP, managed from the console.',
    tag: 'MCP',
  },
];

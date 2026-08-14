interface ConnectionMessages {
  readonly tagline: string;
  readonly formTitle: string;
  readonly workerUrlLabel: string;
  readonly deviceNameLabel: string;
  readonly deviceNameHint: string;
  readonly dashboardSecretLabel: string;
  readonly validationMessage: string;
  readonly probeErrorMap: Record<'unreachable' | 'not-apollo', string>;
  readonly probingLabel: string;
  readonly connectLabel: string;
  readonly privacyNote: string;
}

export const CONNECTION_MESSAGES: ConnectionMessages = {
  tagline: 'The instrument panel for your agent with a body',
  formTitle: 'Connect to your worker',
  workerUrlLabel: 'Worker URL',
  deviceNameLabel: 'Device name',
  deviceNameHint:
    'The agent instance the device connects as — “desk” unless changed in firmware.',
  dashboardSecretLabel: 'Dashboard secret',
  validationMessage:
    'Enter a full worker URL (https://…), a device name, and the dashboard secret.',
  probeErrorMap: {
    unreachable: 'Worker unreachable — check the URL and that the worker is deployed.',
    'not-apollo': 'That URL responds, but not like an Apollo worker — check /health.',
  },
  probingLabel: 'Probing worker…',
  connectLabel: 'Connect',
  privacyNote:
    'Stored in this browser only. Nothing leaves it except calls to your worker.',
};

import type { Locale } from '@/locale/detect';

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

export const CONNECTION_MESSAGE_CATALOG: Record<Locale, ConnectionMessages> = {
  es: {
    tagline: 'El panel de instrumentos de tu agente de escritorio',
    formTitle: 'Conéctate a tu worker',
    workerUrlLabel: 'URL del worker',
    deviceNameLabel: 'Nombre del dispositivo',
    deviceNameHint:
      'La instancia del agente a la que se conecta el dispositivo — “desk” salvo que lo cambies en el firmware.',
    dashboardSecretLabel: 'Clave del panel',
    validationMessage:
      'Escribe la URL completa del worker (https://…), un nombre de dispositivo y la clave del panel.',
    probeErrorMap: {
      unreachable: 'Worker inaccesible — revisa la URL y que el worker esté desplegado.',
      'not-apollo':
        'Esa URL responde, pero no como un worker de Apollo — revisa /health.',
    },
    probingLabel: 'Comprobando el worker…',
    connectLabel: 'Conectar',
    privacyNote:
      'Se guarda solo en este navegador. Nada sale de aquí salvo las llamadas a tu worker.',
  },
  en: {
    tagline: 'The instrument panel for your desk agent',
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
  },
};

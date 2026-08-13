import type { Locale } from '@/locale/detect';

interface DeviceMessages {
  readonly pageTitle: string;
  readonly pageDescription: string;
  readonly modePanelTitle: string;
  readonly modeHint: string;
  readonly modeChangeFallbackError: string;
  readonly controlsPanelTitle: string;
  readonly weatherPanelTitle: string;
  readonly volumeLabel: string;
  readonly brightnessLabel: string;
  readonly offlineControlsNote: string;
  readonly commandFailedFallbackError: string;
  readonly weatherLoadError: string;
  readonly weatherNotFoundError: (locationQuery: string) => string;
  readonly weatherPlaceholder: string;
  readonly weatherInputAriaLabel: string;
  readonly savingLabel: string;
  readonly applyLabel: string;
}

export const DEVICE_MESSAGE_CATALOG: Record<Locale, DeviceMessages> = {
  es: {
    pageTitle: 'Dispositivo',
    pageDescription: 'Tu escritorio, en vivo — arrastra para rotar',
    modePanelTitle: 'Modo',
    modeHint:
      'El anillo del modelo anticipa el acento de cada modo, tal como lo muestra el escritorio.',
    modeChangeFallbackError: 'No se pudo cambiar el modo.',
    controlsPanelTitle: 'Volumen y brillo',
    weatherPanelTitle: 'Ubicación del clima',
    volumeLabel: 'Volumen',
    brightnessLabel: 'Brillo',
    offlineControlsNote: 'Los controles aparecen cuando el escritorio está en línea.',
    commandFailedFallbackError: 'Falló el comando.',
    weatherLoadError: 'No se pudo cargar la ubicación del clima.',
    weatherNotFoundError: (locationQuery) =>
      `No se encontró ninguna ubicación para “${locationQuery}”.`,
    weatherPlaceholder: 'Cambiar ciudad…',
    weatherInputAriaLabel: 'Nueva ubicación del clima',
    savingLabel: 'Guardando…',
    applyLabel: 'Aplicar',
  },
  en: {
    pageTitle: 'Device',
    pageDescription: 'Your desk, live — drag to rotate',
    modePanelTitle: 'Mode',
    modeHint:
      "The ring on the model previews each mode's accent, exactly as the desk shows it.",
    modeChangeFallbackError: 'Could not change the mode.',
    controlsPanelTitle: 'Volume & brightness',
    weatherPanelTitle: 'Weather location',
    volumeLabel: 'Volume',
    brightnessLabel: 'Brightness',
    offlineControlsNote: 'Controls appear when the desk is online.',
    commandFailedFallbackError: 'Command failed.',
    weatherLoadError: 'Could not load the weather location.',
    weatherNotFoundError: (locationQuery) => `No location found for “${locationQuery}”.`,
    weatherPlaceholder: 'Change city…',
    weatherInputAriaLabel: 'New weather location',
    savingLabel: 'Saving…',
    applyLabel: 'Set',
  },
};

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

export const DEVICE_MESSAGES: DeviceMessages = {
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
};

import type { Locale } from '@/locale/detect';

interface SchedulesMessages {
  readonly pageTitle: string;
  readonly pageDescription: string;
  readonly refreshLabel: string;
  readonly listFallbackError: string;
  readonly cancelFallbackError: string;
  readonly panelTitle: string;
  readonly pendingCountLabel: (reminderCount: number) => string;
  readonly dueLabel: string;
  readonly timerKindLabel: string;
  readonly reminderKindLabel: string;
  readonly cancelLabel: string;
  readonly emptyMessage: string;
  readonly cancelDialogTitle: string;
  readonly cancelDialogDescription: (reminderMessage: string) => string;
  readonly keepLabel: string;
  readonly cancellingLabel: string;
  readonly confirmCancelLabel: string;
  readonly timerLabelMissingError: string;
  readonly reminderMissingError: string;
  readonly minutesRangeError: (maximumMinutes: number) => string;
  readonly schedulingFallbackError: string;
  readonly timerPlaceholder: string;
  readonly reminderPlaceholder: string;
  readonly timerInputAriaLabel: string;
  readonly reminderInputAriaLabel: string;
  readonly minutesInputAriaLabel: string;
  readonly minutesUnitLabel: string;
  readonly timerSwitchAriaLabel: string;
  readonly timerSwitchLabel: string;
  readonly addingLabel: string;
  readonly addLabel: string;
}

export const SCHEDULES_MESSAGE_CATALOG: Record<Locale, SchedulesMessages> = {
  es: {
    pageTitle: 'Agenda',
    pageDescription: 'Qué dirá el escritorio, y cuándo',
    refreshLabel: 'Actualizar',
    listFallbackError: 'No se pudieron listar los recordatorios.',
    cancelFallbackError: 'Falló la cancelación — actualiza y reintenta.',
    panelTitle: 'Recordatorios y temporizadores',
    pendingCountLabel: (reminderCount) =>
      reminderCount === 1 ? '1 pendiente' : `${reminderCount} pendientes`,
    dueLabel: 'ahora',
    timerKindLabel: 'Temporizador',
    reminderKindLabel: 'Recordatorio',
    cancelLabel: 'Cancelar',
    emptyMessage: 'Nada programado',
    cancelDialogTitle: '¿Cancelar este recordatorio?',
    cancelDialogDescription: (reminderMessage) =>
      `“${reminderMessage}” no sonará en el escritorio.`,
    keepLabel: 'Conservarlo',
    cancellingLabel: 'Cancelando…',
    confirmCancelLabel: 'Cancelar recordatorio',
    timerLabelMissingError: 'Ponle una etiqueta al temporizador.',
    reminderMissingError: 'Escribe el recordatorio.',
    minutesRangeError: (maximumMinutes) =>
      `Los minutos deben estar entre 1 y ${maximumMinutes}.`,
    schedulingFallbackError: 'Falló la programación.',
    timerPlaceholder: 'Etiqueta del temporizador — pasta',
    reminderPlaceholder: 'Recuérdame…',
    timerInputAriaLabel: 'Etiqueta del temporizador',
    reminderInputAriaLabel: 'Mensaje del recordatorio',
    minutesInputAriaLabel: 'Minutos hasta que suene',
    minutesUnitLabel: 'min',
    timerSwitchAriaLabel: 'Programar como temporizador',
    timerSwitchLabel: 'Temporizador',
    addingLabel: 'Agregando…',
    addLabel: 'Agregar',
  },
  en: {
    pageTitle: 'Schedules',
    pageDescription: 'What the desk will say, and when',
    refreshLabel: 'Refresh',
    listFallbackError: 'Could not list reminders.',
    cancelFallbackError: 'Cancel failed — refresh and retry.',
    panelTitle: 'Reminders & timers',
    pendingCountLabel: (reminderCount) =>
      reminderCount === 1 ? '1 pending' : `${reminderCount} pending`,
    dueLabel: 'due',
    timerKindLabel: 'Timer',
    reminderKindLabel: 'Reminder',
    cancelLabel: 'Cancel',
    emptyMessage: 'Nothing scheduled',
    cancelDialogTitle: 'Cancel this reminder?',
    cancelDialogDescription: (reminderMessage) =>
      `“${reminderMessage}” will not fire on the desk.`,
    keepLabel: 'Keep it',
    cancellingLabel: 'Cancelling…',
    confirmCancelLabel: 'Cancel reminder',
    timerLabelMissingError: 'Give the timer a label.',
    reminderMissingError: 'Write the reminder.',
    minutesRangeError: (maximumMinutes) =>
      `Minutes must be between 1 and ${maximumMinutes}.`,
    schedulingFallbackError: 'Scheduling failed.',
    timerPlaceholder: 'Timer label — pasta',
    reminderPlaceholder: 'Remind me to…',
    timerInputAriaLabel: 'Timer label',
    reminderInputAriaLabel: 'Reminder message',
    minutesInputAriaLabel: 'Minutes until it fires',
    minutesUnitLabel: 'min',
    timerSwitchAriaLabel: 'Schedule as a timer',
    timerSwitchLabel: 'Timer',
    addingLabel: 'Adding…',
    addLabel: 'Add',
  },
};

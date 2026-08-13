import type { ThreadSummary } from '@/agent/schema';
import type { Locale } from '@/locale/detect';

type ThreadKind = ThreadSummary['kind'];

interface HistoryMessages {
  readonly pageTitle: string;
  readonly pageDescription: string;
  readonly conversationsViewLabel: string;
  readonly commandsViewLabel: string;
  readonly refreshLabel: string;
  readonly loadHistoryFallbackError: string;
  readonly loadThreadFallbackError: string;
  readonly commandLogPanelTitle: string;
  readonly conversationsPanelTitle: string;
  readonly threadCountLabel: (threadCount: number) => string;
  readonly commandsEmptyMessage: string;
  readonly conversationsEmptyMessage: string;
  readonly activeBadgeLabel: string;
  readonly kindBadgeLabelMap: Record<ThreadKind, string>;
  readonly footNote: string;
  readonly threadFallbackTitle: string;
  readonly turnsEmptyMessage: string;
  readonly assistantTurnLabel: string;
  readonly ownerTurnLabel: string;
}

export const HISTORY_MESSAGE_CATALOG: Record<Locale, HistoryMessages> = {
  es: {
    pageTitle: 'Historial',
    pageDescription: 'Hilos de conversación entre el dueño y el agente',
    conversationsViewLabel: 'Conversaciones',
    commandsViewLabel: 'Comandos',
    refreshLabel: 'Actualizar',
    loadHistoryFallbackError: 'No se pudo cargar el historial.',
    loadThreadFallbackError: 'No se pudo cargar el hilo.',
    commandLogPanelTitle: 'Registro de comandos',
    conversationsPanelTitle: 'Conversaciones',
    threadCountLabel: (threadCount) =>
      threadCount === 1 ? '1 hilo' : `${threadCount} hilos`,
    commandsEmptyMessage:
      'Aún no hay comandos rápidos — pídele al escritorio un temporizador o el clima',
    conversationsEmptyMessage: 'Aún no hay conversaciones — habla con el escritorio',
    activeBadgeLabel: 'activo',
    kindBadgeLabelMap: {
      pending: 'abierto',
      command: 'comando',
      conversation: 'conversación',
    },
    footNote:
      'Los hilos se cierran tras 30 minutos de silencio; las conversaciones reciben título y resumen, los comandos rápidos van al registro de comandos. Las herramientas aparecen como chips en el turno que las ejecutó.',
    threadFallbackTitle: 'Hilo',
    turnsEmptyMessage: 'No hay turnos registrados en este hilo',
    assistantTurnLabel: 'Apollo',
    ownerTurnLabel: 'Dueño',
  },
  en: {
    pageTitle: 'History',
    pageDescription: 'Conversation threads between the owner and the agent',
    conversationsViewLabel: 'Conversations',
    commandsViewLabel: 'Commands',
    refreshLabel: 'Refresh',
    loadHistoryFallbackError: 'Could not load the history.',
    loadThreadFallbackError: 'Could not load the thread.',
    commandLogPanelTitle: 'Command log',
    conversationsPanelTitle: 'Conversations',
    threadCountLabel: (threadCount) =>
      threadCount === 1 ? '1 thread' : `${threadCount} threads`,
    commandsEmptyMessage:
      'No quick commands yet — ask the desk for a timer or the weather',
    conversationsEmptyMessage: 'No conversations yet — talk to the desk',
    activeBadgeLabel: 'active',
    kindBadgeLabelMap: {
      pending: 'open',
      command: 'command',
      conversation: 'conversation',
    },
    footNote:
      'Threads close after 30 minutes of silence; conversations get a title and summary, quick commands land in the command log. Tool calls show as chips on the turn that ran them.',
    threadFallbackTitle: 'Thread',
    turnsEmptyMessage: 'No turns recorded in this thread',
    assistantTurnLabel: 'Apollo',
    ownerTurnLabel: 'Owner',
  },
};

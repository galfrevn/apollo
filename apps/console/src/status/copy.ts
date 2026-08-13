import type { ApolloAgentState } from '@/agent/schema';
import type { Locale } from '@/locale/detect';
import type { ConsoleRoute } from '@/router/route';

export type InsightSegment =
  | { readonly kind: 'plain'; readonly text: string }
  | { readonly kind: 'highlight'; readonly label: string; readonly route?: ConsoleRoute };

function plain(text: string): InsightSegment {
  return { kind: 'plain', text };
}

function highlight(label: string, route?: ConsoleRoute): InsightSegment {
  return { kind: 'highlight', label, route };
}

type AgentUiState = ApolloAgentState['uiState'];

export interface StatusMessages {
  readonly resolveGreeting: (hourOfDay: number) => string;
  readonly agentActivityLabelMap: Record<AgentUiState, string>;
  readonly insights: {
    readonly deviceOnline: (connectionCount: number) => readonly InsightSegment[];
    readonly deviceOffline: readonly InsightSegment[];
    readonly battery: (
      batteryLevel: number,
      isCharging: boolean | undefined,
    ) => readonly InsightSegment[];
    readonly pendingReminders: (reminderCount: number) => readonly InsightSegment[];
    readonly emptySchedule: readonly InsightSegment[];
    readonly agentBusy: (activityLabel: string) => readonly InsightSegment[];
  };
  readonly tiles: {
    readonly deviceLabel: string;
    readonly agentLabel: string;
    readonly batteryLabel: string;
    readonly wifiLabel: string;
    readonly remindersLabel: string;
    readonly firmwareLabel: string;
    readonly deviceOnlineValue: string;
    readonly deviceOfflineValue: string;
    readonly deviceLinksDetail: (connectionCount: number) => string;
    readonly chargingDetail: string;
    readonly onBatteryDetail: string;
    readonly remindersPendingDetail: string;
    readonly volumeDetail: (volume: number) => string;
    readonly formatSnapshotAge: (ageMinutes: number) => string;
    readonly snapshotLine: (ageLabel: string) => string;
    readonly staleSuffix: string;
  };
  readonly awaitingConfirmationLabel: string;
  readonly approveLabel: string;
  readonly rejectLabel: string;
  readonly pollFailedMessage: (intervalSeconds: number) => string;
}

export const STATUS_MESSAGE_CATALOG: Record<Locale, StatusMessages> = {
  es: {
    resolveGreeting: (hourOfDay) => {
      if (hourOfDay < 12) {
        return 'Buenos días';
      }
      if (hourOfDay < 19) {
        return 'Buenas tardes';
      }
      return 'Buenas noches';
    },
    agentActivityLabelMap: {
      idle: 'inactivo',
      listening: 'escuchando',
      thinking: 'pensando',
      confirm: 'esperando confirmación',
      speaking: 'hablando',
      focus: 'en foco',
      dashboard: 'en panel',
    },
    insights: {
      deviceOnline: (connectionCount) => {
        const segmentList = [plain('El escritorio está '), highlight('en línea')];
        if (connectionCount > 1) {
          segmentList.push(plain(` con ${connectionCount} enlaces de dispositivo`));
        }
        segmentList.push(plain('.'));
        return segmentList;
      },
      deviceOffline: [
        plain('El escritorio está '),
        highlight('sin conexión'),
        plain(' — la telemetría se pausa hasta que se reconecte.'),
      ],
      battery: (batteryLevel, isCharging) => [
        plain('Batería al '),
        highlight(`${batteryLevel}%`),
        plain(
          isCharging === undefined ? '.' : isCharging ? ', cargando.' : ', con batería.',
        ),
      ],
      pendingReminders: (reminderCount) => [
        plain('Hay '),
        highlight(
          `${reminderCount} ${reminderCount === 1 ? 'recordatorio' : 'recordatorios'}`,
          'schedules',
        ),
        plain(reminderCount === 1 ? ' pendiente.' : ' pendientes.'),
      ],
      emptySchedule: [plain('Nada en la '), highlight('agenda', 'schedules'), plain('.')],
      agentBusy: (activityLabel) => [
        plain('El agente está '),
        highlight(activityLabel),
        plain(' en este momento.'),
      ],
    },
    tiles: {
      deviceLabel: 'Dispositivo',
      agentLabel: 'Agente',
      batteryLabel: 'Batería',
      wifiLabel: 'Wi-Fi',
      remindersLabel: 'Recordatorios',
      firmwareLabel: 'Firmware',
      deviceOnlineValue: 'En línea',
      deviceOfflineValue: 'Sin conexión',
      deviceLinksDetail: (connectionCount) => `${connectionCount} enlaces`,
      chargingDetail: 'Cargando',
      onBatteryDetail: 'Con batería',
      remindersPendingDetail: 'pendientes',
      volumeDetail: (volume) => `Volumen ${volume}`,
      formatSnapshotAge: (ageMinutes) => {
        if (ageMinutes < 1) {
          return 'recién';
        }
        if (ageMinutes < 60) {
          return `hace ${ageMinutes} min`;
        }
        const ageHours = Math.round(ageMinutes / 60);
        if (ageHours < 48) {
          return `hace ${ageHours} h`;
        }
        return `hace ${Math.round(ageHours / 24)} d`;
      },
      snapshotLine: (ageLabel) => `Captura ${ageLabel}`,
      staleSuffix:
        ' — desactualizada; el dispositivo envía telemetría solo mientras está conectado',
    },
    awaitingConfirmationLabel: 'Esperando confirmación',
    approveLabel: 'Aprobar',
    rejectLabel: 'Rechazar',
    pollFailedMessage: (intervalSeconds) =>
      `Falló la consulta de estado — reintentando cada ${intervalSeconds}s.`,
  },
  en: {
    resolveGreeting: (hourOfDay) => {
      if (hourOfDay < 12) {
        return 'Good morning';
      }
      if (hourOfDay < 19) {
        return 'Good afternoon';
      }
      return 'Good evening';
    },
    agentActivityLabelMap: {
      idle: 'idle',
      listening: 'listening',
      thinking: 'thinking',
      confirm: 'awaiting confirmation',
      speaking: 'speaking',
      focus: 'focused',
      dashboard: 'on dashboard',
    },
    insights: {
      deviceOnline: (connectionCount) => {
        const segmentList = [plain('The desk is '), highlight('online')];
        if (connectionCount > 1) {
          segmentList.push(plain(` with ${connectionCount} device links`));
        }
        segmentList.push(plain('.'));
        return segmentList;
      },
      deviceOffline: [
        plain('The desk is '),
        highlight('offline'),
        plain(' — telemetry pauses until it reconnects.'),
      ],
      battery: (batteryLevel, isCharging) => [
        plain('Battery at '),
        highlight(`${batteryLevel}%`),
        plain(
          isCharging === undefined ? '.' : isCharging ? ', charging.' : ', on battery.',
        ),
      ],
      pendingReminders: (reminderCount) => [
        plain(reminderCount === 1 ? 'There is ' : 'There are '),
        highlight(
          `${reminderCount} ${reminderCount === 1 ? 'reminder' : 'reminders'}`,
          'schedules',
        ),
        plain(' waiting to fire.'),
      ],
      emptySchedule: [
        plain('Nothing on the '),
        highlight('schedule', 'schedules'),
        plain('.'),
      ],
      agentBusy: (activityLabel) => [
        plain('The agent is '),
        highlight(activityLabel),
        plain(' right now.'),
      ],
    },
    tiles: {
      deviceLabel: 'Device',
      agentLabel: 'Agent',
      batteryLabel: 'Battery',
      wifiLabel: 'Wi-Fi',
      remindersLabel: 'Reminders',
      firmwareLabel: 'Firmware',
      deviceOnlineValue: 'Online',
      deviceOfflineValue: 'Offline',
      deviceLinksDetail: (connectionCount) => `${connectionCount} links`,
      chargingDetail: 'Charging',
      onBatteryDetail: 'On battery',
      remindersPendingDetail: 'pending',
      volumeDetail: (volume) => `Volume ${volume}`,
      formatSnapshotAge: (ageMinutes) => {
        if (ageMinutes < 1) {
          return 'just now';
        }
        if (ageMinutes < 60) {
          return `${ageMinutes} min ago`;
        }
        const ageHours = Math.round(ageMinutes / 60);
        if (ageHours < 48) {
          return `${ageHours} h ago`;
        }
        return `${Math.round(ageHours / 24)} d ago`;
      },
      snapshotLine: (ageLabel) => `Snapshot ${ageLabel}`,
      staleSuffix: ' — stale; the device pushes telemetry only while connected',
    },
    awaitingConfirmationLabel: 'Awaiting confirmation',
    approveLabel: 'Approve',
    rejectLabel: 'Reject',
    pollFailedMessage: (intervalSeconds) =>
      `Status poll failed — retrying every ${intervalSeconds}s.`,
  },
};

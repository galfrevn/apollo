export type DeskTelemetrySnapshot = {
  readonly battery?: number;
  readonly charging?: boolean;
  readonly volume?: number;
  readonly wifiRssi?: number;
  readonly firmwareVersion?: string;
  readonly receivedAtMs: number;
};

export const LOW_BATTERY_ANNOUNCE_THRESHOLD_PERCENT = 15;
export const LOW_BATTERY_REARM_THRESHOLD_PERCENT = 25;
export const LOW_BATTERY_ANNOUNCE_COOLDOWN_MS = 30 * 60_000;
export const TELEMETRY_PROMPT_STALENESS_MS = 5 * 60_000;

export function buildTelemetryPromptNote(
  snapshot: DeskTelemetrySnapshot | undefined,
  nowMilliseconds: number,
): string {
  if (snapshot === undefined) {
    return '';
  }
  if (nowMilliseconds - snapshot.receivedAtMs > TELEMETRY_PROMPT_STALENESS_MS) {
    return '';
  }
  const fragmentList: string[] = [];
  if (snapshot.battery !== undefined) {
    const chargingLabel =
      snapshot.charging === undefined
        ? ''
        : snapshot.charging
          ? ' (cargando)'
          : ' (con batería)';
    fragmentList.push(`batería ${snapshot.battery}%${chargingLabel}`);
  }
  if (snapshot.volume !== undefined) {
    fragmentList.push(`volumen ${snapshot.volume}`);
  }
  if (snapshot.wifiRssi !== undefined) {
    fragmentList.push(`WiFi ${snapshot.wifiRssi} dBm`);
  }
  if (snapshot.firmwareVersion !== undefined) {
    fragmentList.push(`firmware ${snapshot.firmwareVersion}`);
  }
  if (fragmentList.length === 0) {
    return '';
  }
  return `\n\nEstado del dispositivo: ${fragmentList.join(', ')}.`;
}

export type LowBatteryEvaluationInput = {
  readonly snapshot: DeskTelemetrySnapshot;
  readonly lastAnnounceAtMilliseconds: number | null;
  readonly nowMilliseconds: number;
};

export type LowBatteryEvaluation = {
  readonly shouldAnnounce: boolean;
  readonly shouldRearm: boolean;
  readonly message?: string;
};

export function evaluateLowBatteryAnnouncement(
  input: LowBatteryEvaluationInput,
): LowBatteryEvaluation {
  const { snapshot, lastAnnounceAtMilliseconds, nowMilliseconds } = input;
  if (snapshot.battery === undefined) {
    return { shouldAnnounce: false, shouldRearm: false };
  }
  const isRecovered =
    snapshot.charging === true || snapshot.battery >= LOW_BATTERY_REARM_THRESHOLD_PERCENT;
  if (isRecovered) {
    return { shouldAnnounce: false, shouldRearm: lastAnnounceAtMilliseconds !== null };
  }
  if (snapshot.battery > LOW_BATTERY_ANNOUNCE_THRESHOLD_PERCENT) {
    return { shouldAnnounce: false, shouldRearm: false };
  }
  const isCoolingDown =
    lastAnnounceAtMilliseconds !== null &&
    nowMilliseconds - lastAnnounceAtMilliseconds < LOW_BATTERY_ANNOUNCE_COOLDOWN_MS;
  if (isCoolingDown) {
    return { shouldAnnounce: false, shouldRearm: false };
  }
  return {
    shouldAnnounce: true,
    shouldRearm: false,
    message: `Estás con ${snapshot.battery}% de batería, enchufame.`,
  };
}

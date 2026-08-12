import { Empty } from '@/blueprint/empty';
import type { TelemetrySnapshot } from '@/agent/schema';

const TELEMETRY_STALE_AFTER_MS = 5 * 60_000;

function formatAgeLabel(receivedAtMs: number, nowMilliseconds: number): string {
  const ageMinutes = Math.round((nowMilliseconds - receivedAtMs) / 60_000);
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
}

function Reading({
  label,
  value,
  detail,
}: {
  readonly label: string;
  readonly value: string;
  readonly detail?: string;
}) {
  return (
    <div className="bg-panel p-4">
      <p className="label-soft text-faint">{label}</p>
      <p className="mt-2 font-mono text-2xl">{value}</p>
      {detail !== undefined && <p className="mt-1 text-xs text-muted">{detail}</p>}
    </div>
  );
}

export function TelemetryGrid({
  telemetry,
  nowMilliseconds,
}: {
  readonly telemetry: TelemetrySnapshot | null;
  readonly nowMilliseconds: number;
}) {
  if (telemetry === null) {
    return <Empty message="No telemetry received yet" />;
  }
  const isStale = nowMilliseconds - telemetry.receivedAtMs > TELEMETRY_STALE_AFTER_MS;
  return (
    <div>
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-4">
        <Reading
          label="Battery"
          value={telemetry.battery === undefined ? '—' : `${telemetry.battery}%`}
          detail={
            telemetry.charging === undefined
              ? undefined
              : telemetry.charging
                ? 'Charging'
                : 'On battery'
          }
        />
        <Reading
          label="Wi-Fi"
          value={telemetry.wifiRssi === undefined ? '—' : `${telemetry.wifiRssi} dBm`}
        />
        <Reading
          label="Volume"
          value={telemetry.volume === undefined ? '—' : String(telemetry.volume)}
        />
        <Reading label="Firmware" value={telemetry.firmwareVersion ?? '—'} />
      </div>
      <p className="mt-2.5 text-xs text-faint">
        Snapshot {formatAgeLabel(telemetry.receivedAtMs, nowMilliseconds)}
        {isStale && ' — stale; the device pushes telemetry only while connected'}
      </p>
    </div>
  );
}

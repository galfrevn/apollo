import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/components/utility';
import { navigateToRoute } from '@/router/route';
import type { ApolloAgentState, ConsoleStatus } from '@/agent/schema';
import type { ConsoleRoute } from '@/router/route';

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

function capitalizeFirstLetter(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function Tile({
  label,
  value,
  detail,
  route,
  isLoading,
}: {
  readonly label: string;
  readonly value: string;
  readonly detail?: string;
  readonly route?: ConsoleRoute;
  readonly isLoading?: boolean;
}) {
  const tileClass = cn(
    'flex min-h-[110px] flex-col justify-between border bg-card p-5 text-left transition-all duration-300',
    route !== undefined && 'cursor-pointer hover:border-border-hover hover:bg-card-hover',
  );
  const tileBody = (
    <>
      <p className="text-xs text-muted-foreground">{label}</p>
      {isLoading ? (
        <div className="flex h-7 items-center">
          <Skeleton className="h-5 w-16" />
        </div>
      ) : (
        <p className="truncate text-xl font-medium">
          {value}
          {detail !== undefined && (
            <span className="ml-2 text-xs font-normal text-muted-foreground">
              {detail}
            </span>
          )}
        </p>
      )}
    </>
  );
  if (route === undefined) {
    return <article className={tileClass}>{tileBody}</article>;
  }
  const targetRoute = route;
  return (
    <button
      type="button"
      onClick={() => navigateToRoute(targetRoute)}
      className={tileClass}
    >
      {tileBody}
    </button>
  );
}

export function TileGrid({
  agentState,
  status,
}: {
  readonly agentState: ApolloAgentState | undefined;
  readonly status: ConsoleStatus | null;
}) {
  const isLoading = status === null;
  const telemetry = status?.telemetry ?? null;
  const nowMilliseconds = status?.nowMilliseconds ?? Date.now();
  const isStale =
    telemetry !== null &&
    nowMilliseconds - telemetry.receivedAtMs > TELEMETRY_STALE_AFTER_MS;

  return (
    <section className="space-y-2.5">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Tile
          label="Device"
          isLoading={isLoading}
          value={status?.isDeviceConnected ? 'Online' : 'Offline'}
          detail={
            status !== null && status.deviceConnectionCount > 1
              ? `${status.deviceConnectionCount} links`
              : undefined
          }
        />
        <Tile
          label="Agent"
          isLoading={agentState === undefined}
          value={
            agentState === undefined ? '—' : capitalizeFirstLetter(agentState.uiState)
          }
          detail={agentState?.speechMode}
          route="history"
        />
        <Tile
          label="Battery"
          isLoading={isLoading}
          value={telemetry?.battery === undefined ? '—' : `${telemetry.battery}%`}
          detail={
            telemetry?.charging === undefined
              ? undefined
              : telemetry.charging
                ? 'Charging'
                : 'On battery'
          }
        />
        <Tile
          label="Wi-Fi"
          isLoading={isLoading}
          value={telemetry?.wifiRssi === undefined ? '—' : `${telemetry.wifiRssi} dBm`}
        />
        <Tile
          label="Reminders"
          isLoading={isLoading}
          value={status === null ? '—' : String(status.pendingReminderCount)}
          detail="pending"
          route="schedules"
        />
        <Tile
          label="Firmware"
          isLoading={isLoading}
          value={telemetry?.firmwareVersion ?? '—'}
          detail={
            telemetry?.volume === undefined ? undefined : `Volume ${telemetry.volume}`
          }
        />
      </div>
      {telemetry !== null && (
        <p className="text-xs text-dim">
          Snapshot {formatAgeLabel(telemetry.receivedAtMs, nowMilliseconds)}
          {isStale && ' — stale; the device pushes telemetry only while connected'}
        </p>
      )}
    </section>
  );
}

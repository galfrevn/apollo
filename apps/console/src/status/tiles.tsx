import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/components/utility';

import { navigateToRoute } from '@/router/route';
import { STATUS_MESSAGES } from '@/status/copy';
import type { ApolloAgentState, ConsoleStatus } from '@/agent/schema';
import type { ConsoleRoute } from '@/router/route';

const TELEMETRY_STALE_AFTER_MS = 5 * 60_000;

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
  const statusMessages = STATUS_MESSAGES;
  const tileMessages = statusMessages.tiles;
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
          label={tileMessages.deviceLabel}
          isLoading={isLoading}
          value={
            status?.isDeviceConnected
              ? tileMessages.deviceOnlineValue
              : tileMessages.deviceOfflineValue
          }
          detail={
            status !== null && status.deviceConnectionCount > 1
              ? tileMessages.deviceLinksDetail(status.deviceConnectionCount)
              : undefined
          }
        />
        <Tile
          label={tileMessages.agentLabel}
          isLoading={agentState === undefined}
          value={
            agentState === undefined
              ? '—'
              : capitalizeFirstLetter(
                  statusMessages.agentActivityLabelMap[agentState.uiState],
                )
          }
          detail={agentState?.speechMode}
          route="history"
        />
        <Tile
          label={tileMessages.batteryLabel}
          isLoading={isLoading}
          value={telemetry?.battery === undefined ? '—' : `${telemetry.battery}%`}
          detail={
            telemetry?.charging === undefined
              ? undefined
              : telemetry.charging
                ? tileMessages.chargingDetail
                : tileMessages.onBatteryDetail
          }
        />
        <Tile
          label={tileMessages.wifiLabel}
          isLoading={isLoading}
          value={telemetry?.wifiRssi === undefined ? '—' : `${telemetry.wifiRssi} dBm`}
        />
        <Tile
          label={tileMessages.remindersLabel}
          isLoading={isLoading}
          value={status === null ? '—' : String(status.pendingReminderCount)}
          detail={tileMessages.remindersPendingDetail}
          route="schedules"
        />
        <Tile
          label={tileMessages.firmwareLabel}
          isLoading={isLoading}
          value={telemetry?.firmwareVersion ?? '—'}
          detail={
            telemetry?.volume === undefined
              ? undefined
              : tileMessages.volumeDetail(telemetry.volume)
          }
        />
      </div>
      {telemetry !== null && (
        <p className="text-xs text-dim">
          {tileMessages.snapshotLine(
            tileMessages.formatSnapshotAge(
              Math.round((nowMilliseconds - telemetry.receivedAtMs) / 60_000),
            ),
          )}
          {isStale && tileMessages.staleSuffix}
        </p>
      )}
    </section>
  );
}

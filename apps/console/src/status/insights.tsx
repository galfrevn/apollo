import { Skeleton } from '@/components/ui/skeleton';
import { useConnection } from '@/connection/context';
import { navigateToRoute } from '@/router/hash';
import type { ApolloAgentState, ConsoleStatus } from '@/agent/schema';
import type { ConsoleRoute } from '@/router/hash';

type InsightSegment = string | { readonly label: string; readonly route?: ConsoleRoute };

type Insight = {
  readonly id: string;
  readonly segmentList: readonly InsightSegment[];
};

function resolveGreetingLabel(hourOfDay: number): string {
  if (hourOfDay < 12) {
    return 'Good morning';
  }
  if (hourOfDay < 19) {
    return 'Good afternoon';
  }
  return 'Good evening';
}

function buildInsightList(
  agentState: ApolloAgentState | undefined,
  status: ConsoleStatus,
): readonly Insight[] {
  const insightList: Insight[] = [];

  if (status.isDeviceConnected) {
    const deviceSegmentList: InsightSegment[] = ['The desk is ', { label: 'online' }];
    if (status.deviceConnectionCount > 1) {
      deviceSegmentList.push(` with ${status.deviceConnectionCount} device links`);
    }
    deviceSegmentList.push('.');
    insightList.push({ id: 'device', segmentList: deviceSegmentList });
  } else {
    insightList.push({
      id: 'device',
      segmentList: [
        'The desk is ',
        { label: 'offline' },
        ' — telemetry pauses until it reconnects.',
      ],
    });
  }

  const batteryLevel = status.telemetry?.battery;
  if (batteryLevel !== undefined) {
    const isCharging = status.telemetry?.charging;
    insightList.push({
      id: 'battery',
      segmentList: [
        'Battery at ',
        { label: `${batteryLevel}%` },
        isCharging === undefined ? '.' : isCharging ? ', charging.' : ', on battery.',
      ],
    });
  }

  if (status.pendingReminderCount > 0) {
    const reminderNoun = status.pendingReminderCount === 1 ? 'reminder' : 'reminders';
    insightList.push({
      id: 'reminders',
      segmentList: [
        'There ',
        status.pendingReminderCount === 1 ? 'is ' : 'are ',
        {
          label: `${status.pendingReminderCount} ${reminderNoun}`,
          route: 'schedules',
        },
        ' waiting to fire.',
      ],
    });
  } else {
    insightList.push({
      id: 'reminders',
      segmentList: ['Nothing on the ', { label: 'schedule', route: 'schedules' }, '.'],
    });
  }

  if (agentState !== undefined && agentState.uiState !== 'idle') {
    insightList.push({
      id: 'agent',
      segmentList: ['The agent is ', { label: agentState.uiState }, ' right now.'],
    });
  }

  return insightList;
}

function InsightFragment({ segment }: { readonly segment: InsightSegment }) {
  if (typeof segment === 'string') {
    return segment;
  }
  const fragmentClass =
    'border-b border-dashed border-muted-foreground/40 text-foreground';
  if (segment.route === undefined) {
    return <span className={fragmentClass}>{segment.label}</span>;
  }
  const targetRoute = segment.route;
  return (
    <button
      type="button"
      onClick={() => navigateToRoute(targetRoute)}
      className={`${fragmentClass} transition-colors duration-150 hover:border-muted-foreground`}
    >
      {segment.label}
    </button>
  );
}

export function Insights({
  agentState,
  status,
}: {
  readonly agentState: ApolloAgentState | undefined;
  readonly status: ConsoleStatus | null;
}) {
  const { connection } = useConnection();
  const greetingLabel = resolveGreetingLabel(new Date().getHours());

  return (
    <section className="space-y-5 text-center">
      <h1 className="font-serif text-[38px] leading-tight">
        {greetingLabel}
        {connection !== null && (
          <span className="text-muted-foreground">, {connection.deviceName}</span>
        )}
      </h1>
      {status === null ? (
        <ul className="space-y-1.5">
          {[64, 72, 52].map((lineWidth) => (
            <li key={lineWidth} className="flex h-[23px] items-center justify-center">
              <Skeleton className="h-3.5" style={{ width: `${lineWidth * 4}px` }} />
            </li>
          ))}
        </ul>
      ) : (
        <ul className="space-y-1.5">
          {buildInsightList(agentState, status).map((insight) => (
            <li
              key={insight.id}
              className="text-sm leading-relaxed text-muted-foreground"
            >
              {insight.segmentList.map((segment, segmentIndex) => (
                <InsightFragment key={segmentIndex} segment={segment} />
              ))}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

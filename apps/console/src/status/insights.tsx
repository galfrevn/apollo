import { Skeleton } from '@/components/ui/skeleton';
import { useConnection } from '@/connection/context';

import { navigateToRoute } from '@/router/route';
import { STATUS_MESSAGES } from '@/status/copy';
import type { ApolloAgentState, ConsoleStatus } from '@/agent/schema';
import type { InsightSegment, StatusMessages } from '@/status/copy';

type Insight = {
  readonly id: string;
  readonly segmentList: readonly InsightSegment[];
};

function buildInsightList(
  agentState: ApolloAgentState | undefined,
  status: ConsoleStatus,
  statusMessages: StatusMessages,
): readonly Insight[] {
  const insightList: Insight[] = [];

  insightList.push({
    id: 'device',
    segmentList: status.isDeviceConnected
      ? statusMessages.insights.deviceOnline(status.deviceConnectionCount)
      : statusMessages.insights.deviceOffline,
  });

  const batteryLevel = status.telemetry?.battery;
  if (batteryLevel !== undefined) {
    insightList.push({
      id: 'battery',
      segmentList: statusMessages.insights.battery(
        batteryLevel,
        status.telemetry?.charging,
      ),
    });
  }

  insightList.push({
    id: 'reminders',
    segmentList:
      status.pendingReminderCount > 0
        ? statusMessages.insights.pendingReminders(status.pendingReminderCount)
        : statusMessages.insights.emptySchedule,
  });

  if (agentState !== undefined && agentState.uiState !== 'idle') {
    insightList.push({
      id: 'agent',
      segmentList: statusMessages.insights.agentBusy(
        statusMessages.agentActivityLabelMap[agentState.uiState],
      ),
    });
  }

  return insightList;
}

function InsightFragment({ segment }: { readonly segment: InsightSegment }) {
  if (segment.kind === 'plain') {
    return segment.text;
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
  const statusMessages = STATUS_MESSAGES;
  const greetingLabel = statusMessages.resolveGreeting(new Date().getHours());

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
          {buildInsightList(agentState, status, statusMessages).map((insight) => (
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

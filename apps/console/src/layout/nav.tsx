import type { IconType } from 'react-icons';

import { Icons } from '@/components/icons';
import { cn } from '@/components/utility';
import { useConnection } from '@/connection/context';
import { LAYOUT_MESSAGES } from '@/layout/copy';

import { CONSOLE_ROUTE_LIST, navigateToRoute, useConsoleRoute } from '@/router/route';
import { ROUTE_LABEL_MAP } from '@/router/metadata';
import type { ConsoleRoute } from '@/router/route';

export const ROUTE_ICON_MAP = {
  status: Icons.Status,
  device: Icons.Device,
  broadcast: Icons.Broadcast,
  mcp: Icons.Mcp,
  memory: Icons.Memory,
  schedules: Icons.Schedules,
  history: Icons.History,
  jobs: Icons.Jobs,
} satisfies Record<ConsoleRoute, IconType>;

function Rail({
  isExpanded,
  onExpandedChange,
}: {
  readonly isExpanded: boolean;
  readonly onExpandedChange: (isNowExpanded: boolean) => void;
}) {
  const activeRoute = useConsoleRoute();
  const { connection } = useConnection();
  const layoutMessages = LAYOUT_MESSAGES;
  const routeLabelMap = ROUTE_LABEL_MAP;
  const deviceName = connection?.deviceName ?? '';
  const workerHost = connection === null ? '' : new URL(connection.workerUrl).host;
  const revealClass = cn(
    'whitespace-nowrap transition-opacity duration-200',
    isExpanded ? 'opacity-100' : 'opacity-0',
  );

  return (
    <aside
      onMouseEnter={() => onExpandedChange(true)}
      onMouseLeave={() => onExpandedChange(false)}
      onFocus={() => onExpandedChange(true)}
      onBlur={() => onExpandedChange(false)}
      className={cn(
        'fixed inset-y-0 left-0 z-50 hidden flex-col border-r bg-background transition-all duration-200 ease-[cubic-bezier(0.4,0,0.2,1)] md:flex',
        isExpanded ? 'w-60' : 'w-[70px]',
      )}
    >
      <div className="flex h-[70px] shrink-0 items-center overflow-hidden border-b">
        <span className="flex w-[70px] shrink-0 items-center justify-center">
          <Icons.LogoMark size={22} />
        </span>
        <span className={cn('text-sm font-medium', revealClass)}>Apollo Console</span>
      </div>

      <nav
        aria-label={layoutMessages.navigationAriaLabel}
        className="flex-1 overflow-hidden pt-4"
      >
        <ul className="space-y-1.5">
          {CONSOLE_ROUTE_LIST.map((route) => {
            const isActive = route === activeRoute;
            const RouteIcon = ROUTE_ICON_MAP[route];
            return (
              <li key={route} className="px-[15px]">
                <button
                  type="button"
                  onClick={() => navigateToRoute(route)}
                  aria-current={isActive ? 'page' : undefined}
                  className={cn(
                    'flex h-10 items-center overflow-hidden border text-left transition-all duration-200',
                    isExpanded ? 'w-full' : 'w-10',
                    isActive
                      ? 'border-border bg-active text-foreground'
                      : 'border-transparent text-dim hover:text-foreground',
                  )}
                >
                  <span className="flex w-[38px] shrink-0 items-center justify-center">
                    <RouteIcon size={20} />
                  </span>
                  <span className={cn('text-sm font-medium', revealClass)}>
                    {routeLabelMap[route]}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="flex h-[70px] shrink-0 items-center overflow-hidden border-t">
        <span className="flex w-[70px] shrink-0 items-center justify-center">
          <span className="flex size-8 items-center justify-center border bg-accent text-xs font-medium">
            {deviceName.charAt(0).toUpperCase()}
          </span>
        </span>
        <div className={cn('min-w-0 pr-3', revealClass)}>
          <p className="truncate text-xs font-medium">{deviceName}</p>
          <p className="truncate text-xs text-dim">{workerHost}</p>
        </div>
      </div>
    </aside>
  );
}

function MobileRow() {
  const activeRoute = useConsoleRoute();
  const layoutMessages = LAYOUT_MESSAGES;
  const routeLabelMap = ROUTE_LABEL_MAP;
  return (
    <nav aria-label={layoutMessages.navigationAriaLabel} className="md:hidden">
      <ul className="scrollbar-hide flex gap-1 overflow-x-auto px-4 pt-4">
        {CONSOLE_ROUTE_LIST.map((route) => {
          const isActive = route === activeRoute;
          const RouteIcon = ROUTE_ICON_MAP[route];
          return (
            <li key={route}>
              <button
                type="button"
                onClick={() => navigateToRoute(route)}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  'flex h-9 items-center gap-2 border px-3 text-sm font-medium whitespace-nowrap transition-colors duration-150',
                  isActive
                    ? 'border-border bg-active text-foreground'
                    : 'border-transparent text-dim hover:text-foreground',
                )}
              >
                <RouteIcon size={16} />
                {routeLabelMap[route]}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function Nav({
  isRailExpanded,
  onRailExpandedChange,
}: {
  readonly isRailExpanded: boolean;
  readonly onRailExpandedChange: (isNowExpanded: boolean) => void;
}) {
  return (
    <>
      <Rail isExpanded={isRailExpanded} onExpandedChange={onRailExpandedChange} />
      <MobileRow />
    </>
  );
}

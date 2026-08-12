import { cn } from '@/components/utility';
import { CONSOLE_ROUTE_LIST, navigateToRoute, useConsoleRoute } from '@/router/hash';
import type { ConsoleRoute } from '@/router/hash';

const ROUTE_LABEL_MAP: Record<ConsoleRoute, string> = {
  status: 'Status',
  mcp: 'MCP',
  memory: 'Memory',
  schedules: 'Schedules',
  history: 'History',
  jobs: 'Jobs',
};

export function Nav() {
  const activeRoute = useConsoleRoute();
  return (
    <nav aria-label="Console sections" className="px-4 pt-4 lg:px-0 lg:pt-6 lg:pl-6">
      <ul className="flex gap-1 overflow-x-auto lg:flex-col">
        {CONSOLE_ROUTE_LIST.map((route) => {
          const isActive = route === activeRoute;
          return (
            <li key={route}>
              <button
                type="button"
                onClick={() => navigateToRoute(route)}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  'group flex h-9 w-full items-center gap-2.5 rounded-lg px-3 text-left text-sm font-medium whitespace-nowrap transition-colors duration-150',
                  isActive
                    ? 'bg-raised text-ink'
                    : 'text-muted hover:bg-panel hover:text-ink',
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    'size-1.5 rounded-[1px] transition-colors duration-150',
                    isActive ? 'bg-amber' : 'bg-line group-hover:bg-faint',
                  )}
                />
                {ROUTE_LABEL_MAP[route]}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

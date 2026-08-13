import { useEffect, useState } from 'react';

import { Icons } from '@/components/icons';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { ROUTE_ICON_MAP, ROUTE_LABEL_MAP } from '@/layout/nav';
import { CONSOLE_ROUTE_LIST, navigateToRoute } from '@/router/hash';
import type { ConsoleRoute } from '@/router/hash';

export function Search() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
        event.preventDefault();
        setIsOpen((wasOpen) => !wasOpen);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const normalizedQuery = query.trim().toLowerCase();
  const matchingRouteList = CONSOLE_ROUTE_LIST.filter((route) =>
    ROUTE_LABEL_MAP[route].toLowerCase().includes(normalizedQuery),
  );

  function handleSelectRoute(route: ConsoleRoute) {
    setIsOpen(false);
    setQuery('');
    navigateToRoute(route);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="flex h-9 items-center gap-2 text-sm text-muted-foreground transition-colors duration-150 hover:text-foreground md:min-w-[250px]"
      >
        <Icons.Search size={18} />
        <span className="hidden md:inline">Search sections</span>
        <kbd className="ml-auto hidden h-5 items-center border bg-accent px-1.5 font-sans text-[10px] text-muted-foreground md:inline-flex">
          ⌘K
        </kbd>
      </button>

      <Dialog
        open={isOpen}
        onOpenChange={(isNowOpen) => {
          setIsOpen(isNowOpen);
          if (!isNowOpen) {
            setQuery('');
          }
        }}
      >
        <DialogContent className="top-[20%] translate-y-0 p-0">
          <DialogTitle className="sr-only">Search sections</DialogTitle>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              const firstMatch = matchingRouteList[0];
              if (firstMatch !== undefined) {
                handleSelectRoute(firstMatch);
              }
            }}
            className="flex items-center gap-3 border-b px-4 pr-12"
          >
            <Icons.Search size={18} className="shrink-0 text-dim" />
            <input
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search sections…"
              aria-label="Search sections"
              className="h-12 w-full bg-transparent text-sm text-foreground outline-none"
            />
          </form>
          <ul className="p-2">
            {matchingRouteList.length === 0 ? (
              <li className="px-3 py-6 text-center text-xs text-dim">Nothing matches</li>
            ) : (
              matchingRouteList.map((route) => {
                const RouteIcon = ROUTE_ICON_MAP[route];
                return (
                  <li key={route}>
                    <button
                      type="button"
                      onClick={() => handleSelectRoute(route)}
                      className="flex h-10 w-full items-center gap-3 px-3 text-left text-sm text-muted-foreground transition-colors duration-150 hover:bg-accent hover:text-foreground"
                    >
                      <RouteIcon size={16} />
                      {ROUTE_LABEL_MAP[route]}
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </DialogContent>
      </Dialog>
    </>
  );
}

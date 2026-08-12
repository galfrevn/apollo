import { createContext, useCallback, useContext, useState } from 'react';
import type { ReactNode } from 'react';

import {
  clearStoredConnection,
  loadStoredConnection,
  saveStoredConnection,
} from '@/connection/storage';
import type { ConsoleConnection } from '@/connection/schema';

type ConnectionContextValue = {
  readonly connection: ConsoleConnection | null;
  readonly connect: (connection: ConsoleConnection) => void;
  readonly disconnect: () => void;
};

const ConnectionContext = createContext<ConnectionContextValue | null>(null);

export function ConnectionProvider({ children }: { readonly children: ReactNode }) {
  const [connection, setConnection] = useState<ConsoleConnection | null>(() =>
    loadStoredConnection(window.localStorage),
  );

  const connect = useCallback((nextConnection: ConsoleConnection) => {
    saveStoredConnection(window.localStorage, nextConnection);
    setConnection(nextConnection);
  }, []);

  const disconnect = useCallback(() => {
    clearStoredConnection(window.localStorage);
    setConnection(null);
  }, []);

  return (
    <ConnectionContext value={{ connection, connect, disconnect }}>
      {children}
    </ConnectionContext>
  );
}

export function useConnection(): ConnectionContextValue {
  const contextValue = useContext(ConnectionContext);
  if (contextValue === null) {
    throw new Error('useConnection requires a ConnectionProvider');
  }
  return contextValue;
}

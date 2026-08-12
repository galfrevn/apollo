import { consoleConnectionSchema } from '@/connection/schema';
import type { ConsoleConnection } from '@/connection/schema';

const CONNECTION_STORAGE_KEY = 'apollo-console-connection';

export function loadStoredConnection(storage: Storage): ConsoleConnection | null {
  const storedValue = storage.getItem(CONNECTION_STORAGE_KEY);
  if (storedValue === null) {
    return null;
  }
  try {
    const parsedConnection = consoleConnectionSchema.safeParse(JSON.parse(storedValue));
    return parsedConnection.success ? parsedConnection.data : null;
  } catch {
    return null;
  }
}

export function saveStoredConnection(
  storage: Storage,
  connection: ConsoleConnection,
): void {
  storage.setItem(CONNECTION_STORAGE_KEY, JSON.stringify(connection));
}

export function clearStoredConnection(storage: Storage): void {
  storage.removeItem(CONNECTION_STORAGE_KEY);
}

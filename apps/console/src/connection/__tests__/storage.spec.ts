import { describe, expect, it } from 'bun:test';

import {
  clearStoredConnection,
  loadStoredConnection,
  saveStoredConnection,
} from '@/connection/storage';

function createInMemoryStorage(): Storage {
  const valueMap = new Map<string, string>();
  return {
    get length() {
      return valueMap.size;
    },
    clear: () => valueMap.clear(),
    getItem: (key: string) => valueMap.get(key) ?? null,
    key: (index: number) => [...valueMap.keys()][index] ?? null,
    removeItem: (key: string) => {
      valueMap.delete(key);
    },
    setItem: (key: string, value: string) => {
      valueMap.set(key, value);
    },
  };
}

describe('console connection storage', () => {
  it('round-trips a saved connection', () => {
    const storage = createInMemoryStorage();
    saveStoredConnection(storage, {
      workerUrl: 'https://apollo.example.workers.dev',
      deviceName: 'desk',
      secret: 'dashboard-secret',
    });
    expect(loadStoredConnection(storage)).toEqual({
      workerUrl: 'https://apollo.example.workers.dev',
      deviceName: 'desk',
      secret: 'dashboard-secret',
    });
  });

  it('returns null for missing or corrupt stored values', () => {
    const storage = createInMemoryStorage();
    expect(loadStoredConnection(storage)).toBeNull();
    storage.setItem('apollo-console-connection', 'not-json');
    expect(loadStoredConnection(storage)).toBeNull();
  });

  it('clears a stored connection', () => {
    const storage = createInMemoryStorage();
    saveStoredConnection(storage, {
      workerUrl: 'https://apollo.example.workers.dev',
      deviceName: 'desk',
      secret: 'dashboard-secret',
    });
    clearStoredConnection(storage);
    expect(loadStoredConnection(storage)).toBeNull();
  });
});

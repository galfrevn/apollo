import { describe, expect, test } from 'bun:test';
import { Database } from 'bun:sqlite';

import { createBunDurableStorageShim } from '@/platform/bun/storage';

describe('createBunDurableStorageShim', () => {
  test('round-trips json values through get/put/delete', async () => {
    const storageShim = createBunDurableStorageShim(new Database(':memory:'));

    await storageShim.put('oauth/token', { accessToken: 'abc', expiresIn: 3600 });
    await expect(storageShim.get('oauth/token')).resolves.toEqual({
      accessToken: 'abc',
      expiresIn: 3600,
    });

    await expect(storageShim.delete('oauth/token')).resolves.toBe(true);
    await expect(storageShim.get('oauth/token')).resolves.toBeUndefined();
    await expect(storageShim.delete('oauth/token')).resolves.toBe(false);
  });

  test('supports batch put, batch delete, and prefix listing', async () => {
    const storageShim = createBunDurableStorageShim(new Database(':memory:'));

    await storageShim.put({
      'apollo/server-1/token': 't1',
      'apollo/server-2/token': 't2',
      'other/key': 'x',
    });

    const listedEntries = await storageShim.list({ prefix: 'apollo/' });
    expect([...listedEntries.keys()]).toEqual([
      'apollo/server-1/token',
      'apollo/server-2/token',
    ]);

    await expect(storageShim.delete(['apollo/server-1/token', 'missing'])).resolves.toBe(
      1,
    );
  });

  test('sql.exec runs ddl and parameterized selects like the durable object storage', () => {
    const storageShim = createBunDurableStorageShim(new Database(':memory:'));

    const createResultList = [
      ...storageShim.sql.exec(
        'CREATE TABLE IF NOT EXISTS spike_probe_table (id TEXT PRIMARY KEY, name TEXT)',
      ),
    ];
    expect(createResultList).toEqual([]);
    const insertResultList = [
      ...storageShim.sql.exec(
        "INSERT INTO spike_probe_table (id, name) VALUES ('s1', 'linear')",
      ),
    ];
    expect(insertResultList).toEqual([]);
    const rowList = [
      ...storageShim.sql.exec(
        'SELECT id, name FROM spike_probe_table WHERE id = ?',
        's1',
      ),
    ];
    expect(rowList).toEqual([{ id: 's1', name: 'linear' }]);
  });
});

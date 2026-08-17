import type { Database } from 'bun:sqlite';

const KEY_VALUE_TABLE_DDL =
  'CREATE TABLE IF NOT EXISTS host_kv (key TEXT PRIMARY KEY, value_json TEXT NOT NULL)';

// On Cloudflare the Agent base class owns this DDL; MCPClientManager assumes
// the table exists before restoreConnectionsFromStorage. Copied verbatim from
// agents@0.20.x dist so a version bump that reshapes it fails the pinned spec.
const MCP_SERVERS_TABLE_DDL = `CREATE TABLE IF NOT EXISTS cf_agents_mcp_servers (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  server_url TEXT NOT NULL,
  callback_url TEXT NOT NULL,
  client_id TEXT,
  auth_url TEXT,
  server_options TEXT
)`;

// The exact DurableObjectStorage surface MCPClientManager and its OAuth
// provider touch (verified against agents@0.20.x dist): an iterable
// `sql.exec`, and the async key-value get/put/delete/list quartet. Values are
// JSON documents (tokens, client registrations, discovery state).
export type DurableStorageShim = {
  readonly sql: {
    exec(query: string, ...bindValues: unknown[]): Iterable<Record<string, unknown>>;
  };
  get(key: string): Promise<unknown>;
  put(key: string, value: unknown): Promise<void>;
  put(entries: Record<string, unknown>): Promise<void>;
  delete(key: string): Promise<boolean>;
  delete(keys: string[]): Promise<number>;
  list(options?: { readonly prefix?: string }): Promise<Map<string, unknown>>;
};

export function createBunDurableStorageShim(database: Database): DurableStorageShim {
  database.run(KEY_VALUE_TABLE_DDL);
  database.run(MCP_SERVERS_TABLE_DDL);

  function readRow(key: string): { value_json: string } | undefined {
    const rowList = database
      .query('SELECT value_json FROM host_kv WHERE key = ?')
      .all(key) as { value_json: string }[];
    return rowList[0];
  }

  function writeRow(key: string, value: unknown): void {
    database.run(
      'INSERT INTO host_kv (key, value_json) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json',
      [key, JSON.stringify(value ?? null)],
    );
  }

  function deleteRow(key: string): boolean {
    const existingRow = readRow(key);
    database.run('DELETE FROM host_kv WHERE key = ?', [key]);
    return existingRow !== undefined;
  }

  async function putEntry(
    keyOrEntries: string | Record<string, unknown>,
    value?: unknown,
  ): Promise<void> {
    if (typeof keyOrEntries === 'string') {
      writeRow(keyOrEntries, value);
      return;
    }
    for (const [entryKey, entryValue] of Object.entries(keyOrEntries)) {
      writeRow(entryKey, entryValue);
    }
  }

  async function deleteEntry(keyOrKeys: string | string[]): Promise<boolean & number> {
    if (typeof keyOrKeys === 'string') {
      // SAFETY: the overloaded DO signature returns boolean for a single key
      // and number for a batch; a single implementation must satisfy both.
      return deleteRow(keyOrKeys) as boolean & number;
    }
    let deletedCount = 0;
    for (const key of keyOrKeys) {
      if (deleteRow(key)) {
        deletedCount += 1;
      }
    }
    return deletedCount as boolean & number;
  }

  return {
    sql: {
      exec(query, ...bindValues) {
        // SAFETY: callers bind only SQLite-compatible scalars, matching the
        // durable object contract this shim stands in for.
        return database
          .query(query)
          .all(...(bindValues as (string | number | null)[])) as Record<
          string,
          unknown
        >[];
      },
    },
    async get(key) {
      const row = readRow(key);
      if (row === undefined) {
        return undefined;
      }
      return JSON.parse(row.value_json);
    },
    put: putEntry,
    delete: deleteEntry,
    async list(options) {
      const prefix = options?.prefix ?? '';
      const rowList = database
        .query("SELECT key, value_json FROM host_kv WHERE key GLOB ? || '*' ORDER BY key")
        .all(prefix) as { key: string; value_json: string }[];
      return new Map(rowList.map((row) => [row.key, JSON.parse(row.value_json)]));
    },
  };
}

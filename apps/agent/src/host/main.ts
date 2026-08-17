import '@/platform/bun/shims';

import { Database } from 'bun:sqlite';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';

import type { ApolloState } from '@/agents/apollo';
import { createApolloHostActor } from '@/host/actor';
import { parseHostConfiguration } from '@/host/configuration';
import { createHostRunEngine } from '@/host/runs';
import { createApolloHostServer } from '@/host/server';
import { buildApolloSessionManager, compactThreadMessageList } from '@/memory/session';
import { embedTextWithOpenRouter } from '@/memory/vector';
import { createFileBlobStore } from '@/platform/bun/blob';
import { createBunJobQueue } from '@/platform/bun/queue';
import { createBunScheduler } from '@/platform/bun/scheduler';
import { createBunSqliteExecutor, createBunSqliteSqlProvider } from '@/platform/bun/sql';
import { createSqliteVectorStore } from '@/platform/bun/vector';
import { executeApolloQueueJob } from '@/queues/consume';

const HOST_SCHEMA_DDL_LIST = [
  'CREATE TABLE IF NOT EXISTS memories (id TEXT PRIMARY KEY, content TEXT NOT NULL, created_at INTEGER NOT NULL)',
  'CREATE TABLE IF NOT EXISTS session_prefs (key TEXT PRIMARY KEY, value TEXT NOT NULL)',
  'CREATE TABLE IF NOT EXISTS pending_device_messages (id TEXT PRIMARY KEY, type TEXT NOT NULL, payload_json TEXT NOT NULL, created_at INTEGER NOT NULL)',
  'CREATE TABLE IF NOT EXISTS list_items (id TEXT PRIMARY KEY, list_name TEXT NOT NULL, content TEXT NOT NULL, created_at INTEGER NOT NULL)',
  'CREATE TABLE IF NOT EXISTS pending_confirmations (id TEXT PRIMARY KEY, tool_name TEXT NOT NULL, args_json TEXT NOT NULL, summary TEXT NOT NULL, expires_at INTEGER NOT NULL)',
  'CREATE TABLE IF NOT EXISTS mcp_tool_settings (namespaced_name TEXT PRIMARY KEY, server_id TEXT NOT NULL, tool_name TEXT NOT NULL, is_enabled INTEGER NOT NULL, safety TEXT NOT NULL)',
  'CREATE TABLE IF NOT EXISTS thread_meta (session_id TEXT PRIMARY KEY, kind TEXT NOT NULL, summary TEXT, last_turn_at INTEGER NOT NULL)',
];

export type ApolloHost = {
  readonly port: number;
  stop(): void;
};

export async function startApolloHost(
  processEnvironment: Record<string, string | undefined>,
): Promise<ApolloHost> {
  const configuration = parseHostConfiguration(processEnvironment);
  await mkdir(configuration.dataDirectory, { recursive: true });
  const blobDirectory = join(configuration.dataDirectory, 'blobs');
  await mkdir(blobDirectory, { recursive: true });

  const database = new Database(
    join(configuration.dataDirectory, `${configuration.deviceName}.sqlite`),
  );
  database.run('PRAGMA journal_mode = WAL');
  for (const tableDdl of HOST_SCHEMA_DDL_LIST) {
    database.run(tableDdl);
  }

  const sqlExecutor = createBunSqliteExecutor(database);
  const sqlProvider = createBunSqliteSqlProvider(database);
  const mediaBlobStore = createFileBlobStore(blobDirectory);
  const vectorStore = createSqliteVectorStore(database);
  const { environment } = configuration;

  const sessionManager = buildApolloSessionManager({
    sqlProvider,
    getSpeechModeId: () => actor.getState().speechMode,
    skillBucket: {
      async list(options) {
        const listing = await mediaBlobStore.list({ prefix: options.prefix ?? '' });
        return {
          objects: listing.entryList.map((entry) => ({ key: entry.key })),
          truncated: listing.isTruncated,
          ...(listing.cursor === undefined ? {} : { cursor: listing.cursor }),
        };
      },
      async get(objectKey) {
        return mediaBlobStore.get(objectKey);
      },
    },
    compactMessageList: async (messageList) =>
      compactThreadMessageList(environment, messageList),
  });

  const runEngine = createHostRunEngine({
    database,
    environment,
    mediaBlobStore,
    notifyApollo: async (notification) => {
      await actor.notifyBackgroundResult(notification);
    },
  });

  const jobQueue = createBunJobQueue({
    database,
    executeJob: async (job) =>
      executeApolloQueueJob(job, {
        vectorStore,
        runLauncher: runEngine.runLauncher,
        embedText: (text) =>
          embedTextWithOpenRouter({
            openRouterApiKey: environment.OPENROUTER_API_KEY,
            modelId: environment.OPENROUTER_EMBEDDING_MODEL,
            text,
          }),
      }),
  });

  const scheduler = createBunScheduler({
    database,
    dispatch: async (schedule) => actor.dispatchSchedule(schedule),
  });

  const stateBroadcast = {
    notify: (state: ApolloState) => {
      void state;
    },
  };

  const actor = createApolloHostActor({
    deviceName: configuration.deviceName,
    environment,
    sqlExecutor,
    sessionManager,
    scheduler,
    mediaBlobStore,
    vectorStore,
    jobPublisher: jobQueue.publisher,
    onStateChanged: (state) => stateBroadcast.notify(state),
  });

  const server = createApolloHostServer({
    configuration,
    actor,
    mediaBlobStore,
    rpcDependencies: {
      actor,
      deviceName: configuration.deviceName,
      environment,
      sqlExecutor,
      scheduler,
      mediaBlobStore,
      vectorStore,
      jobPublisher: jobQueue.publisher,
    },
  });
  stateBroadcast.notify = (state) => server.broadcastConsoleState(state);

  await actor.start();
  await scheduler.start();
  jobQueue.start();
  await runEngine.resumeIncompleteRuns();

  console.log(
    JSON.stringify({
      level: 'info',
      message: 'apollo_host_started',
      port: server.port,
      deviceName: configuration.deviceName,
      dataDirectory: configuration.dataDirectory,
    }),
  );

  return {
    port: server.port,
    stop() {
      jobQueue.stop();
      scheduler.stop();
      server.stop();
      database.close();
    },
  };
}

if (import.meta.main) {
  void startApolloHost(process.env);
}

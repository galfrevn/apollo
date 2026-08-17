import type { Database } from 'bun:sqlite';

import type { JobPublisher } from '@/platform/jobs';
import { parseApolloQueueJob, type ApolloQueueJob } from '@/queues/jobs';

const JOB_TABLE_DDL = `CREATE TABLE IF NOT EXISTS host_jobs (
  id TEXT PRIMARY KEY,
  payload_json TEXT NOT NULL,
  attempt_count INTEGER NOT NULL DEFAULT 0,
  available_at INTEGER NOT NULL
)`;

const DEFAULT_POLL_INTERVAL_MILLISECONDS = 1_000;
const DEFAULT_MAX_ATTEMPT_COUNT = 5;
const DEFAULT_RETRY_DELAY_MILLISECONDS = 5_000;

export type HostJobQueue = {
  readonly publisher: JobPublisher;
  start(): void;
  stop(): void;
  drainOnce(): Promise<void>;
};

type JobRow = {
  id: string;
  payload_json: string;
  attempt_count: number;
  available_at: number;
};

// The Cloudflare queue's ack/retry semantics on a SQLite table: a job row is
// deleted on success, pushed into the future on failure, and dropped with an
// error log once it exhausts its attempts.
export function createBunJobQueue(input: {
  readonly database: Database;
  readonly executeJob: (job: ApolloQueueJob) => Promise<void>;
  readonly pollIntervalMilliseconds?: number;
  readonly maxAttemptCount?: number;
  readonly retryDelayMilliseconds?: number;
  readonly nowMilliseconds?: () => number;
}): HostJobQueue {
  const { database, executeJob } = input;
  const pollIntervalMilliseconds =
    input.pollIntervalMilliseconds ?? DEFAULT_POLL_INTERVAL_MILLISECONDS;
  const maxAttemptCount = input.maxAttemptCount ?? DEFAULT_MAX_ATTEMPT_COUNT;
  const retryDelayMilliseconds =
    input.retryDelayMilliseconds ?? DEFAULT_RETRY_DELAY_MILLISECONDS;
  const nowMilliseconds = input.nowMilliseconds ?? (() => Date.now());
  database.run(JOB_TABLE_DDL);

  let pollTimer: ReturnType<typeof setInterval> | undefined;
  let isDraining = false;

  async function drainOnce(): Promise<void> {
    if (isDraining) {
      return;
    }
    isDraining = true;
    try {
      const dueRowList = database
        .query(
          'SELECT * FROM host_jobs WHERE available_at <= ? ORDER BY available_at ASC',
        )
        .all(nowMilliseconds()) as JobRow[];
      for (const jobRow of dueRowList) {
        try {
          const job = parseApolloQueueJob(JSON.parse(jobRow.payload_json));
          await executeJob(job);
          database.run('DELETE FROM host_jobs WHERE id = ?', [jobRow.id]);
        } catch (error) {
          const nextAttemptCount = jobRow.attempt_count + 1;
          console.error(
            JSON.stringify({
              level: 'error',
              message: 'apollo_queue_job_failed',
              error: error instanceof Error ? error.message : String(error),
            }),
          );
          if (nextAttemptCount >= maxAttemptCount) {
            database.run('DELETE FROM host_jobs WHERE id = ?', [jobRow.id]);
            console.error(
              JSON.stringify({
                level: 'error',
                message: 'host_job_dropped_after_max_attempts',
                jobId: jobRow.id,
              }),
            );
            continue;
          }
          database.run(
            'UPDATE host_jobs SET attempt_count = ?, available_at = ? WHERE id = ?',
            [
              nextAttemptCount,
              nowMilliseconds() + retryDelayMilliseconds * nextAttemptCount,
              jobRow.id,
            ],
          );
        }
      }
    } finally {
      isDraining = false;
    }
  }

  return {
    publisher: {
      async publish(job) {
        database.run(
          'INSERT INTO host_jobs (id, payload_json, attempt_count, available_at) VALUES (?, ?, 0, ?)',
          [crypto.randomUUID(), JSON.stringify(job), nowMilliseconds()],
        );
      },
    },
    start() {
      if (pollTimer !== undefined) {
        return;
      }
      pollTimer = setInterval(() => {
        void drainOnce();
      }, pollIntervalMilliseconds);
    },
    stop() {
      if (pollTimer !== undefined) {
        clearInterval(pollTimer);
        pollTimer = undefined;
      }
    },
    drainOnce,
  };
}

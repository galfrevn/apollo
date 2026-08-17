import type { Database } from 'bun:sqlite';

import type {
  StepOptions,
  StepRetryPolicy,
  StepRunner,
  StepSerializableValue,
} from '@/platform/steps';

const STEP_TABLE_DDL = `CREATE TABLE IF NOT EXISTS host_workflow_steps (
  instance_id TEXT NOT NULL,
  step_name TEXT NOT NULL,
  result_json TEXT NOT NULL,
  completed_at INTEGER NOT NULL,
  PRIMARY KEY (instance_id, step_name)
)`;

// The Cloudflare memoization contract on a SQLite checkpoint table: a step's
// result is stored under (instanceId, step name); re-running the instance
// replays completed steps from checkpoints instead of executing them again.
export function createSqliteStepRunner(input: {
  readonly database: Database;
  readonly instanceId: string;
  readonly wait?: (milliseconds: number) => Promise<void>;
}): StepRunner {
  const { database, instanceId } = input;
  const wait =
    input.wait ??
    ((milliseconds: number) =>
      new Promise<void>((resolve) => setTimeout(resolve, milliseconds)));
  database.run(STEP_TABLE_DDL);

  function readCheckpoint(stepName: string): { result_json: string } | undefined {
    const rowList = database
      .query(
        'SELECT result_json FROM host_workflow_steps WHERE instance_id = ? AND step_name = ?',
      )
      .all(instanceId, stepName) as { result_json: string }[];
    return rowList[0];
  }

  function writeCheckpoint(stepName: string, result: unknown): void {
    database.run(
      'INSERT OR REPLACE INTO host_workflow_steps (instance_id, step_name, result_json, completed_at) VALUES (?, ?, ?, ?)',
      [instanceId, stepName, JSON.stringify(result ?? null), Date.now()],
    );
  }

  function runStep<Result extends StepSerializableValue>(
    stepName: string,
    callback: () => Promise<Result>,
  ): Promise<Result>;
  function runStep<Result extends StepSerializableValue>(
    stepName: string,
    options: StepOptions,
    callback: () => Promise<Result>,
  ): Promise<Result>;
  async function runStep<Result extends StepSerializableValue>(
    stepName: string,
    optionsOrCallback: StepOptions | (() => Promise<Result>),
    maybeCallback?: () => Promise<Result>,
  ): Promise<Result> {
    const callback =
      typeof optionsOrCallback === 'function' ? optionsOrCallback : maybeCallback;
    if (callback === undefined) {
      throw new Error('runStep requires a callback');
    }
    const options =
      typeof optionsOrCallback === 'function' ? undefined : optionsOrCallback;

    const checkpoint = readCheckpoint(stepName);
    if (checkpoint !== undefined) {
      // SAFETY: the checkpoint was written by this same step's callback on a
      // previous attempt, so the parsed value is the callback's own Result.
      return JSON.parse(checkpoint.result_json) as Result;
    }

    const attemptLimit = options?.retries?.limit ?? 0;
    let attemptIndex = 0;
    for (;;) {
      try {
        const stepResult = await callback();
        writeCheckpoint(stepName, stepResult);
        return stepResult;
      } catch (error) {
        if (attemptIndex >= attemptLimit) {
          throw error;
        }
        await wait(computeRetryDelayMilliseconds(options?.retries, attemptIndex));
        attemptIndex += 1;
      }
    }
  }

  return { do: runStep };
}

function computeRetryDelayMilliseconds(
  retryPolicy: StepRetryPolicy | undefined,
  attemptIndex: number,
): number {
  if (retryPolicy === undefined) {
    return 0;
  }
  if (retryPolicy.backoff === 'exponential') {
    return retryPolicy.delayMilliseconds * 2 ** attemptIndex;
  }
  if (retryPolicy.backoff === 'linear') {
    return retryPolicy.delayMilliseconds * (attemptIndex + 1);
  }
  return retryPolicy.delayMilliseconds;
}

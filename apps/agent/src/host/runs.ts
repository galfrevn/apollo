import type { Database } from 'bun:sqlite';
import { z } from 'zod';

import type { BlobStore } from '@/platform/blob';
import { createSqliteStepRunner } from '@/platform/bun/steps';
import type { RunLauncher } from '@/platform/runs';
import { executeBackgroundResearchRun } from '@/runs/background';
import { executeCodingTaskRun } from '@/runs/coding';

const backgroundRunParamsSchema = z.object({
  prompt: z.string().min(1),
  deviceId: z.string().min(1),
});

const codingRunParamsSchema = z.object({
  repository: z.string().min(1),
  task: z.string().min(1),
  deviceId: z.string().min(1),
});

const RUN_TABLE_DDL = `CREATE TABLE IF NOT EXISTS host_workflow_runs (
  instance_id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  params_json TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at INTEGER NOT NULL
)`;

type RunRow = {
  instance_id: string;
  kind: string;
  params_json: string;
  status: string;
};

export type HostRunEngine = {
  readonly runLauncher: RunLauncher;
  resumeIncompleteRuns(): Promise<void>;
};

// The workflow replacement: every launch persists an instance row, executes
// the portable run body against the checkpointing step runner, and marks the
// outcome. Crash recovery re-executes pending rows on boot — completed steps
// replay from their checkpoints, which is exactly the Cloudflare contract.
export function createHostRunEngine(input: {
  readonly database: Database;
  readonly environment: Env;
  readonly mediaBlobStore: BlobStore;
  readonly notifyApollo: (notification: {
    readonly prompt: string;
    readonly summary: string;
    readonly documentKey?: string;
  }) => Promise<void>;
}): HostRunEngine {
  const { database, environment } = input;
  database.run(RUN_TABLE_DDL);

  async function executeRunInstance(
    instanceId: string,
    kind: string,
    params: unknown,
  ): Promise<void> {
    try {
      const steps = createSqliteStepRunner({ database, instanceId });
      if (kind === 'background') {
        await executeBackgroundResearchRun({
          params: backgroundRunParamsSchema.parse(params),
          instanceId,
          steps,
          dependencies: {
            openRouterApiKey: environment.OPENROUTER_API_KEY,
            researchModelId: environment.OPENROUTER_RESEARCH_MODEL,
            chatModelId: environment.OPENROUTER_MODEL,
            resendApiKey: environment.RESEND_API_KEY,
            ownerEmailAddress: environment.APOLLO_OWNER_EMAIL,
            mediaBlobStore: input.mediaBlobStore,
            notifyApollo: input.notifyApollo,
          },
        });
      } else {
        await executeCodingTaskRun({
          params: codingRunParamsSchema.parse(params),
          instanceId,
          steps,
          dependencies: {
            openRouterApiKey: environment.OPENROUTER_API_KEY,
            codingModelId: environment.OPENROUTER_CODING_MODEL,
            codingEngine: environment.CODING_ENGINE,
            codingProxyOrigin: environment.CODING_PROXY_ORIGIN,
            githubAppId: environment.GITHUB_APP_ID,
            githubAppPrivateKeyPem: environment.GITHUB_APP_PRIVATE_KEY,
            mediaBlobStore: input.mediaBlobStore,
            mintCodingProxyToken: async () => {
              throw new Error('El proxy de coding todavía no corre en este host');
            },
            // The container sandbox arrives with the phase 3 docker adapter;
            // until then coding degrades exactly like a worker without the
            // Sandbox binding.
            createSandbox: undefined,
            notifyApollo: input.notifyApollo,
          },
        });
      }
      database.run(
        "UPDATE host_workflow_runs SET status = 'done' WHERE instance_id = ?",
        [instanceId],
      );
    } catch (error) {
      database.run(
        "UPDATE host_workflow_runs SET status = 'failed' WHERE instance_id = ?",
        [instanceId],
      );
      console.error(
        JSON.stringify({
          level: 'error',
          message: 'host_run_failed',
          instanceId,
          kind,
          error: error instanceof Error ? error.message : String(error),
        }),
      );
    }
  }

  function launchRun(kind: 'background' | 'coding', params: unknown): void {
    const instanceId = crypto.randomUUID();
    database.run(
      "INSERT INTO host_workflow_runs (instance_id, kind, params_json, status, created_at) VALUES (?, ?, ?, 'pending', ?)",
      [instanceId, kind, JSON.stringify(params), Date.now()],
    );
    void executeRunInstance(instanceId, kind, params);
  }

  return {
    runLauncher: {
      async launchBackgroundRun(params) {
        launchRun('background', params);
      },
      async launchCodingRun(params) {
        launchRun('coding', params);
      },
    },
    async resumeIncompleteRuns() {
      const pendingRowList = database
        .query(
          "SELECT * FROM host_workflow_runs WHERE status = 'pending' ORDER BY created_at ASC",
        )
        .all() as RunRow[];
      for (const pendingRow of pendingRowList) {
        await executeRunInstance(
          pendingRow.instance_id,
          pendingRow.kind,
          JSON.parse(pendingRow.params_json),
        );
      }
    },
  };
}

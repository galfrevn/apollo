import type { RunLauncher } from '@/platform/runs';

export function createWorkflowRunLauncher(input: {
  readonly backgroundWorkflow: Env['BACKGROUND'];
  readonly codingWorkflow: Env['CODING'];
}): RunLauncher {
  return {
    async launchBackgroundRun(params) {
      await input.backgroundWorkflow.create({
        id: crypto.randomUUID(),
        params: {
          prompt: params.prompt,
          deviceId: params.deviceId,
        },
      });
    },
    async launchCodingRun(params) {
      await input.codingWorkflow.create({
        id: crypto.randomUUID(),
        params: {
          repository: params.repository,
          task: params.task,
          deviceId: params.deviceId,
        },
      });
    },
  };
}

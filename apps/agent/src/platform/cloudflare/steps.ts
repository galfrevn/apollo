import type { WorkflowStep, WorkflowStepConfig } from 'cloudflare:workers';

import type { StepOptions, StepRunner, StepSerializableValue } from '@/platform/steps';

export function createWorkflowStepRunner(workflowStep: WorkflowStep): StepRunner {
  function runWorkflowStep<Result extends StepSerializableValue>(
    stepName: string,
    callback: () => Promise<Result>,
  ): Promise<Result>;
  function runWorkflowStep<Result extends StepSerializableValue>(
    stepName: string,
    options: StepOptions,
    callback: () => Promise<Result>,
  ): Promise<Result>;
  async function runWorkflowStep<Result extends StepSerializableValue>(
    stepName: string,
    optionsOrCallback: StepOptions | (() => Promise<Result>),
    maybeCallback?: () => Promise<Result>,
  ): Promise<Result> {
    const callback =
      typeof optionsOrCallback === 'function' ? optionsOrCallback : maybeCallback;
    if (callback === undefined) {
      throw new Error('runWorkflowStep requires a callback');
    }
    const options =
      typeof optionsOrCallback === 'function' ? undefined : optionsOrCallback;
    // SAFETY: WorkflowStep.do constrains its generic to Rpc.Serializable, which
    // a platform-neutral generic cannot prove. StepSerializableValue is a strict
    // subset of what the runtime memoizes, so collapsing the callback's return
    // to `never` for the call is sound: the awaited value is still the
    // callback's own Result (fresh or replayed from the step checkpoint).
    const opaqueCallback = callback as () => Promise<never>;
    return options?.retries === undefined
      ? await workflowStep.do(stepName, opaqueCallback)
      : await workflowStep.do(stepName, buildWorkflowStepConfig(options), opaqueCallback);
  }
  return { do: runWorkflowStep };
}

function buildWorkflowStepConfig(options: StepOptions): WorkflowStepConfig {
  if (options.retries === undefined) {
    return {};
  }
  return {
    retries: {
      limit: options.retries.limit,
      delay: options.retries.delayMilliseconds,
      ...(options.retries.backoff === undefined
        ? {}
        : { backoff: options.retries.backoff }),
    },
  };
}

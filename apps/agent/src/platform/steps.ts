// Step results are memoized by (instance id, step name) on every host, so a
// result must survive JSON serialization and a step name must never change
// once instances exist — renaming one invalidates every in-flight resume.
export type StepSerializableValue =
  | string
  | number
  | boolean
  | null
  | readonly StepSerializableValue[]
  | { readonly [key: string]: StepSerializableValue | undefined };

export type StepRetryPolicy = {
  readonly limit: number;
  readonly delayMilliseconds: number;
  readonly backoff?: 'constant' | 'linear' | 'exponential';
};

export type StepOptions = {
  readonly retries?: StepRetryPolicy;
};

export type StepRunner = {
  do<Result extends StepSerializableValue>(
    stepName: string,
    callback: () => Promise<Result>,
  ): Promise<Result>;
  do<Result extends StepSerializableValue>(
    stepName: string,
    options: StepOptions,
    callback: () => Promise<Result>,
  ): Promise<Result>;
};

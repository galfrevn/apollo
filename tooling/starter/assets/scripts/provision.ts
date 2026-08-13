import { reportStep, runWrangler } from './shell';

export const R2_BUCKET_NAME = 'apollo-media';
export const R2_PREVIEW_BUCKET_NAME = 'apollo-media-preview';
export const VECTORIZE_INDEX_NAME = 'apollo-memory';
// Pinned to OPENROUTER_EMBEDDING_MODEL (openai/text-embedding-3-small): a
// wrong-dims index rejects every upsert silently and Apollo never remembers.
export const VECTORIZE_DIMENSION_COUNT = 1536;
export const VECTORIZE_METRIC = 'cosine';
export const QUEUE_NAME = 'apollo-jobs';

function ensureResourceExists(input: {
  readonly resourceLabel: string;
  readonly createArgumentList: readonly string[];
  readonly verifyArgumentList: readonly string[];
}): void {
  const createResult = runWrangler(input.createArgumentList);
  if (createResult.exitCode === 0) {
    reportStep(input.resourceLabel, true, 'created');
    return;
  }
  const verifyResult = runWrangler(input.verifyArgumentList);
  reportStep(
    input.resourceLabel,
    verifyResult.exitCode === 0,
    verifyResult.exitCode === 0
      ? 'already exists'
      : createResult.stderr.trim().split('\n').at(-1),
  );
}

export function runProvision(): void {
  ensureResourceExists({
    resourceLabel: `r2 bucket ${R2_BUCKET_NAME}`,
    createArgumentList: ['r2', 'bucket', 'create', R2_BUCKET_NAME],
    verifyArgumentList: ['r2', 'bucket', 'info', R2_BUCKET_NAME],
  });
  ensureResourceExists({
    resourceLabel: `r2 bucket ${R2_PREVIEW_BUCKET_NAME}`,
    createArgumentList: ['r2', 'bucket', 'create', R2_PREVIEW_BUCKET_NAME],
    verifyArgumentList: ['r2', 'bucket', 'info', R2_PREVIEW_BUCKET_NAME],
  });
  ensureResourceExists({
    resourceLabel: `vectorize index ${VECTORIZE_INDEX_NAME}`,
    createArgumentList: [
      'vectorize',
      'create',
      VECTORIZE_INDEX_NAME,
      `--dimensions=${VECTORIZE_DIMENSION_COUNT}`,
      `--metric=${VECTORIZE_METRIC}`,
    ],
    verifyArgumentList: ['vectorize', 'get', VECTORIZE_INDEX_NAME],
  });
  const vectorizeDetails = runWrangler(['vectorize', 'get', VECTORIZE_INDEX_NAME]);
  if (
    vectorizeDetails.exitCode === 0 &&
    !vectorizeDetails.stdout.includes(String(VECTORIZE_DIMENSION_COUNT))
  ) {
    reportStep(
      'vectorize dimensions',
      false,
      `index does not report ${VECTORIZE_DIMENSION_COUNT} dimensions — delete it (\`bunx wrangler vectorize delete ${VECTORIZE_INDEX_NAME}\`) and re-run provision`,
    );
  }
  ensureResourceExists({
    resourceLabel: `queue ${QUEUE_NAME}`,
    createArgumentList: ['queues', 'create', QUEUE_NAME],
    verifyArgumentList: ['queues', 'info', QUEUE_NAME],
  });
}

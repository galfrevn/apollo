import type { CodingAgentOutcome } from '@/coding/agent';
import { CODING_WORKSPACE_PATH, quoteShellArgument } from '@/coding/git';
import { CODING_PROXY_PATH_PREFIX } from '@/coding/proxy';
import type { SandboxLike } from '@/coding/run';

export const OPENCODE_PROVIDER_NAME = 'apollo';
export const OPENCODE_TOKEN_ENVIRONMENT_NAME = 'APOLLO_LLM_TOKEN';
// Outside the repo on purpose: nothing here may dirty the tree that
// extract-changes turns into the pull request.
export const OPENCODE_CONFIG_PATH = '/workspace/apollo-opencode.json';
export const OPENCODE_SUMMARY_PATH = '/workspace/apollo-coding-summary.txt';
const OPENCODE_RUN_TIMEOUT_MILLISECONDS = 2_700_000;
const TRANSCRIPT_MAX_CHARACTER_COUNT = 100_000;

export function buildOpencodeConfig(input: {
  readonly proxyOrigin: string;
  readonly modelId: string;
}): string {
  return JSON.stringify(
    {
      $schema: 'https://opencode.ai/config.json',
      provider: {
        [OPENCODE_PROVIDER_NAME]: {
          npm: '@ai-sdk/openai-compatible',
          name: 'Apollo LLM proxy',
          options: {
            baseURL: `${input.proxyOrigin}${CODING_PROXY_PATH_PREFIX}`,
            apiKey: `{env:${OPENCODE_TOKEN_ENVIRONMENT_NAME}}`,
          },
          models: {
            [input.modelId]: {
              name: input.modelId,
              limit: { context: 200_000, output: 32_768 },
            },
          },
        },
      },
      model: `${OPENCODE_PROVIDER_NAME}/${input.modelId}`,
      permission: { edit: 'allow', bash: 'allow', webfetch: 'deny' },
      share: 'disabled',
    },
    null,
    2,
  );
}

export function buildOpencodePrompt(taskText: string): string {
  return [
    taskText.trim(),
    '',
    'Reglas de este entorno:',
    '- No hagas commit ni push: de eso se encarga Apollo cuando terminás.',
    '- Si la tarea es de solo lectura (auditoría, análisis, revisión), tu informe es el entregable.',
    `- Al terminar, escribí un resumen corto en español rioplatense en ${OPENCODE_SUMMARY_PATH}.`,
    '  Ese resumen se lee en voz alta, así que nada de markdown ni rutas largas.',
  ].join('\n');
}

export function buildOpencodeRunCommand(input: {
  readonly modelId: string;
  readonly taskText: string;
}): string {
  return [
    'opencode',
    'run',
    '--model',
    quoteShellArgument(`${OPENCODE_PROVIDER_NAME}/${input.modelId}`),
    quoteShellArgument(buildOpencodePrompt(input.taskText)),
  ].join(' ');
}

function truncateTranscriptText(transcriptText: string): string {
  if (transcriptText.length <= TRANSCRIPT_MAX_CHARACTER_COUNT) {
    return transcriptText;
  }
  return `${transcriptText.slice(0, TRANSCRIPT_MAX_CHARACTER_COUNT)}\n… [salida truncada]`;
}

export async function runOpencodeAgent(input: {
  readonly sandbox: SandboxLike;
  readonly proxyOrigin: string;
  readonly proxyToken: string;
  readonly modelId: string;
  readonly taskText: string;
  readonly workspacePath?: string;
}): Promise<CodingAgentOutcome> {
  const workspacePath = input.workspacePath ?? CODING_WORKSPACE_PATH;
  await input.sandbox.writeFile(
    OPENCODE_CONFIG_PATH,
    buildOpencodeConfig({ proxyOrigin: input.proxyOrigin, modelId: input.modelId }),
  );

  const runResult = await input.sandbox.exec(
    buildOpencodeRunCommand({ modelId: input.modelId, taskText: input.taskText }),
    {
      cwd: workspacePath,
      env: {
        [OPENCODE_TOKEN_ENVIRONMENT_NAME]: input.proxyToken,
        OPENCODE_CONFIG: OPENCODE_CONFIG_PATH,
      },
      timeout: OPENCODE_RUN_TIMEOUT_MILLISECONDS,
    },
  );
  if (runResult.exitCode !== 0) {
    throw new Error(
      `opencode falló (exit ${runResult.exitCode}): ${`${runResult.stderr}\n${runResult.stdout}`
        .trim()
        .slice(0, 600)}`,
    );
  }

  // The summary file is the contract with the prompt; a model that forgot it
  // still streamed its final reply to stdout, which beats saying nothing.
  let summary = '';
  try {
    summary = (await input.sandbox.readFile(OPENCODE_SUMMARY_PATH)).content.trim();
  } catch {
    summary = '';
  }
  if (summary.length === 0) {
    summary = runResult.stdout.trim().split('\n').slice(-6).join(' ').trim();
  }

  return {
    summary,
    roundCount: 1,
    didReachRoundLimit: false,
    transcript: truncateTranscriptText(runResult.stdout.trim())
      .split('\n')
      .filter((line) => line.trim().length > 0),
  };
}

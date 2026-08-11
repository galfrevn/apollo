import { z } from 'zod';

import { CODING_WORKSPACE_PATH } from '@/coding/git';
import { resolveWorkspaceFilePath } from '@/coding/workspace';
import { truncateSandboxOutputForToolResult } from '@/sandbox/helpers';
import type { OpenRouterChatMessage, OpenRouterChatResult } from '@/voice/llm';

export const DEFAULT_CODING_ROUND_LIMIT = 24;
// Two rounds with identical calls and identical results get the model a
// warning; a third ends the run. Seen in production: a model re-reading the
// same README and re-running the same ls until the round limit, with nothing
// to show for it.
export const REPEATED_ROUND_STOP_COUNT = 3;
const COMMAND_TIMEOUT_MILLISECONDS = 300_000;

export type CodingSandboxPort = {
  readonly listFiles: (
    path: string,
  ) => Promise<readonly { readonly path: string; readonly isDirectory: boolean }[]>;
  readonly readFile: (path: string) => Promise<{ readonly content: string }>;
  readonly writeFile: (path: string, content: string) => Promise<void>;
  readonly exec: (
    command: string,
    options: { readonly cwd: string; readonly timeout: number },
  ) => Promise<{
    readonly stdout: string;
    readonly stderr: string;
    readonly exitCode: number;
  }>;
};

export type CodingLlmCaller = (input: {
  readonly messageList: readonly OpenRouterChatMessage[];
  readonly toolDefinitionList: readonly {
    readonly name: string;
    readonly description: string;
    readonly parameters: Record<string, unknown>;
  }[];
}) => Promise<OpenRouterChatResult>;

export type CodingAgentOutcome = {
  readonly summary: string;
  readonly roundCount: number;
  readonly didReachRoundLimit: boolean;
  readonly transcript: readonly string[];
};

const listFilesArgsSchema = z.object({ path: z.string().default('.') });
const readFileArgsSchema = z.object({ path: z.string().min(1) });
const writeFileArgsSchema = z.object({
  path: z.string().min(1),
  content: z.string(),
});
const runCommandArgsSchema = z.object({ command: z.string().min(1).max(2000) });

type CodingToolDefinition = {
  readonly name: string;
  readonly description: string;
  readonly parameters: Record<string, unknown>;
};

const codingToolDefinitionList: readonly CodingToolDefinition[] = [
  {
    name: 'list_files',
    description: 'Lista archivos y carpetas de una ruta del repositorio',
    parameters: {
      type: 'object',
      properties: { path: { type: 'string' } },
      additionalProperties: false,
    },
  },
  {
    name: 'read_file',
    description: 'Lee el contenido completo de un archivo del repositorio',
    parameters: {
      type: 'object',
      properties: { path: { type: 'string' } },
      required: ['path'],
      additionalProperties: false,
    },
  },
  {
    name: 'write_file',
    description: 'Escribe el contenido completo de un archivo del repositorio',
    parameters: {
      type: 'object',
      properties: { path: { type: 'string' }, content: { type: 'string' } },
      required: ['path', 'content'],
      additionalProperties: false,
    },
  },
  {
    name: 'run_command',
    description:
      'Corre un comando de shell en la raíz del repositorio (instalar dependencias, correr tests, linters)',
    parameters: {
      type: 'object',
      properties: { command: { type: 'string' } },
      required: ['command'],
      additionalProperties: false,
    },
  },
];

export function buildCodingSystemPrompt(input: {
  readonly repositoryLabel: string;
  readonly taskText: string;
  readonly workspacePath: string;
}): string {
  return [
    `Sos un agente de programación trabajando sobre el repositorio ${input.repositoryLabel}, ya clonado en ${input.workspacePath}.`,
    `Tarea del usuario: ${input.taskText}`,
    '',
    'Cómo trabajar:',
    '- Explorá con list_files y read_file antes de escribir nada.',
    '- write_file reemplaza el archivo entero: incluí siempre el contenido completo.',
    '- Si el repo tiene tests o linter, corrélos con run_command y arreglá lo que rompas.',
    '- No toques .git, ni archivos fuera del repositorio, ni secretos.',
    '- No hagas commit ni push: de eso se encarga Apollo cuando terminás.',
    '- Si la tarea es de solo lectura (auditoría, análisis, revisión), no inventes',
    '  cambios: tu respuesta final es el informe.',
    '',
    'Cuando la tarea esté lista, respondé sin llamar más herramientas, con un resumen corto',
    'en español rioplatense de qué cambiaste y por qué. Ese resumen se lee en voz alta.',
  ].join('\n');
}

// The transcript is persisted to R2 and emailed, so a write_file call records
// what changed rather than the whole file it wrote.
export function summarizeToolCallForTranscript(
  toolName: string,
  toolArgs: unknown,
): string {
  if (toolName === 'write_file') {
    const parsedArgs = writeFileArgsSchema.safeParse(toolArgs);
    if (parsedArgs.success) {
      return `write_file ${parsedArgs.data.path} (${parsedArgs.data.content.length} caracteres)`;
    }
  }
  return `${toolName} ${JSON.stringify(toolArgs)}`;
}

async function executeCodingTool(input: {
  readonly toolName: string;
  readonly toolArgs: unknown;
  readonly sandbox: CodingSandboxPort;
  readonly workspacePath: string;
}): Promise<string> {
  const { toolName, toolArgs, sandbox, workspacePath } = input;

  if (toolName === 'list_files') {
    const parsedArgs = listFilesArgsSchema.parse(toolArgs);
    const resolvedPath = resolveWorkspaceFilePath({
      workspacePath,
      requestedPath: parsedArgs.path,
    });
    const entryList = await sandbox.listFiles(resolvedPath);
    return entryList
      .map((entry) => `${entry.isDirectory ? 'dir ' : 'file'} ${entry.path}`)
      .join('\n');
  }

  if (toolName === 'read_file') {
    const parsedArgs = readFileArgsSchema.parse(toolArgs);
    const resolvedPath = resolveWorkspaceFilePath({
      workspacePath,
      requestedPath: parsedArgs.path,
    });
    const file = await sandbox.readFile(resolvedPath);
    return file.content;
  }

  if (toolName === 'write_file') {
    const parsedArgs = writeFileArgsSchema.parse(toolArgs);
    const resolvedPath = resolveWorkspaceFilePath({
      workspacePath,
      requestedPath: parsedArgs.path,
    });
    await sandbox.writeFile(resolvedPath, parsedArgs.content);
    return `Escrito ${resolvedPath} (${parsedArgs.content.length} caracteres)`;
  }

  if (toolName === 'run_command') {
    const parsedArgs = runCommandArgsSchema.parse(toolArgs);
    const result = await sandbox.exec(parsedArgs.command, {
      cwd: workspacePath,
      timeout: COMMAND_TIMEOUT_MILLISECONDS,
    });
    return [
      `exit ${result.exitCode}`,
      result.stdout.length > 0 ? `stdout:\n${result.stdout}` : '',
      result.stderr.length > 0 ? `stderr:\n${result.stderr}` : '',
    ]
      .filter((section) => section.length > 0)
      .join('\n');
  }

  return `Herramienta desconocida: ${toolName}`;
}

function buildRoundSignature(
  toolCallList: readonly { readonly name: string; readonly args: unknown }[],
  toolOutputList: readonly string[],
): string {
  return JSON.stringify([
    toolCallList.map((toolCall) => [toolCall.name, toolCall.args]),
    toolOutputList,
  ]);
}

const REPEATED_ROUND_WARNING =
  'Estás repitiendo exactamente las mismas llamadas y el resultado no va a cambiar. ' +
  'Avanzá con la tarea, o si ya está lista respondé sin llamar herramientas.';

const WRAP_UP_PROMPT =
  'Se terminaron las rondas de herramientas. Respondé ahora, sin llamar ninguna, ' +
  'con el resumen corto en español rioplatense de qué hiciste o encontraste.';

// The run ended without a plain reply, but the conversation so far still holds
// everything the model learned: one last call without tools turns that into a
// spoken summary instead of throwing the whole run away.
async function requestWrapUpSummary(
  callLlm: CodingLlmCaller,
  messageList: readonly OpenRouterChatMessage[],
): Promise<string> {
  try {
    const wrapUpResult = await callLlm({
      messageList: [...messageList, { role: 'user', content: WRAP_UP_PROMPT }],
      toolDefinitionList: [],
    });
    return wrapUpResult.text.trim();
  } catch {
    return '';
  }
}

export async function runCodingAgent(input: {
  readonly sandbox: CodingSandboxPort;
  readonly callLlm: CodingLlmCaller;
  readonly repositoryLabel: string;
  readonly taskText: string;
  readonly workspacePath?: string;
  readonly roundLimit?: number;
}): Promise<CodingAgentOutcome> {
  const workspacePath = input.workspacePath ?? CODING_WORKSPACE_PATH;
  const roundLimit = input.roundLimit ?? DEFAULT_CODING_ROUND_LIMIT;
  const transcript: string[] = [];

  const messageList: OpenRouterChatMessage[] = [
    {
      role: 'system',
      content: buildCodingSystemPrompt({
        repositoryLabel: input.repositoryLabel,
        taskText: input.taskText,
        workspacePath,
      }),
    },
    { role: 'user', content: input.taskText },
  ];

  let previousRoundSignature = '';
  let identicalRoundCount = 0;
  let completedRoundCount = 0;

  for (let roundIndex = 0; roundIndex < roundLimit; roundIndex += 1) {
    const llmResult = await input.callLlm({
      messageList,
      toolDefinitionList: codingToolDefinitionList,
    });

    if (llmResult.toolCallList.length === 0) {
      return {
        summary: llmResult.text.trim(),
        roundCount: roundIndex + 1,
        didReachRoundLimit: false,
        transcript,
      };
    }

    completedRoundCount = roundIndex + 1;

    messageList.push({
      role: 'assistant',
      content: llmResult.text.trim().length > 0 ? llmResult.text : null,
      tool_calls: llmResult.toolCallList.map((toolCall) => ({
        id: toolCall.id,
        type: 'function' as const,
        function: {
          name: toolCall.name,
          arguments: JSON.stringify(toolCall.args),
        },
      })),
    });

    const toolOutputList: string[] = [];
    for (const toolCall of llmResult.toolCallList) {
      transcript.push(summarizeToolCallForTranscript(toolCall.name, toolCall.args));
      let toolOutput: string;
      try {
        toolOutput = await executeCodingTool({
          toolName: toolCall.name,
          toolArgs: toolCall.args,
          sandbox: input.sandbox,
          workspacePath,
        });
      } catch (error) {
        toolOutput = `Error: ${error instanceof Error ? error.message : String(error)}`;
      }
      toolOutputList.push(toolOutput);
      messageList.push({
        role: 'tool',
        tool_call_id: toolCall.id,
        content: truncateSandboxOutputForToolResult(toolOutput),
      });
    }

    // A repeat only counts when the results came back identical too: the same
    // command against changed sandbox state is progress, not a loop.
    const roundSignature = buildRoundSignature(llmResult.toolCallList, toolOutputList);
    identicalRoundCount =
      roundSignature === previousRoundSignature ? identicalRoundCount + 1 : 1;
    previousRoundSignature = roundSignature;
    if (identicalRoundCount >= REPEATED_ROUND_STOP_COUNT) {
      break;
    }
    if (identicalRoundCount >= 2) {
      messageList.push({ role: 'user', content: REPEATED_ROUND_WARNING });
    }
  }

  return {
    summary: await requestWrapUpSummary(input.callLlm, messageList),
    roundCount: completedRoundCount,
    didReachRoundLimit: true,
    transcript,
  };
}

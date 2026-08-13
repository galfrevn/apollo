import { describe, expect, it } from 'bun:test';

import {
  runCodingAgent,
  type CodingSandboxPort,
  type CodingLlmCaller,
} from '@/coding/agent';
import type { OpenRouterChatResult } from '@/voice/llm';

type RecordedSandboxCall = {
  readonly kind: 'list' | 'read' | 'write' | 'exec';
  readonly path: string;
  readonly content?: string;
};

type FakeCodingSandboxHarness = {
  readonly sandbox: CodingSandboxPort;
  readonly callList: RecordedSandboxCall[];
  readonly writtenFileByPath: Record<string, string>;
};

function createFakeSandbox(
  fileContentByPath: Record<string, string> = {},
): FakeCodingSandboxHarness {
  const callList: RecordedSandboxCall[] = [];
  const writtenFileByPath: Record<string, string> = {};
  return {
    callList,
    writtenFileByPath,
    sandbox: {
      listFiles: async (path) => {
        callList.push({ kind: 'list', path });
        return [{ path: `${path}/index.ts`, isDirectory: false }];
      },
      readFile: async (path) => {
        callList.push({ kind: 'read', path });
        return { content: fileContentByPath[path] ?? '' };
      },
      writeFile: async (path, content) => {
        callList.push({ kind: 'write', path, content });
        writtenFileByPath[path] = content;
      },
      exec: async (command) => {
        callList.push({ kind: 'exec', path: command });
        return { stdout: 'ok', stderr: '', exitCode: 0 };
      },
    },
  };
}

type ScriptedLlmHarness = {
  readonly callLlm: CodingLlmCaller;
  readonly roundCount: () => number;
};

function createScriptedLlm(
  resultList: readonly OpenRouterChatResult[],
): ScriptedLlmHarness {
  let callIndex = 0;
  return {
    roundCount: () => callIndex,
    callLlm: async () => {
      const result = resultList[Math.min(callIndex, resultList.length - 1)];
      callIndex += 1;
      return result;
    },
  };
}

describe('runCodingAgent', () => {
  it('routes an edit through to the sandbox and stops on a plain reply', async () => {
    const { sandbox, writtenFileByPath } = createFakeSandbox({
      '/workspace/repo/src/index.ts': 'const a = 1;',
    });
    const { callLlm } = createScriptedLlm([
      {
        text: '',
        toolCallList: [{ id: '1', name: 'read_file', args: { path: 'src/index.ts' } }],
      },
      {
        text: '',
        toolCallList: [
          {
            id: '2',
            name: 'write_file',
            args: { path: 'src/index.ts', content: 'const a = 2;' },
          },
        ],
      },
      { text: 'Cambié la constante a 2.', toolCallList: [] },
    ]);

    const outcome = await runCodingAgent({
      sandbox,
      callLlm,
      repositoryLabel: 'example/apollo',
      taskText: 'poné la constante en 2',
    });

    expect(writtenFileByPath['/workspace/repo/src/index.ts']).toBe('const a = 2;');
    expect(outcome.summary).toBe('Cambié la constante a 2.');
    expect(outcome.didReachRoundLimit).toBe(false);
    expect(outcome.roundCount).toBe(3);
    expect(outcome.transcript).toHaveLength(2);
    // The transcript is persisted and emailed, so it records the shape of a
    // write rather than the file it wrote.
    expect(outcome.transcript[1]).toBe('write_file src/index.ts (12 caracteres)');
    expect(outcome.transcript.join('\n')).not.toContain('const a = 2;');
  });

  it('reports a rejected path back to the model instead of dying', async () => {
    const { sandbox, callList } = createFakeSandbox();
    let sawErrorInToolResult = false;
    let callIndex = 0;
    const callLlm: CodingLlmCaller = async ({ messageList }) => {
      const lastMessage = messageList.at(-1);
      if (lastMessage?.role === 'tool' && lastMessage.content.includes('Error:')) {
        sawErrorInToolResult = true;
      }
      callIndex += 1;
      if (callIndex === 1) {
        return {
          text: '',
          toolCallList: [
            { id: '1', name: 'read_file', args: { path: '../../etc/passwd' } },
          ],
        };
      }
      return { text: 'No pude leer eso, seguí sin ese archivo.', toolCallList: [] };
    };

    const outcome = await runCodingAgent({
      sandbox,
      callLlm,
      repositoryLabel: 'example/apollo',
      taskText: 'leé algo raro',
    });

    expect(sawErrorInToolResult).toBe(true);
    expect(callList.filter((call) => call.kind === 'read')).toHaveLength(0);
    expect(outcome.summary).toContain('No pude leer eso');
  });

  it('gives up at the round limit and still wraps up with a spoken summary', async () => {
    const { sandbox } = createFakeSandbox();
    const { callLlm } = createScriptedLlm([
      {
        text: '',
        toolCallList: [{ id: 'a', name: 'list_files', args: { path: 'src' } }],
      },
      {
        text: '',
        toolCallList: [{ id: 'b', name: 'list_files', args: { path: 'firmware' } }],
      },
      {
        text: '',
        toolCallList: [{ id: 'c', name: 'list_files', args: { path: 'documentation' } }],
      },
      {
        text: '',
        toolCallList: [{ id: 'd', name: 'list_files', args: { path: 'coverage' } }],
      },
      { text: 'Revisé todo y no encontré nada para tocar.', toolCallList: [] },
    ]);

    const outcome = await runCodingAgent({
      sandbox,
      callLlm,
      repositoryLabel: 'example/apollo',
      taskText: 'dar vueltas para siempre',
      roundLimit: 4,
    });

    expect(outcome.didReachRoundLimit).toBe(true);
    expect(outcome.roundCount).toBe(4);
    expect(outcome.summary).toBe('Revisé todo y no encontré nada para tocar.');
  });

  it('warns on a repeated round and stops after three identical ones', async () => {
    const { sandbox, callList } = createFakeSandbox();
    const capturedCallList: {
      readonly messageList: readonly {
        readonly role: string;
        readonly content?: string | null;
      }[];
      readonly toolDefinitionCount: number;
    }[] = [];
    const callLlm: CodingLlmCaller = async ({ messageList, toolDefinitionList }) => {
      capturedCallList.push({
        messageList: [...messageList],
        toolDefinitionCount: toolDefinitionList.length,
      });
      if (toolDefinitionList.length === 0) {
        return { text: 'Di vueltas sin llegar a nada concreto.', toolCallList: [] };
      }
      return {
        text: '',
        toolCallList: [{ id: 'x', name: 'list_files', args: { path: '.' } }],
      };
    };

    const outcome = await runCodingAgent({
      sandbox,
      callLlm,
      repositoryLabel: 'example/apollo',
      taskText: 'dar vueltas para siempre',
    });

    expect(outcome.didReachRoundLimit).toBe(true);
    expect(outcome.roundCount).toBe(3);
    expect(outcome.summary).toBe('Di vueltas sin llegar a nada concreto.');
    // The third identical round still executes — its results are what prove
    // the loop — but nothing runs after it.
    expect(callList.filter((call) => call.kind === 'list')).toHaveLength(3);
    const flattenedContentList = capturedCallList.flatMap((call) =>
      call.messageList.map((message) => message.content ?? ''),
    );
    expect(flattenedContentList.some((content) => content.includes('repitiendo'))).toBe(
      true,
    );
    const wrapUpCall = capturedCallList.at(-1);
    expect(wrapUpCall?.toolDefinitionCount).toBe(0);
    expect(wrapUpCall?.messageList.at(-1)?.content).toContain('Se terminaron las rondas');
  });

  it('treats outputs differing only past the truncation cutoff as identical', async () => {
    let execCallCount = 0;
    const { sandbox } = createFakeSandbox();
    const longPrefix = 'x'.repeat(5_000);
    const tailChangingSandbox: CodingSandboxPort = {
      ...sandbox,
      exec: async () => {
        execCallCount += 1;
        return { stdout: `${longPrefix}${execCallCount}`, stderr: '', exitCode: 0 };
      },
    };
    let sawWrapUpRequest = false;
    const callLlm: CodingLlmCaller = async ({ toolDefinitionList }) => {
      if (toolDefinitionList.length === 0) {
        sawWrapUpRequest = true;
        return { text: 'No pude avanzar con eso.', toolCallList: [] };
      }
      return {
        text: '',
        toolCallList: [{ id: 'x', name: 'run_command', args: { command: 'cat log' } }],
      };
    };

    const outcome = await runCodingAgent({
      sandbox: tailChangingSandbox,
      callLlm,
      repositoryLabel: 'example/apollo',
      taskText: 'dar vueltas para siempre',
    });

    // The tails differ, but the model only ever saw the truncated prefix:
    // identical as far as it can tell, so the cutoff still fires.
    expect(outcome.didReachRoundLimit).toBe(true);
    expect(execCallCount).toBe(3);
    expect(sawWrapUpRequest).toBe(true);
  });

  it('keeps looping when a repeated call returns different results', async () => {
    let execCallCount = 0;
    const { sandbox } = createFakeSandbox();
    const changingSandbox: CodingSandboxPort = {
      ...sandbox,
      exec: async () => {
        execCallCount += 1;
        return { stdout: `intento ${execCallCount}`, stderr: '', exitCode: 0 };
      },
    };
    let llmCallCount = 0;
    const callLlm: CodingLlmCaller = async ({ toolDefinitionList }) => {
      llmCallCount += 1;
      if (toolDefinitionList.length > 0 && llmCallCount <= 5) {
        return {
          text: '',
          toolCallList: [
            {
              id: `c${llmCallCount}`,
              name: 'run_command',
              args: { command: 'bun test' },
            },
          ],
        };
      }
      return { text: 'Los tests quedaron en verde.', toolCallList: [] };
    };

    const outcome = await runCodingAgent({
      sandbox: changingSandbox,
      callLlm,
      repositoryLabel: 'example/apollo',
      taskText: 'arreglá los tests',
    });

    // Same command five times, but each run returned something new: that is
    // progress, not a loop, so the run ends on the model's own reply.
    expect(execCallCount).toBe(5);
    expect(outcome.didReachRoundLimit).toBe(false);
    expect(outcome.summary).toBe('Los tests quedaron en verde.');
  });

  it('runs commands at the repository root', async () => {
    const { sandbox, callList } = createFakeSandbox();
    const { callLlm } = createScriptedLlm([
      {
        text: '',
        toolCallList: [{ id: '1', name: 'run_command', args: { command: 'bun test' } }],
      },
      { text: 'Tests en verde.', toolCallList: [] },
    ]);

    await runCodingAgent({
      sandbox,
      callLlm,
      repositoryLabel: 'example/apollo',
      taskText: 'corré los tests',
    });

    expect(callList.filter((call) => call.kind === 'exec')).toEqual([
      { kind: 'exec', path: 'bun test' },
    ]);
  });
});

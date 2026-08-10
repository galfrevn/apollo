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

function createFakeSandbox(fileContentByPath: Record<string, string> = {}): {
  readonly sandbox: CodingSandboxPort;
  readonly callList: RecordedSandboxCall[];
  readonly writtenFileByPath: Record<string, string>;
} {
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

function createScriptedLlm(resultList: readonly OpenRouterChatResult[]): {
  readonly callLlm: CodingLlmCaller;
  readonly roundCount: () => number;
} {
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
      repositoryLabel: 'galfrevn/apollo',
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
      repositoryLabel: 'galfrevn/apollo',
      taskText: 'leé algo raro',
    });

    expect(sawErrorInToolResult).toBe(true);
    expect(callList.filter((call) => call.kind === 'read')).toHaveLength(0);
    expect(outcome.summary).toContain('No pude leer eso');
  });

  it('gives up at the round limit instead of looping forever', async () => {
    const { sandbox } = createFakeSandbox();
    const { callLlm } = createScriptedLlm([
      {
        text: '',
        toolCallList: [{ id: 'x', name: 'list_files', args: { path: '.' } }],
      },
    ]);

    const outcome = await runCodingAgent({
      sandbox,
      callLlm,
      repositoryLabel: 'galfrevn/apollo',
      taskText: 'dar vueltas para siempre',
      roundLimit: 4,
    });

    expect(outcome.didReachRoundLimit).toBe(true);
    expect(outcome.roundCount).toBe(4);
    expect(outcome.summary).toBe('');
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
      repositoryLabel: 'galfrevn/apollo',
      taskText: 'corré los tests',
    });

    expect(callList.filter((call) => call.kind === 'exec')).toEqual([
      { kind: 'exec', path: 'bun test' },
    ]);
  });
});

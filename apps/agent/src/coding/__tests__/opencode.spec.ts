import { describe, expect, it } from 'bun:test';
import { z } from 'zod';

import {
  buildOpencodeConfig,
  buildOpencodeRunCommand,
  OPENCODE_CONFIG_PATH,
  OPENCODE_SUMMARY_PATH,
  runOpencodeAgent,
} from '@/coding/opencode';
import type { SandboxLike } from '@/coding/run';

type RecordedExecutionOptions = {
  readonly cwd?: string;
  readonly env?: Record<string, string>;
  readonly timeout?: number;
};

type RecordedExecutionCall = {
  readonly command: string;
  readonly options?: RecordedExecutionOptions;
};

type FakeOpencodeSandboxHarness = {
  readonly sandbox: SandboxLike;
  readonly writtenFileByPath: Record<string, string>;
  readonly execCallList: RecordedExecutionCall[];
};

function createFakeSandbox(input: {
  readonly execResult?: { stdout: string; stderr: string; exitCode: number };
  readonly summaryContent?: string;
}): FakeOpencodeSandboxHarness {
  const writtenFileByPath: Record<string, string> = {};
  const execCallList: RecordedExecutionCall[] = [];
  return {
    writtenFileByPath,
    execCallList,
    sandbox: {
      exec: async (command, options) => {
        execCallList.push({ command, options });
        return input.execResult ?? { stdout: 'listo', stderr: '', exitCode: 0 };
      },
      listFiles: async () => [],
      readFile: async (path) => {
        if (path === OPENCODE_SUMMARY_PATH && input.summaryContent !== undefined) {
          return { content: input.summaryContent };
        }
        throw new Error('no existe');
      },
      writeFile: async (path, content) => {
        writtenFileByPath[path] = content;
      },
    },
  };
}

const opencodeConfigModelSchema = z.object({ model: z.string() });

describe('buildOpencodeConfig', () => {
  it('points the provider at the worker proxy with the token as env reference', () => {
    const configText = buildOpencodeConfig({
      proxyOrigin: 'https://apollo.example',
      modelId: 'moonshotai/kimi-k3',
    });
    const config = opencodeConfigModelSchema.parse(JSON.parse(configText));

    expect(configText).toContain('https://apollo.example/coding-llm/v1');
    expect(configText).toContain('{env:APOLLO_LLM_TOKEN}');
    expect(configText).not.toContain('sk-or');
    expect(config.model).toBe('apollo/moonshotai/kimi-k3');
    expect(configText).toContain('"webfetch": "deny"');
  });
});

describe('runOpencodeAgent', () => {
  it('writes the config, runs opencode with the scoped env, and reads the summary', async () => {
    const { sandbox, writtenFileByPath, execCallList } = createFakeSandbox({
      summaryContent: 'Agregué el endpoint y los tests pasan.\n',
    });

    const outcome = await runOpencodeAgent({
      sandbox,
      proxyOrigin: 'https://apollo.example',
      proxyToken: 'wf-1.999.abc',
      modelId: 'moonshotai/kimi-k3',
      taskText: 'agregá un endpoint de status',
    });

    expect(writtenFileByPath[OPENCODE_CONFIG_PATH]).toContain('coding-llm/v1');
    // A failed attempt's summary must not leak into the retry that follows it.
    expect(writtenFileByPath[OPENCODE_SUMMARY_PATH]).toBe('');
    const execCall = execCallList[0];
    expect(execCall.command).toContain('opencode run');
    expect(execCall.command).toContain("'apollo/moonshotai/kimi-k3'");
    expect(execCall.command).toContain('agregá un endpoint de status');
    expect(execCall.options?.cwd).toBe('/workspace/repo');
    expect(execCall.options?.env?.APOLLO_LLM_TOKEN).toBe('wf-1.999.abc');
    expect(execCall.options?.env?.OPENCODE_CONFIG).toBe(OPENCODE_CONFIG_PATH);
    expect(outcome.summary).toBe('Agregué el endpoint y los tests pasan.');
    expect(outcome.didReachRoundLimit).toBe(false);
  });

  it('falls back to the tail of stdout when the summary file is missing', async () => {
    const { sandbox } = createFakeSandbox({
      execResult: {
        stdout: 'ruido\nAjusté la validación del formulario.',
        stderr: '',
        exitCode: 0,
      },
    });

    const outcome = await runOpencodeAgent({
      sandbox,
      proxyOrigin: 'https://apollo.example',
      proxyToken: 't',
      modelId: 'moonshotai/kimi-k3',
      taskText: 'arreglá el formulario',
    });

    expect(outcome.summary).toContain('Ajusté la validación');
  });

  it('throws when opencode exits non-zero so the step can retry', async () => {
    const { sandbox } = createFakeSandbox({
      execResult: { stdout: '', stderr: 'boom', exitCode: 1 },
    });

    await expect(
      runOpencodeAgent({
        sandbox,
        proxyOrigin: 'https://apollo.example',
        proxyToken: 't',
        modelId: 'moonshotai/kimi-k3',
        taskText: 'tarea',
      }),
    ).rejects.toThrow('opencode falló');
  });

  it('keeps the run command free of the token itself', () => {
    const command = buildOpencodeRunCommand({
      modelId: 'moonshotai/kimi-k3',
      taskText: 'auditá el repo',
    });
    expect(command).not.toContain('APOLLO_LLM_TOKEN=');
    expect(command).toContain(OPENCODE_SUMMARY_PATH);
  });
});

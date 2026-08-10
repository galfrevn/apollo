import { describe, expect, it } from 'bun:test';

import { createFakeApolloEnvironment } from '@/configuration/testing';
import { createInactiveDeskFocusState } from '@/focus/logic';
import { addMemoryRecord, type MemorySqlExecutor } from '@/memory/store';
import { buildToolDefinitionMap } from '@/tools/router';
import type { ToolDefinition } from '@/tools/types';
import { runDeskTurn } from '@/turn/run';

function createInMemorySqlExecutor(): MemorySqlExecutor {
  const memoryRowList: Array<{
    id: string;
    content: string;
    created_at: number;
  }> = [];
  return {
    execute<Row extends Record<string, unknown>>(
      query: string,
      ...bindValues: unknown[]
    ): readonly Row[] {
      if (query.startsWith('INSERT INTO memories')) {
        memoryRowList.push({
          id: String(bindValues[0]),
          content: String(bindValues[1]),
          created_at: Number(bindValues[2]),
        });
        return [];
      }
      if (query.includes('LIKE')) {
        const likePattern = String(bindValues[0]).replaceAll('%', '');
        const limit = Number(bindValues[1]);
        return memoryRowList
          .filter((row) => row.content.toLowerCase().includes(likePattern.toLowerCase()))
          .slice(0, limit) as unknown as readonly Row[];
      }
      if (query.startsWith('SELECT id, content')) {
        const limit = Number(bindValues[0]);
        return [...memoryRowList]
          .toSorted((left, right) => right.created_at - left.created_at)
          .slice(0, limit) as unknown as readonly Row[];
      }
      return [];
    },
  };
}

const fakeEnvironment = createFakeApolloEnvironment();

describe('runDeskTurn', () => {
  it('text turn recalls memory and speaks', async () => {
    const sqlExecutor = createInMemorySqlExecutor();
    await addMemoryRecord(sqlExecutor, 'tomo mate a la mañana', 1, () => 'm1');
    let capturedSystemPrompt = '';

    const output = await runDeskTurn({
      text: 'qué desayuno?',
      speechMode: 'default',
      focusState: createInactiveDeskFocusState(),
      sqlExecutor,
      environment: fakeEnvironment,
      toolDefinitionMap: buildToolDefinitionMap([]),
      nowMilliseconds: 10,
      adapters: {
        stt: async () => '',
        llm: async ({ messageList }) => {
          const systemMessage = messageList.find((message) => message.role === 'system');
          const systemPrompt =
            systemMessage?.role === 'system' ? systemMessage.content : '';
          capturedSystemPrompt = systemPrompt;
          return {
            text: systemPrompt.includes('mate') ? 'Tomás mate de mañana.' : 'No sé.',
            toolCallList: [],
          };
        },
        tts: async (text) => new TextEncoder().encode(text).buffer as ArrayBuffer,
      },
    });

    expect(output.spokenText).toContain('mate');
    expect(output.uiEventList).toContain('START_SPEAK');
    expect(output.ttsAudio).toBeDefined();
    // The model always knows what time it is: the wall clock rides the prompt.
    expect(capturedSystemPrompt).toContain('Fecha y hora actual:');
  });

  it('unsafe tool pauses for confirm', async () => {
    const unsafeTool: ToolDefinition = {
      name: 'shell_exec_test',
      safety: 'unsafe',
      description: 'exec',
      parameters: { type: 'object', properties: {} },
      buildConfirmSummary: () => 'Ejecutar shell',
      async handler() {
        return { ok: true, summary: 'ejecutado' };
      },
    };

    const output = await runDeskTurn({
      text: 'corré un comando',
      speechMode: 'default',
      focusState: createInactiveDeskFocusState(),
      sqlExecutor: createInMemorySqlExecutor(),
      environment: fakeEnvironment,
      toolDefinitionMap: buildToolDefinitionMap([unsafeTool]),
      nowMilliseconds: 10,
      adapters: {
        stt: async () => '',
        llm: async () => ({
          text: '',
          toolCallList: [
            {
              id: '1',
              name: 'shell_exec_test',
              args: { command: 'ls' },
            },
          ],
        }),
        tts: async () => new ArrayBuffer(0),
      },
    });

    expect(output.pendingConfirmation).toBeTruthy();
    expect(output.uiEventList).toContain('NEED_CONFIRM');
  });

  it('emits thinking captions before tools', async () => {
    const captionList: string[] = [];
    const weatherTool: ToolDefinition = {
      name: 'weather_now',
      safety: 'safe',
      description: 'clima',
      parameters: { type: 'object', properties: {} },
      async handler() {
        return { ok: true, summary: '18C' };
      },
    };
    await runDeskTurn({
      text: 'clima',
      speechMode: 'default',
      focusState: createInactiveDeskFocusState(),
      sqlExecutor: createInMemorySqlExecutor(),
      environment: fakeEnvironment,
      toolDefinitionMap: buildToolDefinitionMap([weatherTool]),
      nowMilliseconds: 10,
      onThinkingCaption: (caption) => {
        captionList.push(caption);
      },
      adapters: {
        stt: async () => '',
        llm: async ({ messageList }) => {
          const hasToolResult = messageList.some((message) => message.role === 'tool');
          if (!hasToolResult) {
            return {
              text: '',
              toolCallList: [{ id: 'c1', name: 'weather_now', args: {} }],
            };
          }
          return { text: 'Hay 18 grados.', toolCallList: [] };
        },
        tts: async (text) => new TextEncoder().encode(text).buffer as ArrayBuffer,
      },
    });
    expect(captionList[0]).toBe('Pensando…');
    expect(captionList).toContain('Consultando clima…');
  });

  it('runs a tool then speaks model follow-up', async () => {
    let callCount = 0;
    const weatherTool: ToolDefinition = {
      name: 'weather_now',
      safety: 'safe',
      description: 'clima',
      parameters: { type: 'object', properties: {} },
      async handler() {
        return { ok: true, summary: '18°C Despejado' };
      },
    };
    const output = await runDeskTurn({
      text: 'cómo está el clima?',
      speechMode: 'default',
      focusState: createInactiveDeskFocusState(),
      sqlExecutor: createInMemorySqlExecutor(),
      environment: fakeEnvironment,
      toolDefinitionMap: buildToolDefinitionMap([weatherTool]),
      nowMilliseconds: 10,
      adapters: {
        stt: async () => '',
        llm: async ({ messageList }) => {
          callCount += 1;
          if (callCount === 1) {
            return {
              text: '',
              toolCallList: [{ id: 'c1', name: 'weather_now', args: {} }],
            };
          }
          const hasToolResult = messageList.some((message) => message.role === 'tool');
          expect(hasToolResult).toBe(true);
          return {
            text: 'Está a 18 grados, despejado.',
            toolCallList: [],
          };
        },
        tts: async (text) => new TextEncoder().encode(text).buffer as ArrayBuffer,
      },
    });
    expect(callCount).toBe(2);
    expect(output.spokenText).toContain('18');
    expect(output.toolResultList[0]?.summary).toContain('18');
  });

  it('reuses the speculative first-segment synthesis started during streaming', async () => {
    const sentence = 'Esta es una respuesta larga que sigue y sigue con más detalle.';
    const longReply = Array.from({ length: 12 }, () => sentence).join(' ');
    const synthesizedTextList: string[] = [];

    const output = await runDeskTurn({
      text: 'contame todo',
      speechMode: 'default',
      focusState: createInactiveDeskFocusState(),
      sqlExecutor: createInMemorySqlExecutor(),
      environment: fakeEnvironment,
      toolDefinitionMap: buildToolDefinitionMap([]),
      nowMilliseconds: 10,
      adapters: {
        stt: async () => '',
        llm: async ({ onTextDelta }) => {
          for (const word of longReply.split(' ')) {
            onTextDelta?.(`${word} `);
          }
          return { text: longReply, toolCallList: [] };
        },
        tts: async (text) => {
          synthesizedTextList.push(text);
          return new TextEncoder().encode(text).buffer as ArrayBuffer;
        },
      },
    });

    expect(synthesizedTextList).toHaveLength(1);
    expect(longReply.startsWith(synthesizedTextList[0])).toBe(true);
    expect(output.ttsAudio).toBeDefined();
    expect(output.ttsFollowUpSegmentTextList?.length).toBeGreaterThan(0);
  });

  it('discards speculation from a round that turns into tool calls', async () => {
    const sentence = 'Voy fijándome varias cosas mientras tanto para responderte bien.';
    const streamedPreamble = Array.from({ length: 8 }, () => sentence).join(' ');
    const synthesizedTextList: string[] = [];
    let llmCallCount = 0;
    const weatherTool: ToolDefinition = {
      name: 'weather_now',
      safety: 'safe',
      description: 'clima',
      parameters: { type: 'object', properties: {} },
      async handler() {
        return { ok: true, summary: '18°C Despejado' };
      },
    };

    const output = await runDeskTurn({
      text: 'cómo está el clima?',
      speechMode: 'default',
      focusState: createInactiveDeskFocusState(),
      sqlExecutor: createInMemorySqlExecutor(),
      environment: fakeEnvironment,
      toolDefinitionMap: buildToolDefinitionMap([weatherTool]),
      nowMilliseconds: 10,
      adapters: {
        stt: async () => '',
        llm: async ({ onTextDelta }) => {
          llmCallCount += 1;
          if (llmCallCount === 1) {
            for (const word of streamedPreamble.split(' ')) {
              onTextDelta?.(`${word} `);
            }
            return {
              text: streamedPreamble,
              toolCallList: [{ id: 'c1', name: 'weather_now', args: {} }],
            };
          }
          return { text: 'Está a 18 grados.', toolCallList: [] };
        },
        tts: async (text) => {
          synthesizedTextList.push(text);
          return new TextEncoder().encode(text).buffer as ArrayBuffer;
        },
      },
    });

    expect(output.spokenText).toBe('Está a 18 grados.');
    // The preamble's speculation was thrown away, so the final reply is
    // synthesized exactly once rather than reusing stale audio.
    expect(
      synthesizedTextList.filter((text) => text === 'Está a 18 grados.'),
    ).toHaveLength(1);
    expect(synthesizedTextList.at(-1)).toBe('Está a 18 grados.');
  });

  it('synthesizes only the first segment of a long reply and returns the rest as text', async () => {
    const sentence = 'Esta es una respuesta larga que sigue y sigue con más detalle.';
    const longReply = Array.from({ length: 12 }, () => sentence).join(' ');
    const synthesizedTextList: string[] = [];

    const output = await runDeskTurn({
      text: 'contame todo',
      speechMode: 'default',
      focusState: createInactiveDeskFocusState(),
      sqlExecutor: createInMemorySqlExecutor(),
      environment: fakeEnvironment,
      toolDefinitionMap: buildToolDefinitionMap([]),
      nowMilliseconds: 10,
      adapters: {
        stt: async () => '',
        llm: async () => ({ text: longReply, toolCallList: [] }),
        tts: async (text) => {
          synthesizedTextList.push(text);
          return new TextEncoder().encode(text).buffer as ArrayBuffer;
        },
      },
    });

    // Only the first segment renders inside the turn; the caller speaks the
    // rest while the device is already playing.
    expect(synthesizedTextList).toHaveLength(1);
    expect(longReply.startsWith(synthesizedTextList[0])).toBe(true);
    expect(output.ttsFollowUpSegmentTextList?.length).toBeGreaterThan(0);
    const reassembledText = [
      synthesizedTextList[0],
      ...(output.ttsFollowUpSegmentTextList ?? []),
    ]
      .join(' ')
      .replaceAll(/\s+/g, ' ');
    expect(reassembledText).toBe(longReply.replaceAll(/\s+/g, ' '));
  });
});

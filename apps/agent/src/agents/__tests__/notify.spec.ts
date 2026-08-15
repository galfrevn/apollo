import { describe, expect, it } from 'bun:test';

import type { Connection } from 'agents';

import {
  buildNotificationSpokenText,
  deliverDeskDeviceNotification,
} from '@/agents/notify';
import { createInactiveDeskFocusState } from '@/focus/logic';
import type { MemorySqlExecutor } from '@/memory/store';

describe('notification speech', () => {
  it('speaks reminders without changing their message', () => {
    expect(
      buildNotificationSpokenText({
        type: 'reminder',
        message: 'Sacá la ropa del lavarropas.',
      }),
    ).toBe('Sacá la ropa del lavarropas.');
  });

  it('frames background results with the task that finished', () => {
    expect(
      buildNotificationSpokenText({
        type: 'background_result',
        prompt: 'investigar vuelos a Mendoza',
        summary: 'Encontré tres opciones directas.',
      }),
    ).toBe('Terminé investigar vuelos a Mendoza: Encontré tres opciones directas.');
  });

  it('keeps long background prompts from delaying the result summary', () => {
    const spokenText = buildNotificationSpokenText({
      type: 'background_result',
      prompt: `investigar\n${'todos los vuelos disponibles '.repeat(200)}`,
      summary: 'Encontré tres opciones directas.',
    });

    expect(spokenText).toStartWith('Terminé investigar todos los vuelos disponibles');
    expect(spokenText).toContain('…: Encontré tres opciones directas.');
    expect(spokenText).not.toContain('\n');
    expect(spokenText.length).toBe(
      'Terminé '.length + 120 + ': Encontré tres opciones directas.'.length,
    );
  });

  it('delivers the framed text through the mock voice announcement path', async () => {
    const sentMessageList: (string | ArrayBuffer)[] = [];
    const connection = {
      send(message: string | ArrayBuffer) {
        sentMessageList.push(message);
      },
    } as Connection;

    await deliverDeskDeviceNotification({
      notification: {
        type: 'background_result',
        prompt: 'investigar vuelos a Mendoza',
        summary: 'Encontré tres opciones directas.',
      },
      connectionList: [connection],
      sqlExecutor: (() => {
        throw new Error('connected delivery must not write a pending notification');
      }) as unknown as MemorySqlExecutor,
      focusState: createInactiveDeskFocusState(),
      environment: {} as Env,
      deviceId: 'desk',
      ttsVoiceId: 'mock',
      isMockVoice: true,
    });

    const controlMessageTypeList = sentMessageList
      .filter((message): message is string => typeof message === 'string')
      .map((message) => JSON.parse(message) as { readonly type: string })
      .map((message) => message.type);
    expect(controlMessageTypeList).toEqual([
      'background_result',
      'tts_start',
      'tts_end',
      'turn_end',
    ]);

    const audioChunkList = sentMessageList.filter(
      (message): message is ArrayBuffer => message instanceof ArrayBuffer,
    );
    const audioByteLength = audioChunkList.reduce(
      (total, chunk) => total + chunk.byteLength,
      0,
    );
    const audioBytes = new Uint8Array(audioByteLength);
    let byteOffset = 0;
    for (const chunk of audioChunkList) {
      audioBytes.set(new Uint8Array(chunk), byteOffset);
      byteOffset += chunk.byteLength;
    }
    expect(new TextDecoder().decode(audioBytes)).toBe(
      'Terminé investigar vuelos a Mendoza: Encontré tres opciones directas.',
    );
  });
});

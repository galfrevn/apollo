import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { startApolloHost, type ApolloHost } from '@/host/main';

const DEVICE_SECRET = 'device-secret';
const DASHBOARD_SECRET = 'dashboard-secret';

let host: ApolloHost;
let dataDirectory: string;

beforeAll(async () => {
  dataDirectory = join(tmpdir(), `apollo-host-${crypto.randomUUID()}`);
  host = await startApolloHost({
    APOLLO_HOST_PORT: '0',
    APOLLO_DATA_DIRECTORY: dataDirectory,
    DEVICE_SHARED_SECRET: DEVICE_SECRET,
    DASHBOARD_SHARED_SECRET: DASHBOARD_SECRET,
    MOCK_VOICE: '1',
  });
});

afterAll(async () => {
  host.stop();
  await rm(dataDirectory, { recursive: true, force: true });
});

type ReceivedFrame =
  | { readonly kind: 'json'; readonly payload: unknown }
  | {
      readonly kind: 'binary';
    };

function openFrameCollector(path: string): Promise<{
  socket: WebSocket;
  frameList: ReceivedFrame[];
  waitForFrame: (
    predicate: (frame: ReceivedFrame) => boolean,
    timeoutMilliseconds?: number,
  ) => Promise<ReceivedFrame>;
}> {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(`ws://localhost:${host.port}${path}`);
    socket.binaryType = 'arraybuffer';
    const frameList: ReceivedFrame[] = [];
    const waiterList: {
      predicate: (frame: ReceivedFrame) => boolean;
      resolveWaiter: (frame: ReceivedFrame) => void;
    }[] = [];
    socket.addEventListener('message', (event) => {
      const frame: ReceivedFrame =
        typeof event.data === 'string'
          ? { kind: 'json', payload: JSON.parse(event.data) }
          : { kind: 'binary' };
      frameList.push(frame);
      const waiterIndex = waiterList.findIndex((waiter) => waiter.predicate(frame));
      if (waiterIndex >= 0) {
        const [matchedWaiter] = waiterList.splice(waiterIndex, 1);
        matchedWaiter.resolveWaiter(frame);
      }
    });
    socket.addEventListener('open', () => {
      resolve({
        socket,
        frameList,
        waitForFrame: (predicate, timeoutMilliseconds = 10_000) =>
          new Promise((resolveWaiter, rejectWaiter) => {
            const matchedFrame = frameList.find(predicate);
            if (matchedFrame !== undefined) {
              resolveWaiter(matchedFrame);
              return;
            }
            const timeout = setTimeout(
              () => rejectWaiter(new Error('timed out waiting for frame')),
              timeoutMilliseconds,
            );
            waiterList.push({
              predicate,
              resolveWaiter: (frame) => {
                clearTimeout(timeout);
                resolveWaiter(frame);
              },
            });
          }),
      });
    });
    socket.addEventListener('error', () => reject(new Error('socket failed to open')));
  });
}

function isJsonFrameOfType(frame: ReceivedFrame, typeName: string): boolean {
  return (
    frame.kind === 'json' &&
    typeof frame.payload === 'object' &&
    frame.payload !== null &&
    'type' in frame.payload &&
    frame.payload.type === typeName
  );
}

describe('apollo host', () => {
  test('health advertises the host', async () => {
    const healthResponse = await fetch(`http://localhost:${host.port}/health`);
    const healthPayload = (await healthResponse.json()) as {
      ok: boolean;
      name: string;
      features: string[];
    };
    expect(healthPayload.ok).toBe(true);
    expect(healthPayload.name).toBe('apollo');
    expect(healthPayload.features).toContain('host');
  });

  test('ota check answers empty without a manifest', async () => {
    const otaResponse = await fetch(
      `http://localhost:${host.port}/ota/check?token=${DEVICE_SECRET}`,
    );
    expect(otaResponse.status).toBe(200);
    await expect(otaResponse.json()).resolves.toEqual({});
  });

  test('a device completes a mock text turn over the protocol', async () => {
    const device = await openFrameCollector(`/agents/apollo/desk?token=${DEVICE_SECRET}`);
    await device.waitForFrame((frame) => isJsonFrameOfType(frame, 'ui_state'));

    device.socket.send(
      JSON.stringify({ type: 'text_input', text: 'hola apollo', ts: Date.now() }),
    );
    await device.waitForFrame((frame) => isJsonFrameOfType(frame, 'tts_start'));
    await device.waitForFrame((frame) => frame.kind === 'binary');
    await device.waitForFrame((frame) => isJsonFrameOfType(frame, 'turn_end'));
    device.socket.close();
  });

  test('the console gets identity, state sync, and rpc over the SDK framing', async () => {
    const consoleClient = await openFrameCollector(
      `/agents/apollo/desk?token=${DASHBOARD_SECRET}`,
    );
    const identityFrame = await consoleClient.waitForFrame((frame) =>
      isJsonFrameOfType(frame, 'cf_agent_identity'),
    );
    expect(identityFrame.kind === 'json' && identityFrame.payload).toMatchObject({
      agent: 'apollo',
      name: 'desk',
    });
    await consoleClient.waitForFrame((frame) =>
      isJsonFrameOfType(frame, 'cf_agent_state'),
    );

    consoleClient.socket.send(
      JSON.stringify({
        type: 'rpc',
        id: 'rpc-1',
        method: 'addConsoleListItem',
        args: [{ secret: DASHBOARD_SECRET, listName: 'super', content: 'yerba' }],
      }),
    );
    const listResultFrame = await consoleClient.waitForFrame(
      (frame) =>
        frame.kind === 'json' &&
        typeof frame.payload === 'object' &&
        frame.payload !== null &&
        'id' in frame.payload &&
        frame.payload.id === 'rpc-1',
    );
    expect(listResultFrame.kind === 'json' && listResultFrame.payload).toMatchObject({
      type: 'rpc',
      success: true,
    });

    consoleClient.socket.send(
      JSON.stringify({
        type: 'rpc',
        id: 'rpc-2',
        method: 'browseConsoleMemory',
        args: [{ secret: 'wrong-secret' }],
      }),
    );
    const unauthorizedFrame = await consoleClient.waitForFrame(
      (frame) =>
        frame.kind === 'json' &&
        typeof frame.payload === 'object' &&
        frame.payload !== null &&
        'id' in frame.payload &&
        frame.payload.id === 'rpc-2',
    );
    expect(unauthorizedFrame.kind === 'json' && unauthorizedFrame.payload).toMatchObject({
      success: false,
      error: 'Unauthorized',
    });

    consoleClient.socket.send(
      JSON.stringify({
        type: 'rpc',
        id: 'rpc-3',
        method: 'setConsoleSpeechMode',
        args: [{ secret: DASHBOARD_SECRET, speechModeId: 'default' }],
      }),
    );
    await consoleClient.waitForFrame(
      (frame) =>
        frame.kind === 'json' &&
        typeof frame.payload === 'object' &&
        frame.payload !== null &&
        'id' in frame.payload &&
        frame.payload.id === 'rpc-3',
    );
    const stateFrameCount = consoleClient.frameList.filter((frame) =>
      isJsonFrameOfType(frame, 'cf_agent_state'),
    ).length;
    expect(stateFrameCount).toBeGreaterThanOrEqual(2);
    consoleClient.socket.close();
  });

  test('the device mcp bridge answers a console volume rpc through a live device', async () => {
    const device = await openFrameCollector(`/agents/apollo/desk?token=${DEVICE_SECRET}`);
    await device.waitForFrame((frame) => isJsonFrameOfType(frame, 'ui_state'));
    device.socket.addEventListener('message', (event) => {
      if (typeof event.data !== 'string') {
        return;
      }
      const parsedFrame = JSON.parse(event.data) as {
        type?: string;
        payload?: { id: number; method?: string };
      };
      if (parsedFrame.type === 'mcp' && parsedFrame.payload?.method === 'tools/call') {
        device.socket.send(
          JSON.stringify({
            type: 'mcp',
            ts: Date.now(),
            payload: {
              jsonrpc: '2.0',
              id: parsedFrame.payload.id,
              result: { content: [{ type: 'text', text: 'volumen en 40' }] },
            },
          }),
        );
      }
    });

    const consoleClient = await openFrameCollector(
      `/agents/apollo/desk?token=${DASHBOARD_SECRET}`,
    );
    consoleClient.socket.send(
      JSON.stringify({
        type: 'rpc',
        id: 'rpc-volume',
        method: 'setConsoleDeviceVolume',
        args: [{ secret: DASHBOARD_SECRET, volume: 40 }],
      }),
    );
    const volumeResultFrame = await consoleClient.waitForFrame(
      (frame) =>
        frame.kind === 'json' &&
        typeof frame.payload === 'object' &&
        frame.payload !== null &&
        'id' in frame.payload &&
        frame.payload.id === 'rpc-volume',
    );
    expect(volumeResultFrame.kind === 'json' && volumeResultFrame.payload).toMatchObject({
      success: true,
      result: { ok: true },
    });
    device.socket.close();
    consoleClient.socket.close();
  });

  test('a voice turn rotates onto a thread the console can list', async () => {
    const device = await openFrameCollector(`/agents/apollo/desk?token=${DEVICE_SECRET}`);
    await device.waitForFrame((frame) => isJsonFrameOfType(frame, 'ui_state'));
    device.socket.send(
      JSON.stringify({ type: 'text_input', text: 'anotá esto', ts: Date.now() }),
    );
    await device.waitForFrame((frame) => isJsonFrameOfType(frame, 'turn_end'));
    device.socket.close();

    const consoleClient = await openFrameCollector(
      `/agents/apollo/desk?token=${DASHBOARD_SECRET}`,
    );
    consoleClient.socket.send(
      JSON.stringify({
        type: 'rpc',
        id: 'rpc-threads',
        method: 'listConsoleThreads',
        args: [{ secret: DASHBOARD_SECRET }],
      }),
    );
    const threadListFrame = await consoleClient.waitForFrame(
      (frame) =>
        frame.kind === 'json' &&
        typeof frame.payload === 'object' &&
        frame.payload !== null &&
        'id' in frame.payload &&
        frame.payload.id === 'rpc-threads',
    );
    const threadListPayload =
      threadListFrame.kind === 'json'
        ? (threadListFrame.payload as { success: boolean; result: { title: string }[] })
        : undefined;
    expect(threadListPayload?.success).toBe(true);
    expect(threadListPayload?.result.length).toBeGreaterThanOrEqual(1);
    consoleClient.socket.close();
  });

  test('mcp servers list answers empty over rpc', async () => {
    const consoleClient = await openFrameCollector(
      `/agents/apollo/desk?token=${DASHBOARD_SECRET}`,
    );
    consoleClient.socket.send(
      JSON.stringify({
        type: 'rpc',
        id: 'rpc-mcp',
        method: 'listMcpServers',
        args: [{ secret: DASHBOARD_SECRET }],
      }),
    );
    const mcpListFrame = await consoleClient.waitForFrame(
      (frame) =>
        frame.kind === 'json' &&
        typeof frame.payload === 'object' &&
        frame.payload !== null &&
        'id' in frame.payload &&
        frame.payload.id === 'rpc-mcp',
    );
    expect(mcpListFrame.kind === 'json' && mcpListFrame.payload).toMatchObject({
      success: true,
      result: [],
    });
    consoleClient.socket.close();
  });

  test('a wrong token closes with the terminal policy violation code', async () => {
    const closeCode = await new Promise<number>((resolve) => {
      const socket = new WebSocket(
        `ws://localhost:${host.port}/agents/apollo/desk?token=wrong`,
      );
      socket.addEventListener('close', (event) => resolve(event.code));
    });
    expect(closeCode).toBe(1008);
  });
});

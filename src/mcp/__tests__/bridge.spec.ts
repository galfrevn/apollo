import { describe, expect, it } from 'bun:test';

import {
  buildDeviceToolCallPayload,
  createDeviceMcpRequestRegistry,
  summarizeDeviceToolResult,
} from '@/mcp/bridge';

describe('device mcp request registry', () => {
  it('assigns monotonically increasing integer ids', () => {
    const registry = createDeviceMcpRequestRegistry();
    const firstRequest = registry.createPendingRequest(1000);
    const secondRequest = registry.createPendingRequest(1000);
    expect(firstRequest.requestId).toBe(1);
    expect(secondRequest.requestId).toBe(2);
  });

  it('resolves a pending request by id', async () => {
    const registry = createDeviceMcpRequestRegistry();
    const { requestId, responsePromise } = registry.createPendingRequest(1000);
    const didResolve = registry.resolvePendingRequest({
      jsonrpc: '2.0',
      id: requestId,
      result: { content: [{ type: 'text', text: 'true' }], isError: false },
    });
    expect(didResolve).toBe(true);
    await expect(responsePromise).resolves.toMatchObject({ id: requestId });
  });

  it('resolves with undefined on timeout', async () => {
    const registry = createDeviceMcpRequestRegistry();
    const { responsePromise } = registry.createPendingRequest(5);
    await expect(responsePromise).resolves.toBeUndefined();
  });

  it('drops responses for unknown or already resolved ids', async () => {
    const registry = createDeviceMcpRequestRegistry();
    const { requestId, responsePromise } = registry.createPendingRequest(1000);
    const responsePayload = { jsonrpc: '2.0' as const, id: requestId, result: {} };
    expect(registry.resolvePendingRequest({ ...responsePayload, id: 999 })).toBe(false);
    expect(registry.resolvePendingRequest(responsePayload)).toBe(true);
    expect(registry.resolvePendingRequest(responsePayload)).toBe(false);
    await responsePromise;
  });
});

describe('device tool call payload', () => {
  it('builds a tools/call request the firmware accepts', () => {
    expect(
      buildDeviceToolCallPayload(7, 'self.audio_speaker.set_volume', { volume: 40 }),
    ).toEqual({
      jsonrpc: '2.0',
      id: 7,
      method: 'tools/call',
      params: { name: 'self.audio_speaker.set_volume', arguments: { volume: 40 } },
    });
  });
});

describe('device tool result summary', () => {
  it('reports a timeout when there is no response', () => {
    expect(summarizeDeviceToolResult(undefined)).toEqual({
      ok: false,
      summary: 'El dispositivo no respondió a tiempo.',
    });
  });

  it('reports the device error message', () => {
    const summarized = summarizeDeviceToolResult({
      jsonrpc: '2.0',
      id: 1,
      error: { message: 'Unknown tool: nope' },
    });
    expect(summarized.ok).toBe(false);
    expect(summarized.summary).toContain('Unknown tool: nope');
  });

  it('unwraps text content from a successful call', () => {
    expect(
      summarizeDeviceToolResult({
        jsonrpc: '2.0',
        id: 1,
        result: { content: [{ type: 'text', text: '{"battery":80}' }], isError: false },
      }),
    ).toEqual({ ok: true, summary: '{"battery":80}' });
  });

  it('treats isError content as a failure', () => {
    const summarized = summarizeDeviceToolResult({
      jsonrpc: '2.0',
      id: 1,
      result: { content: [{ type: 'text', text: 'se rompió' }], isError: true },
    });
    expect(summarized).toEqual({ ok: false, summary: 'se rompió' });
  });

  it('falls back to a generic success on unrecognized result shapes', () => {
    expect(summarizeDeviceToolResult({ jsonrpc: '2.0', id: 1, result: 42 })).toEqual({
      ok: true,
      summary: 'Hecho.',
    });
  });
});

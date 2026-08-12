import { summarizeMcpCallToolResult } from '@/mcp/result';
import type { ToolExecutionResult } from '@/tools/types';

export const DEVICE_TOOL_CALL_TIMEOUT_MILLISECONDS = 5_000;

export type DeviceMcpRequestPayload = {
  readonly jsonrpc: '2.0';
  readonly id: number;
  readonly method: string;
  readonly params?: Record<string, unknown>;
};

export type DeviceMcpResponsePayload = {
  readonly jsonrpc: '2.0';
  readonly id: number;
  readonly result?: unknown;
  readonly error?: {
    readonly code?: number;
    readonly message: string;
  };
};

export type DeviceMcpRequestRegistry = {
  readonly createPendingRequest: (timeoutMilliseconds: number) => {
    readonly requestId: number;
    readonly responsePromise: Promise<DeviceMcpResponsePayload | undefined>;
  };
  readonly resolvePendingRequest: (responsePayload: DeviceMcpResponsePayload) => boolean;
};

export function createDeviceMcpRequestRegistry(): DeviceMcpRequestRegistry {
  const pendingRequestMap = new Map<
    number,
    {
      readonly resolveResponse: (
        responsePayload: DeviceMcpResponsePayload | undefined,
      ) => void;
      readonly timeoutHandle: ReturnType<typeof setTimeout>;
    }
  >();
  let nextRequestId = 1;

  function settlePendingRequestById(
    requestId: number,
    responsePayload: DeviceMcpResponsePayload | undefined,
  ): boolean {
    const pendingRequest = pendingRequestMap.get(requestId);
    if (pendingRequest === undefined) {
      return false;
    }
    clearTimeout(pendingRequest.timeoutHandle);
    pendingRequestMap.delete(requestId);
    pendingRequest.resolveResponse(responsePayload);
    return true;
  }

  return {
    createPendingRequest(timeoutMilliseconds) {
      const requestId = nextRequestId;
      nextRequestId += 1;
      const responsePromise = new Promise<DeviceMcpResponsePayload | undefined>(
        (resolve) => {
          const timeoutHandle = setTimeout(
            () => settlePendingRequestById(requestId, undefined),
            timeoutMilliseconds,
          );
          pendingRequestMap.set(requestId, { resolveResponse: resolve, timeoutHandle });
        },
      );
      return { requestId, responsePromise };
    },
    resolvePendingRequest(responsePayload) {
      return settlePendingRequestById(responsePayload.id, responsePayload);
    },
  };
}

export function buildDeviceToolCallPayload(
  requestId: number,
  deviceToolName: string,
  argumentRecord: Record<string, unknown>,
): DeviceMcpRequestPayload {
  return {
    jsonrpc: '2.0',
    id: requestId,
    method: 'tools/call',
    params: { name: deviceToolName, arguments: argumentRecord },
  };
}

export function summarizeDeviceToolResult(
  responsePayload: DeviceMcpResponsePayload | undefined,
): ToolExecutionResult {
  if (responsePayload === undefined) {
    return { ok: false, summary: 'El dispositivo no respondió a tiempo.' };
  }
  if (responsePayload.error !== undefined) {
    return {
      ok: false,
      summary: `El dispositivo rechazó la orden: ${responsePayload.error.message}`,
    };
  }
  return summarizeMcpCallToolResult(
    responsePayload.result,
    'Hecho.',
    'El dispositivo devolvió un error.',
  );
}

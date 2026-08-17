import type { ApolloState } from '@/agents/apollo';
import { resolveApolloConnectionRole } from '@/auth/role';
import {
  encodeConsoleIdentityMessage,
  encodeConsoleMcpServersMessage,
  encodeConsoleRpcError,
  encodeConsoleRpcSuccess,
  encodeConsoleStateMessage,
  parseConsoleClientMessage,
} from '@/host/framing';
import type { ApolloHostActor, HostConnection } from '@/host/actor';
import type { HostConfiguration } from '@/host/configuration';
import { executeConsoleRpcMethod, type HostRpcDependencies } from '@/host/rpc';
import { handleOtaRequest } from '@/ota/routes';
import type { BlobStore } from '@/platform/blob';

type HostWebSocketData = {
  role: 'device' | 'dashboard' | null;
  requestOrigin: string;
  instanceName: string;
  connection?: HostConnection;
};

// The client rejects 1008 and 4000-4999 as terminal close codes and stops
// reconnecting; a bad token must land there instead of a retry loop.
const POLICY_VIOLATION_CLOSE_CODE = 1008;

export type ApolloHostServer = {
  readonly port: number;
  broadcastConsoleState(state: ApolloState): void;
  stop(): void;
};

export function createApolloHostServer(input: {
  readonly configuration: HostConfiguration;
  readonly actor: ApolloHostActor;
  readonly mediaBlobStore: BlobStore;
  readonly rpcDependencies: HostRpcDependencies;
}): ApolloHostServer {
  const { configuration, actor, rpcDependencies } = input;
  const consoleConnectionSet = new Set<HostConnection>();

  const bunServer = Bun.serve<HostWebSocketData>({
    port: configuration.port,
    async fetch(request, server) {
      const requestUrl = new URL(request.url);
      if (requestUrl.pathname === '/health') {
        return Response.json({
          ok: true,
          name: 'apollo',
          features: ['session', 'blob', 'vector', 'jobs', 'runs', 'host'],
        });
      }
      if (requestUrl.pathname.startsWith('/ota/')) {
        return handleOtaRequest(
          request,
          requestUrl,
          configuration.environment,
          input.mediaBlobStore,
        );
      }
      const agentPathMatch = requestUrl.pathname.match(/^\/agents\/apollo\/([^/]+)$/);
      if (agentPathMatch !== null) {
        const connectionRole = await resolveApolloConnectionRole(
          requestUrl,
          configuration.environment,
        );
        const didUpgrade = server.upgrade(request, {
          data: {
            role: connectionRole,
            requestOrigin: requestUrl.origin,
            instanceName: agentPathMatch[1],
          },
        });
        if (didUpgrade) {
          return undefined;
        }
        return new Response('Expected a websocket upgrade', { status: 426 });
      }
      return new Response('Not found', { status: 404 });
    },
    websocket: {
      async open(webSocket) {
        const wrappedConnection = wrapWebSocket(webSocket);
        if (
          webSocket.data.role === null ||
          webSocket.data.instanceName !== configuration.deviceName
        ) {
          webSocket.close(POLICY_VIOLATION_CLOSE_CODE, 'Unauthorized');
          return;
        }
        if (webSocket.data.role === 'device') {
          webSocket.data.connection = wrappedConnection;
          await actor.handleDeviceConnect(
            wrappedConnection,
            webSocket.data.requestOrigin,
          );
          return;
        }
        webSocket.data.connection = wrappedConnection;
        consoleConnectionSet.add(wrappedConnection);
        wrappedConnection.send(
          encodeConsoleIdentityMessage({
            agentName: 'apollo',
            instanceName: configuration.deviceName,
          }),
        );
        wrappedConnection.send(encodeConsoleStateMessage(actor.getState()));
        wrappedConnection.send(encodeConsoleMcpServersMessage());
      },
      async message(webSocket, rawMessage) {
        const connection = webSocket.data.connection;
        if (connection === undefined) {
          return;
        }
        if (webSocket.data.role === 'device') {
          await actor.handleDeviceMessage(
            connection,
            typeof rawMessage === 'string' ? rawMessage : toArrayBuffer(rawMessage),
          );
          return;
        }
        if (typeof rawMessage !== 'string') {
          return;
        }
        const parsedMessage = parseConsoleClientMessage(rawMessage);
        if (parsedMessage.kind !== 'rpc') {
          return;
        }
        try {
          const result = await executeConsoleRpcMethod(
            parsedMessage.request.method,
            parsedMessage.request.args,
            rpcDependencies,
          );
          connection.send(encodeConsoleRpcSuccess(parsedMessage.request.id, result));
        } catch (error) {
          connection.send(
            encodeConsoleRpcError(
              parsedMessage.request.id,
              error instanceof Error ? error.message : String(error),
            ),
          );
        }
      },
      close(webSocket) {
        const connection = webSocket.data.connection;
        if (connection === undefined) {
          return;
        }
        if (webSocket.data.role === 'device') {
          actor.handleDeviceDisconnect(connection);
          return;
        }
        consoleConnectionSet.delete(connection);
      },
    },
  });

  return {
    port: bunServer.port ?? configuration.port,
    broadcastConsoleState(state) {
      const encodedStateMessage = encodeConsoleStateMessage(state);
      for (const connection of consoleConnectionSet) {
        connection.send(encodedStateMessage);
      }
    },
    stop() {
      bunServer.stop(true);
    },
  };
}

function wrapWebSocket(webSocket: {
  send(message: string | ArrayBuffer | Uint8Array): void;
}): HostConnection {
  return {
    send(message) {
      if (typeof message === 'string' || message instanceof ArrayBuffer) {
        webSocket.send(message);
        return;
      }
      webSocket.send(
        new Uint8Array(message.buffer, message.byteOffset, message.byteLength),
      );
    },
  };
}

function toArrayBuffer(rawMessage: Uint8Array | Buffer): ArrayBuffer {
  const copiedBuffer = new ArrayBuffer(rawMessage.byteLength);
  new Uint8Array(copiedBuffer).set(
    new Uint8Array(rawMessage.buffer, rawMessage.byteOffset, rawMessage.byteLength),
  );
  return copiedBuffer;
}

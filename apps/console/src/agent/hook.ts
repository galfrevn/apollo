import { useAgent } from 'agents/react';

import type { ApolloAgentState } from '@/agent/schema';
import type { ConsoleConnection } from '@/connection/schema';

export function useApolloAgent(connection: ConsoleConnection) {
  return useAgent<ApolloAgentState>({
    host: connection.workerUrl,
    agent: 'apollo',
    name: connection.deviceName,
    query: { token: connection.secret },
  });
}

export type ApolloAgentHandle = ReturnType<typeof useApolloAgent>;

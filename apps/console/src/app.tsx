import { ConnectionProvider, useConnection } from '@/connection/context';
import { ConnectScreen } from '@/connection/screen';
import { Shell } from '@/layout/shell';
import { useDocumentMetadata } from '@/router/metadata';

function DisconnectedScreen() {
  useDocumentMetadata(null);
  return <ConnectScreen />;
}

function Gate() {
  const { connection } = useConnection();
  if (connection === null) {
    return <DisconnectedScreen />;
  }
  return (
    <Shell
      key={`${connection.workerUrl}/${connection.deviceName}`}
      connection={connection}
    />
  );
}

export function App() {
  return (
    <ConnectionProvider>
      <Gate />
    </ConnectionProvider>
  );
}

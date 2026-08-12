import { ConnectionProvider, useConnection } from '@/connection/context';
import { ConnectScreen } from '@/connection/screen';
import { Shell } from '@/layout/shell';

function Gate() {
  const { connection } = useConnection();
  if (connection === null) {
    return <ConnectScreen />;
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

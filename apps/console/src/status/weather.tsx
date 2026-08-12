import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { ConsoleRpc } from '@/agent/rpc';
import type { WeatherLocation } from '@/agent/schema';

export function WeatherPanel({ consoleRpc }: { readonly consoleRpc: ConsoleRpc }) {
  const [location, setLocation] = useState<WeatherLocation | null>(null);
  const [locationQuery, setLocationQuery] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    void consoleRpc
      .getWeather()
      .then(setLocation)
      .catch(() => setErrorMessage('Could not load the weather location.'));
  }, [consoleRpc]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const trimmedQuery = locationQuery.trim();
    if (trimmedQuery.length === 0) {
      return;
    }
    setIsSaving(true);
    setErrorMessage(null);
    try {
      setLocation(await consoleRpc.setWeather(trimmedQuery));
      setLocationQuery('');
    } catch {
      setErrorMessage(`No location found for “${trimmedQuery}”.`);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="space-y-3 p-4">
      <div>
        <p className="text-sm">
          {location === null ? 'Loading…' : location.locationLabel}
        </p>
        {location !== null && (
          <p className="mt-0.5 font-mono text-xs text-faint">
            {location.latitude.toFixed(2)}, {location.longitude.toFixed(2)} ·{' '}
            {location.timezone}
          </p>
        )}
      </div>
      <form onSubmit={handleSubmit} className="flex gap-2" aria-busy={isSaving}>
        <Input
          value={locationQuery}
          onChange={(event) => setLocationQuery(event.target.value)}
          placeholder="Change city…"
          aria-label="New weather location"
        />
        <Button type="submit" variant="outline" disabled={isSaving}>
          {isSaving ? 'Saving…' : 'Set'}
        </Button>
      </form>
      {errorMessage !== null && (
        <p role="alert" className="text-xs text-danger">
          {errorMessage}
        </p>
      )}
    </div>
  );
}

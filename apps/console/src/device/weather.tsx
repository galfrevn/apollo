import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { DEVICE_MESSAGE_CATALOG } from '@/device/copy';
import { useMessages } from '@/locale/context';
import type { ConsoleRpc } from '@/agent/rpc';
import type { WeatherLocation } from '@/agent/schema';

export function WeatherPanel({ consoleRpc }: { readonly consoleRpc: ConsoleRpc }) {
  const deviceMessages = useMessages(DEVICE_MESSAGE_CATALOG);
  const [location, setLocation] = useState<WeatherLocation | null>(null);
  const [locationQuery, setLocationQuery] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    void consoleRpc
      .getWeather()
      .then(setLocation)
      .catch(() => setErrorMessage(deviceMessages.weatherLoadError));
  }, [consoleRpc, deviceMessages.weatherLoadError]);

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
      setErrorMessage(deviceMessages.weatherNotFoundError(trimmedQuery));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="space-y-3 p-4">
      {location === null ? (
        <div>
          <div className="flex h-5 items-center">
            <Skeleton className="h-4 w-44" />
          </div>
          <div className="mt-0.5 flex h-4 items-center">
            <Skeleton className="h-3 w-56" />
          </div>
        </div>
      ) : (
        <div>
          <p className="text-sm">{location.locationLabel}</p>
          <p className="mt-0.5 text-xs text-dim">
            {location.latitude.toFixed(2)}, {location.longitude.toFixed(2)} ·{' '}
            {location.timezone}
          </p>
        </div>
      )}
      <form onSubmit={handleSubmit} className="flex gap-2" aria-busy={isSaving}>
        <Input
          value={locationQuery}
          onChange={(event) => setLocationQuery(event.target.value)}
          placeholder={deviceMessages.weatherPlaceholder}
          aria-label={deviceMessages.weatherInputAriaLabel}
        />
        <Button type="submit" variant="outline" disabled={isSaving}>
          {isSaving ? deviceMessages.savingLabel : deviceMessages.applyLabel}
        </Button>
      </form>
      {errorMessage !== null && (
        <p role="alert" className="text-xs text-destructive">
          {errorMessage}
        </p>
      )}
    </div>
  );
}

import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { DEVICE_MESSAGES } from '@/device/copy';

import type { ConsoleRpc } from '@/agent/rpc';
import type { WeatherLocation } from '@/agent/schema';

type WeatherFailure =
  | { readonly kind: 'load' }
  | { readonly kind: 'notfound'; readonly locationQuery: string };

export function WeatherPanel({ consoleRpc }: { readonly consoleRpc: ConsoleRpc }) {
  const deviceMessages = DEVICE_MESSAGES;
  const [location, setLocation] = useState<WeatherLocation | null>(null);
  const [locationQuery, setLocationQuery] = useState('');
  const [weatherFailure, setWeatherFailure] = useState<WeatherFailure | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    void consoleRpc
      .getWeather()
      .then(setLocation)
      .catch(() => setWeatherFailure({ kind: 'load' }));
  }, [consoleRpc]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const trimmedQuery = locationQuery.trim();
    if (trimmedQuery.length === 0) {
      return;
    }
    setIsSaving(true);
    setWeatherFailure(null);
    try {
      setLocation(await consoleRpc.setWeather(trimmedQuery));
      setLocationQuery('');
    } catch {
      setWeatherFailure({ kind: 'notfound', locationQuery: trimmedQuery });
    } finally {
      setIsSaving(false);
    }
  }

  const failureMessage =
    weatherFailure === null
      ? null
      : weatherFailure.kind === 'load'
        ? deviceMessages.weatherLoadError
        : deviceMessages.weatherNotFoundError(weatherFailure.locationQuery);

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
      {failureMessage !== null && (
        <p role="alert" className="text-xs text-destructive">
          {failureMessage}
        </p>
      )}
    </div>
  );
}

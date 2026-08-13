import { cn } from '@/components/utility';
import { useLocale } from '@/locale/context';
import { SUPPORTED_LOCALE_LIST } from '@/locale/detect';
import type { Locale } from '@/locale/detect';

const TOGGLE_ARIA_LABEL_MAP: Record<Locale, string> = {
  es: 'Idioma de la interfaz',
  en: 'Interface language',
};

export function LocaleToggle({ className }: { readonly className?: string }) {
  const { locale, setLocale } = useLocale();

  return (
    <div
      role="group"
      aria-label={TOGGLE_ARIA_LABEL_MAP[locale]}
      className={cn('flex items-center gap-2 text-xs', className)}
    >
      {SUPPORTED_LOCALE_LIST.map((candidateLocale) => (
        <button
          key={candidateLocale}
          type="button"
          aria-pressed={candidateLocale === locale}
          onClick={() => setLocale(candidateLocale)}
          className={cn(
            'transition-colors duration-150',
            candidateLocale === locale
              ? 'text-foreground'
              : 'text-dim hover:text-foreground',
          )}
        >
          {candidateLocale}
        </button>
      ))}
    </div>
  );
}

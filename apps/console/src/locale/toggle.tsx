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
  const activeLocaleIndex = SUPPORTED_LOCALE_LIST.indexOf(locale);

  return (
    <div
      role="group"
      aria-label={TOGGLE_ARIA_LABEL_MAP[locale]}
      className={cn('relative flex border bg-card text-xs', className)}
    >
      <span
        aria-hidden
        className="absolute inset-y-0 left-0 w-1/2 bg-accent transition-transform duration-200 ease-[cubic-bezier(0.4,0,0.2,1)]"
        style={{ transform: `translateX(${activeLocaleIndex * 100}%)` }}
      />
      {SUPPORTED_LOCALE_LIST.map((candidateLocale) => (
        <button
          key={candidateLocale}
          type="button"
          aria-pressed={candidateLocale === locale}
          onClick={() => setLocale(candidateLocale)}
          className={cn(
            'relative w-9 py-1 text-center transition-colors duration-200',
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

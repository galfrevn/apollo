import { LANDING_MESSAGES_EN } from '@/landing/copy/en';
import { LANDING_MESSAGES_ES } from '@/landing/copy/es';
import type { LandingMessages } from '@/landing/copy/messages';
import type { Locale } from '@/locale/detect';

export const LANDING_MESSAGE_CATALOG: Record<Locale, LandingMessages> = {
  es: LANDING_MESSAGES_ES,
  en: LANDING_MESSAGES_EN,
};

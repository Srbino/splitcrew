import en, { type Translations } from './locales/en';
import cs from './locales/cs';

/** Supported locales */
export const LOCALES = {
  en: { code: 'en', name: 'English',  flag: '🇬🇧' },
  cs: { code: 'cs', name: 'Čeština',  flag: '🇨🇿' },
} as const;

export type LocaleCode = keyof typeof LOCALES;

const translations: Record<LocaleCode, Translations> = { en, cs };

/** Default locale */
export const DEFAULT_LOCALE: LocaleCode = 'en';

/**
 * Get the translations object for a given locale.
 * Falls back to English if locale is unknown.
 */
export function getTranslations(locale: string): Translations {
  return translations[locale as LocaleCode] ?? translations[DEFAULT_LOCALE];
}

/**
 * Get a nested translation value by dot-separated key.
 * Supports simple interpolation: {{variable}}
 *
 * Example: t('auth.tooManyAttempts', { minutes: 5 })
 * → "Too many attempts. Try again in 5 min."
 */
export function t(
  locale: string,
  key: string,
  params?: Record<string, string | number>
): string {
  const trans = getTranslations(locale);
  const keys = key.split('.');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let value: any = trans;
  for (const k of keys) {
    value = value?.[k];
    if (value === undefined) return key; // Return key if translation missing
  }

  if (typeof value !== 'string') return key;

  // Interpolate {{variable}} placeholders
  if (params) {
    return value.replace(/\{\{(\w+)\}\}/g, (_, varName) => {
      return String(params[varName] ?? `{{${varName}}}`);
    });
  }

  return value;
}

export type { Translations };

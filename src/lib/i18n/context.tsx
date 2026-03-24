'use client';

import { createContext, useContext, useCallback } from 'react';
import { t as translateFn, getTranslations, type Translations, type LocaleCode } from './index';

interface I18nContextValue {
  locale: LocaleCode;
  t: (key: string, params?: Record<string, string | number>) => string;
  translations: Translations;
}

const I18nContext = createContext<I18nContextValue>({
  locale: 'en',
  t: (key) => key,
  translations: getTranslations('en'),
});

export function useI18n() {
  return useContext(I18nContext);
}

export function I18nProvider({
  locale,
  children,
}: {
  locale: LocaleCode;
  children: React.ReactNode;
}) {
  const translations = getTranslations(locale);

  const t = useCallback(
    (key: string, params?: Record<string, string | number>) => {
      return translateFn(locale, key, params);
    },
    [locale]
  );

  return (
    <I18nContext.Provider value={{ locale, t, translations }}>
      {children}
    </I18nContext.Provider>
  );
}

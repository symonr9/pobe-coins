/**
 * i18n with natural-language keys: t('Save') returns "Save" in English, and other
 * languages add `locales/<lng>.json` mapping the English text to a translation.
 * `npm run i18n:extract` collects every key into locales/en.json.
 */
import i18n from 'i18next';
import { initReactI18next, useTranslation } from 'react-i18next';
import { getLocales } from 'expo-localization';

const resources: Record<string, { translation: Record<string, string> }> = {
  en: { translation: {} },
};

void i18n.use(initReactI18next).init({
  resources,
  lng: getLocales()[0]?.languageCode && resources[getLocales()[0]!.languageCode!] ? getLocales()[0]!.languageCode! : 'en',
  fallbackLng: 'en',
  keySeparator: false,
  nsSeparator: false,
  returnNull: false,
  interpolation: { escapeValue: false },
});

export { i18n, useTranslation };
export const t = i18n.t.bind(i18n);

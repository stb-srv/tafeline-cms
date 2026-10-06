/**
 * i18n-Grundgerüst (react-i18next).
 * TODO Phase 2/3: vollständige Sprachdateien aus cms/modules/i18n.js und
 * menu-app/i18n/*.json (14 Sprachen) hierher portieren.
 */
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

export const SUPPORTED_LANGS = [
    'de',
    'en',
    'el',
    'fr',
    'it',
    'es',
    'pt',
    'nl',
    'pl',
    'ru',
    'uk',
    'tr',
    'ar',
    'da',
] as const;

export type Lang = (typeof SUPPORTED_LANGS)[number];

const STORAGE_KEY = 'tafeline_lang';

i18n.use(initReactI18next).init({
    lng: (localStorage.getItem(STORAGE_KEY) as Lang) || 'de',
    fallbackLng: 'de',
    interpolation: { escapeValue: false },
    resources: {
        de: { translation: {} },
        en: { translation: {} },
    },
});

i18n.on('languageChanged', (lng) => localStorage.setItem(STORAGE_KEY, lng));

export default i18n;

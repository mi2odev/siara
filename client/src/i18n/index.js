import i18n from 'i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import { initReactI18next } from 'react-i18next'

import enCommon from './locales/en/common.json'
import enAuth from './locales/en/auth.json'
import enMap from './locales/en/map.json'
import enReports from './locales/en/reports.json'
import enAlerts from './locales/en/alerts.json'
import enSettings from './locales/en/settings.json'

import frCommon from './locales/fr/common.json'
import frAuth from './locales/fr/auth.json'
import frMap from './locales/fr/map.json'
import frReports from './locales/fr/reports.json'
import frAlerts from './locales/fr/alerts.json'
import frSettings from './locales/fr/settings.json'

import arCommon from './locales/ar/common.json'
import arAuth from './locales/ar/auth.json'
import arMap from './locales/ar/map.json'
import arReports from './locales/ar/reports.json'
import arAlerts from './locales/ar/alerts.json'
import arSettings from './locales/ar/settings.json'

export const SUPPORTED_LANGUAGES = ['en', 'fr', 'ar']
export const RTL_LANGUAGES = new Set(['ar'])
export const LANGUAGE_STORAGE_KEY = 'siara_language'
export const DEFAULT_LANGUAGE = 'en'

const NAMESPACES = ['common', 'auth', 'map', 'reports', 'alerts', 'settings']

const resources = {
  en: {
    common: enCommon,
    auth: enAuth,
    map: enMap,
    reports: enReports,
    alerts: enAlerts,
    settings: enSettings,
  },
  fr: {
    common: frCommon,
    auth: frAuth,
    map: frMap,
    reports: frReports,
    alerts: frAlerts,
    settings: frSettings,
  },
  ar: {
    common: arCommon,
    auth: arAuth,
    map: arMap,
    reports: arReports,
    alerts: arAlerts,
    settings: arSettings,
  },
}

export function isRtlLanguage(language) {
  return RTL_LANGUAGES.has(String(language || '').toLowerCase().slice(0, 2))
}

export function normalizeLanguage(value) {
  const code = String(value || '').toLowerCase().slice(0, 2)
  return SUPPORTED_LANGUAGES.includes(code) ? code : DEFAULT_LANGUAGE
}

if (!i18n.isInitialized) {
  i18n
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
      resources,
      fallbackLng: DEFAULT_LANGUAGE,
      supportedLngs: SUPPORTED_LANGUAGES,
      ns: NAMESPACES,
      defaultNS: 'common',
      interpolation: { escapeValue: false },
      detection: {
        order: ['localStorage', 'navigator', 'htmlTag'],
        lookupLocalStorage: LANGUAGE_STORAGE_KEY,
        caches: ['localStorage'],
      },
      load: 'languageOnly',
      returnEmptyString: false,
    })
}

export default i18n

import i18n from 'i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import { initReactI18next } from 'react-i18next'

import enCommon from './locales/en/common.json'
import enAuth from './locales/en/auth.json'
import enMap from './locales/en/map.json'
import enReports from './locales/en/reports.json'
import enAlerts from './locales/en/alerts.json'
import enSettings from './locales/en/settings.json'
import enAdmin from './locales/en/admin.json'
import enPolice from './locales/en/police.json'
import enSupervisor from './locales/en/supervisor.json'
import enEmergency from './locales/en/emergency.json'
import enPages from './locales/en/pages.json'

import frCommon from './locales/fr/common.json'
import frAuth from './locales/fr/auth.json'
import frMap from './locales/fr/map.json'
import frReports from './locales/fr/reports.json'
import frAlerts from './locales/fr/alerts.json'
import frSettings from './locales/fr/settings.json'
import frAdmin from './locales/fr/admin.json'
import frPolice from './locales/fr/police.json'
import frSupervisor from './locales/fr/supervisor.json'
import frEmergency from './locales/fr/emergency.json'
import frPages from './locales/fr/pages.json'

import arCommon from './locales/ar/common.json'
import arAuth from './locales/ar/auth.json'
import arMap from './locales/ar/map.json'
import arReports from './locales/ar/reports.json'
import arAlerts from './locales/ar/alerts.json'
import arSettings from './locales/ar/settings.json'
import arAdmin from './locales/ar/admin.json'
import arPolice from './locales/ar/police.json'
import arSupervisor from './locales/ar/supervisor.json'
import arEmergency from './locales/ar/emergency.json'
import arPages from './locales/ar/pages.json'

export const SUPPORTED_LANGUAGES = ['en', 'fr', 'ar']
export const RTL_LANGUAGES = new Set(['ar'])
export const LANGUAGE_STORAGE_KEY = 'siara_language'
export const DEFAULT_LANGUAGE = 'en'

const NAMESPACES = [
  'common',
  'auth',
  'map',
  'reports',
  'alerts',
  'settings',
  'admin',
  'police',
  'supervisor',
  'emergency',
  'pages',
]

const resources = {
  en: {
    common: enCommon,
    auth: enAuth,
    map: enMap,
    reports: enReports,
    alerts: enAlerts,
    settings: enSettings,
    admin: enAdmin,
    police: enPolice,
    supervisor: enSupervisor,
    emergency: enEmergency,
    pages: enPages,
  },
  fr: {
    common: frCommon,
    auth: frAuth,
    map: frMap,
    reports: frReports,
    alerts: frAlerts,
    settings: frSettings,
    admin: frAdmin,
    police: frPolice,
    supervisor: frSupervisor,
    emergency: frEmergency,
    pages: frPages,
  },
  ar: {
    common: arCommon,
    auth: arAuth,
    map: arMap,
    reports: arReports,
    alerts: arAlerts,
    settings: arSettings,
    admin: arAdmin,
    police: arPolice,
    supervisor: arSupervisor,
    emergency: arEmergency,
    pages: arPages,
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

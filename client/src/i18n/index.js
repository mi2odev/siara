import i18n from 'i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import { initReactI18next } from 'react-i18next'

// English is bundled eagerly: it is the fallback language and an always-present
// synchronous baseline, so the app can never render with an empty i18n store.
// French and Arabic are code-split and fetched on demand (see below), so a user
// never downloads languages they aren't using on first paint.
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
}

// Lazy importers for the non-default languages. Vite turns each into its own
// chunk, so fr/ar translations stay out of the initial bundle.
const lazyLocales = import.meta.glob('./locales/{fr,ar}/*.json')
const loadedLanguages = new Set(['en'])

export function isRtlLanguage(language) {
  return RTL_LANGUAGES.has(String(language || '').toLowerCase().slice(0, 2))
}

export function normalizeLanguage(value) {
  const code = String(value || '').toLowerCase().slice(0, 2)
  return SUPPORTED_LANGUAGES.includes(code) ? code : DEFAULT_LANGUAGE
}

/**
 * Fetch and register every namespace for a non-default language on demand. Safe
 * to call repeatedly; failures are non-fatal because the English fallback still
 * renders. `bindI18nStore: 'added'` (below) makes mounted components re-render
 * once the bundles arrive.
 */
async function loadLanguageResources(language) {
  const lng = normalizeLanguage(language)
  if (loadedLanguages.has(lng)) {
    return
  }
  loadedLanguages.add(lng)
  try {
    await Promise.all(
      NAMESPACES.map(async (ns) => {
        const loader = lazyLocales[`./locales/${lng}/${ns}.json`]
        if (!loader) return
        const mod = await loader()
        i18n.addResourceBundle(lng, ns, mod.default || mod, true, true)
      }),
    )
  } catch {
    // Allow a later retry (e.g. on the next language switch).
    loadedLanguages.delete(lng)
  }
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
      react: { useSuspense: false, bindI18nStore: 'added' },
    })
}

// Load the active language's bundles now, and again whenever it changes.
i18n.on('languageChanged', (lng) => {
  loadLanguageResources(lng)
})

// Resolves once the initially-detected language is ready (instant for English).
// main.jsx awaits this — bounded — so the first paint is in the right language.
export const i18nReady = loadLanguageResources(i18n.language)

export default i18n

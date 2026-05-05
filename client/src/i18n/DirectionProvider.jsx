import React, { useEffect, useMemo, useState } from 'react'
import { CacheProvider } from '@emotion/react'
import createCache from '@emotion/cache'
import { ThemeProvider, createTheme } from '@mui/material/styles'
import CssBaseline from '@mui/material/CssBaseline'
import rtlPlugin from '@mui/stylis-plugin-rtl'
import { prefixer } from 'stylis'
import i18n, {
  isRtlLanguage,
  normalizeLanguage,
  LANGUAGE_STORAGE_KEY,
} from './index'

const ltrCache = createCache({ key: 'mui', prepend: true })
const rtlCache = createCache({ key: 'mui-rtl', prepend: true, stylisPlugins: [prefixer, rtlPlugin] })

function applyDocumentDirection(language) {
  if (typeof document === 'undefined') return
  const lang = normalizeLanguage(language)
  const dir = isRtlLanguage(lang) ? 'rtl' : 'ltr'
  document.documentElement.setAttribute('lang', lang)
  document.documentElement.setAttribute('dir', dir)
  document.body?.setAttribute('dir', dir)
}

export function DirectionProvider({ children }) {
  const [language, setLanguage] = useState(() => normalizeLanguage(i18n.language))

  useEffect(() => {
    applyDocumentDirection(language)
  }, [language])

  useEffect(() => {
    const handleChange = (lng) => {
      const next = normalizeLanguage(lng)
      setLanguage(next)
      try {
        if (typeof window !== 'undefined') {
          window.localStorage.setItem(LANGUAGE_STORAGE_KEY, next)
        }
      } catch {
        // localStorage may be unavailable (private mode); the in-memory state is enough.
      }
    }
    i18n.on('languageChanged', handleChange)
    return () => {
      i18n.off('languageChanged', handleChange)
    }
  }, [])

  const direction = isRtlLanguage(language) ? 'rtl' : 'ltr'
  const cache = direction === 'rtl' ? rtlCache : ltrCache

  const theme = useMemo(
    () =>
      createTheme({
        direction,
        typography: {
          fontFamily:
            direction === 'rtl'
              ? "'Noto Naskh Arabic', 'Segoe UI', system-ui, -apple-system, sans-serif"
              : "'Inter', 'Segoe UI', system-ui, -apple-system, sans-serif",
        },
      }),
    [direction],
  )

  return (
    <CacheProvider value={cache}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </CacheProvider>
  )
}

export default DirectionProvider

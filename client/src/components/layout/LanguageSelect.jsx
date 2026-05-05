import React, { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'

import i18n, {
  SUPPORTED_LANGUAGES,
  LANGUAGE_STORAGE_KEY,
  normalizeLanguage,
} from '../../i18n'
import { updateLanguagePreference } from '../../services/preferencesService'
import { useAuthStore } from '../../stores/authStore'

const NATIVE_LABELS = {
  en: 'English',
  fr: 'Français',
  ar: 'العربية',
}

const FLOATING_STYLE = {
  position: 'fixed',
  top: 12,
  insetInlineEnd: 12,
  zIndex: 1000,
  background: 'rgba(0, 0, 0, 0.35)',
  color: '#fff',
  border: '1px solid rgba(255, 255, 255, 0.25)',
  borderRadius: 6,
  padding: '4px 8px',
  fontSize: 13,
  cursor: 'pointer',
  backdropFilter: 'blur(4px)',
}

export default function LanguageSelect({
  className = '',
  size = 'default',
  ariaLabel,
  onChange,
  style,
  floating = false,
}) {
  const { i18n: instance, t } = useTranslation('common')
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  const [pending, setPending] = useState(false)

  const current = normalizeLanguage(instance?.language || i18n.language)

  const handleChange = useCallback(
    async (event) => {
      const next = normalizeLanguage(event.target.value)
      if (next === current) return

      try {
        setPending(true)
        try {
          if (typeof window !== 'undefined') {
            window.localStorage.setItem(LANGUAGE_STORAGE_KEY, next)
          }
        } catch {
          // ignore localStorage failure
        }
        await i18n.changeLanguage(next)
        if (typeof onChange === 'function') onChange(next)
        if (isAuthenticated) {
          updateLanguagePreference(next).catch((error) => {
            // The local switch already happened; surfacing the API failure is
            // not critical for this UI.
            console.warn('[LanguageSelect] preference sync failed:', error?.message || error)
          })
        }
      } finally {
        setPending(false)
      }
    },
    [current, isAuthenticated, onChange],
  )

  const classes = ['siara-lang-select', `siara-lang-select--${size}`, className]
    .filter(Boolean)
    .join(' ')

  const resolvedStyle = floating ? { ...FLOATING_STYLE, ...(style || {}) } : style

  return (
    <select
      className={classes}
      value={current}
      onChange={handleChange}
      disabled={pending}
      aria-label={ariaLabel || t('language.select')}
      style={resolvedStyle}
    >
      {SUPPORTED_LANGUAGES.map((code) => (
        <option key={code} value={code}>
          {NATIVE_LABELS[code] || code}
        </option>
      ))}
    </select>
  )
}

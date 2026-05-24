import React, { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'

import FancySelect from '../ui/FancySelect'
import i18n, {
  SUPPORTED_LANGUAGES,
  LANGUAGE_STORAGE_KEY,
  normalizeLanguage,
} from '../../i18n'
import { updateLanguagePreference } from '../../services/preferencesService'
import { useAuthStore } from '../../stores/authStore'
import './LanguageSelect.css'

const NATIVE_LABELS = {
  en: 'English',
  fr: 'Français',
  ar: 'العربية',
}

const FLOATING_WRAPPER_STYLE = {
  position: 'fixed',
  top: 12,
  insetInlineEnd: 12,
  zIndex: 1000,
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
    async (value) => {
      const next = normalizeLanguage(value)
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

  // The floating variant is overlaid on top of a hero image / map. A dedicated
  // `.siara-lang-floating` wrapper darkens the FancySelect chip so it stays
  // legible against bright photo backgrounds.
  const wrapperStyle = floating ? { ...FLOATING_WRAPPER_STYLE, ...(style || {}) } : style
  const wrapperClass = [
    'siara-lang-wrapper',
    floating ? 'siara-lang-floating' : '',
    size === 'compact' ? 'siara-lang-compact' : '',
    className,
  ].filter(Boolean).join(' ')

  const options = SUPPORTED_LANGUAGES.map((code) => ({
    value: code,
    label: NATIVE_LABELS[code] || code,
  }))

  return (
    <span className={wrapperClass} style={wrapperStyle}>
      <FancySelect
        value={current}
        onChange={handleChange}
        options={options}
        disabled={pending}
        menuAlign={floating ? 'right' : 'left'}
        size="sm"
      />
      {/* Screen-reader-only context label — FancySelect's button already
          has aria-label via the option text, but i18n pages prefer a
          translated "Language" label here. */}
      <span className="siara-lang-sr-only">{ariaLabel || t('language.select')}</span>
    </span>
  )
}

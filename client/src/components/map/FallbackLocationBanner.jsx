import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import WarningAmberOutlinedIcon from '@mui/icons-material/WarningAmberOutlined'
import RefreshOutlinedIcon from '@mui/icons-material/RefreshOutlined'
import HelpOutlineOutlinedIcon from '@mui/icons-material/HelpOutlineOutlined'

const BANNER_BASE_STYLE = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  padding: '8px 12px',
  background: '#fff8e1',
  color: '#7a4f00',
  border: '1px solid #f5c97a',
  borderRadius: 8,
  boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
  fontSize: 13,
  fontWeight: 500,
  maxWidth: 420,
}

const BUTTON_STYLE = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  border: '1px solid #c98f1f',
  background: '#fff3cd',
  color: '#7a4f00',
  padding: '4px 10px',
  borderRadius: 6,
  fontSize: 12,
  fontWeight: 600,
  cursor: 'pointer',
}

/**
 * Small banner shown whenever the live-location hook is serving a fallback
 * test fix instead of a real GPS fix. Renders the retry button when the
 * hook exposes `retryLocation`.
 */
const HELP_LIST_STYLE = {
  margin: '8px 0 0',
  padding: 0,
  listStyle: 'none',
  display: 'grid',
  gap: 6,
  fontSize: 11.5,
  fontWeight: 400,
  lineHeight: 1.4,
}

export default function FallbackLocationBanner({
  isFallback,
  isLoading = false,
  errorMessage = '',
  label,
  onRetry,
  style,
  compact = false,
  // Show the collapsible "how to enable location" troubleshooting block.
  // Defaults on — it's the first thing a user with a blocked GPS needs.
  showHelp = true,
}) {
  const { t } = useTranslation(['map', 'common'])
  const [helpOpen, setHelpOpen] = useState(false)
  if (!isFallback) return null

  const resolvedLabel = label !== undefined ? label : t('fallbackLocationBanner.defaultLabel')

  const composedStyle = compact
    ? { ...BANNER_BASE_STYLE, padding: '6px 10px', fontSize: 12, ...style }
    : { ...BANNER_BASE_STYLE, ...style }

  return (
    <div role="status" aria-live="polite" style={{ ...composedStyle, flexWrap: 'wrap' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%' }}>
        <WarningAmberOutlinedIcon fontSize="inherit" aria-hidden="true" />
        <div style={{ flex: 1, lineHeight: 1.25 }}>
          <div>{resolvedLabel}</div>
          {errorMessage ? (
            <div style={{ fontSize: 11, opacity: 0.8, marginTop: 2 }}>{errorMessage}</div>
          ) : null}
        </div>
        {showHelp ? (
          <button
            type="button"
            onClick={() => setHelpOpen((open) => !open)}
            style={{ ...BUTTON_STYLE, background: 'transparent' }}
            aria-expanded={helpOpen}
          >
            <HelpOutlineOutlinedIcon fontSize="inherit" aria-hidden="true" />
            {helpOpen ? t('fallbackLocationBanner.helpHide') : t('fallbackLocationBanner.helpToggle')}
          </button>
        ) : null}
        {typeof onRetry === 'function' ? (
          <button
            type="button"
            onClick={onRetry}
            disabled={isLoading}
            style={{ ...BUTTON_STYLE, opacity: isLoading ? 0.7 : 1 }}
          >
            <RefreshOutlinedIcon fontSize="inherit" aria-hidden="true" />
            {isLoading ? t('fallbackLocationBanner.retrying') : t('fallbackLocationBanner.retryGps')}
          </button>
        ) : null}
      </div>
      {showHelp && helpOpen ? (
        <div style={{ width: '100%' }}>
          <strong style={{ fontSize: 12, display: 'block', marginTop: 8 }}>
            {t('fallbackLocationBanner.helpTitle')}
          </strong>
          <ul style={HELP_LIST_STYLE}>
            <li>1. {t('fallbackLocationBanner.helpWindows')}</li>
            <li>2. {t('fallbackLocationBanner.helpChrome')}</li>
            <li>3. {t('fallbackLocationBanner.helpDesktop')}</li>
            <li>4. {t('fallbackLocationBanner.helpVpn')}</li>
          </ul>
        </div>
      ) : null}
    </div>
  )
}

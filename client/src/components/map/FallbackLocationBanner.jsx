import React from 'react'
import WarningAmberOutlinedIcon from '@mui/icons-material/WarningAmberOutlined'
import RefreshOutlinedIcon from '@mui/icons-material/RefreshOutlined'

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
export default function FallbackLocationBanner({
  isFallback,
  isLoading = false,
  errorMessage = '',
  label = 'Using fallback test location because GPS is unavailable.',
  onRetry,
  style,
  compact = false,
}) {
  if (!isFallback) return null

  const composedStyle = compact
    ? { ...BANNER_BASE_STYLE, padding: '6px 10px', fontSize: 12, ...style }
    : { ...BANNER_BASE_STYLE, ...style }

  return (
    <div role="status" aria-live="polite" style={composedStyle}>
      <WarningAmberOutlinedIcon fontSize="inherit" aria-hidden="true" />
      <div style={{ flex: 1, lineHeight: 1.25 }}>
        <div>{label}</div>
        {errorMessage ? (
          <div style={{ fontSize: 11, opacity: 0.8, marginTop: 2 }}>{errorMessage}</div>
        ) : null}
      </div>
      {typeof onRetry === 'function' ? (
        <button
          type="button"
          onClick={onRetry}
          disabled={isLoading}
          style={{ ...BUTTON_STYLE, opacity: isLoading ? 0.7 : 1 }}
        >
          <RefreshOutlinedIcon fontSize="inherit" aria-hidden="true" />
          {isLoading ? 'Retrying…' : 'Retry GPS'}
        </button>
      ) : null}
    </div>
  )
}

import React, { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { acknowledgeMyWarning } from '../../services/adminUsersService'
import { useAuthStore } from '../../stores/authStore'

/**
 * Yellow banner shown when an admin has issued a warning to the current user.
 * Unlike BanBanner, the user can dismiss this — the dismiss call moves them
 * back to 'active' on the backend AND removes the banner from the UI.
 */
function formatRemaining(ms, t) {
  if (ms <= 0) return t('warningBanner.justNow')
  const totalSec = Math.floor(ms / 1000)
  const d = Math.floor(totalSec / 86400)
  const h = Math.floor((totalSec % 86400) / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  if (d > 0) return `${d}d ${h}h`
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m`
  return `${totalSec}s`
}

export default function WarningBanner({ user }) {
  const moderation = String(user?.moderationStatus || user?.moderation_status || '').toLowerCase()
  const acknowledgedAt = user?.warningAcknowledgedAt || user?.warning_acknowledged_at || null
  const reason = user?.warningReason || user?.warning_reason || null
  const warnedAt = user?.warnedAt || user?.warned_at || null
  const expiresAt = user?.warningExpiresAt || user?.warning_expires_at || null
  const hasActive = (user?.hasActiveWarning || user?.has_active_warning) ??
    (moderation === 'warned' && !acknowledgedAt)

  const { t } = useTranslation(['pages', 'common'])
  const setUser = useAuthStore((state) => state.setUser)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const bannerRef = useRef(null)

  // Push the rest of the page down by the banner's actual height so the
  // app's fixed top nav and content remain visible below.
  useEffect(() => {
    if (!hasActive) return undefined
    const el = bannerRef.current
    if (!el) return undefined
    const apply = () => {
      const height = Math.ceil(el.getBoundingClientRect().height)
      document.documentElement.style.setProperty('--moderation-banner-offset', `${height}px`)
      document.body.style.paddingTop = `${height}px`
    }
    apply()
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(apply) : null
    if (ro) ro.observe(el)
    window.addEventListener('resize', apply)
    return () => {
      if (ro) ro.disconnect()
      window.removeEventListener('resize', apply)
      document.documentElement.style.removeProperty('--moderation-banner-offset')
      document.body.style.paddingTop = ''
    }
  }, [hasActive, reason, expiresAt])

  if (!hasActive) return null

  const expiresMs = expiresAt ? new Date(expiresAt).getTime() - Date.now() : null

  const handleAcknowledge = async () => {
    if (submitting) return
    setSubmitting(true)
    setError('')
    try {
      const refreshed = await acknowledgeMyWarning()
      if (refreshed) setUser(refreshed)
    } catch (err) {
      setError(err?.message || t('warningBanner.acknowledgeError'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      ref={bannerRef}
      role="alert"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 10000,
        background: 'linear-gradient(90deg, rgba(245, 158, 11, 0.96), rgba(217, 119, 6, 0.96))',
        color: '#fff',
        padding: '10px 16px',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.18)',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        flexWrap: 'wrap',
        fontSize: 13,
        fontWeight: 500,
      }}
    >
      <span
        aria-hidden="true"
        style={{
          width: 26,
          height: 26,
          borderRadius: '50%',
          background: 'rgba(255, 255, 255, 0.22)',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontWeight: 800,
          flexShrink: 0,
        }}
      >
        ⚠
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <strong style={{ marginRight: 6 }}>{t('warningBanner.title')}</strong>
        <span style={{ opacity: 0.95 }}>
          {t('warningBanner.body')}
        </span>
        {reason && (
          <div style={{ marginTop: 2, fontSize: 12, opacity: 0.95 }}>
            <strong>{t('warningBanner.reasonLabel')}</strong> {reason}
          </div>
        )}
        <div style={{ marginTop: 2, fontSize: 11.5, opacity: 0.9, fontVariantNumeric: 'tabular-nums' }}>
          {warnedAt && (
            <>{t('warningBanner.issued', { date: new Date(warnedAt).toLocaleString() })}</>
          )}
          {expiresMs != null && expiresMs > 0 && (
            <> · {t('warningBanner.autoClearsIn', { time: formatRemaining(expiresMs, t) })}</>
          )}
        </div>
        {error && (
          <div style={{ marginTop: 4, fontSize: 11.5, color: '#fff5e6' }}>
            {error}
          </div>
        )}
      </div>
      <button
        type="button"
        onClick={handleAcknowledge}
        disabled={submitting}
        style={{
          flexShrink: 0,
          padding: '7px 14px',
          borderRadius: 999,
          border: '1px solid rgba(255, 255, 255, 0.4)',
          background: 'rgba(255, 255, 255, 0.18)',
          color: '#fff',
          fontSize: 12,
          fontWeight: 700,
          cursor: submitting ? 'not-allowed' : 'pointer',
          letterSpacing: 0.02,
          transition: 'background 120ms ease',
        }}
        onMouseEnter={(e) => { if (!submitting) e.currentTarget.style.background = 'rgba(255, 255, 255, 0.28)' }}
        onMouseLeave={(e) => { if (!submitting) e.currentTarget.style.background = 'rgba(255, 255, 255, 0.18)' }}
      >
        {submitting ? t('common:actions.loading') : t('warningBanner.iUnderstand')}
      </button>
    </div>
  )
}

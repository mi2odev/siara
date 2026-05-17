import React, { useEffect, useRef, useState } from 'react'

/**
 * Top-of-page banner shown whenever the current user is moderation-banned.
 *
 * Permanent bans block login at the backend, so this banner only fires for
 * temporary bans (user can still authenticate but every write endpoint will
 * return 403). The banner shows the reason and a live countdown to expiry.
 */
function formatRemaining(ms) {
  if (ms <= 0) return 'just now'
  const totalSec = Math.floor(ms / 1000)
  const d = Math.floor(totalSec / 86400)
  const h = Math.floor((totalSec % 86400) / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  if (d > 0) return `${d}d ${h}h`
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m`
  return `${totalSec}s`
}

export default function BanBanner({ user }) {
  const moderation = String(user?.moderationStatus || user?.moderation_status || '').toLowerCase()
  const bannedUntil = user?.bannedUntil || user?.banned_until || null
  const reason = user?.banReason || user?.ban_reason || null
  const permanent = user?.isPermanentlyBanned || user?.is_permanently_banned || (moderation === 'banned' && !bannedUntil)
  const isBanned = moderation === 'banned'

  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!isBanned || permanent) return undefined
    const id = setInterval(() => setNow(Date.now()), 30 * 1000)
    return () => clearInterval(id)
  }, [isBanned, permanent])

  const bannerRef = useRef(null)
  useEffect(() => {
    if (!isBanned) return undefined
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
  }, [isBanned, reason, bannedUntil, permanent])

  if (!isBanned) return null

  const expiresAt = bannedUntil ? new Date(bannedUntil) : null
  const remainingMs = expiresAt ? expiresAt.getTime() - now : null

  return (
    <div
      ref={bannerRef}
      role="alert"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 10001,
        background: 'linear-gradient(90deg, rgba(239, 68, 68, 0.96), rgba(220, 38, 38, 0.96))',
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
          background: 'rgba(255, 255, 255, 0.18)',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontWeight: 800,
          flexShrink: 0,
        }}
      >
        !
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <strong style={{ marginRight: 6 }}>
          {permanent ? 'Your account is permanently banned.' : 'Your account is temporarily banned.'}
        </strong>
        <span style={{ opacity: 0.92 }}>
          You cannot post reports, comments or reactions
          {permanent ? ' and your access will be revoked on next sign-in.' : '.'}
        </span>
        {reason && (
          <div style={{ marginTop: 2, fontSize: 12, opacity: 0.95 }}>
            <strong>Reason:</strong> {reason}
          </div>
        )}
        {!permanent && expiresAt && (
          <div style={{ marginTop: 2, fontSize: 12, opacity: 0.95, fontVariantNumeric: 'tabular-nums' }}>
            Ban ends in <strong>{formatRemaining(remainingMs)}</strong>
            {' · '}
            <span style={{ opacity: 0.85 }}>{expiresAt.toLocaleString()}</span>
          </div>
        )}
      </div>
    </div>
  )
}

import React, { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'

/**
 * Fixed top banner shown while signed in as the read-only demo admin.
 * Explains that browsing is allowed but real-data changes are disabled (the
 * backend enforces this in verifytoken), and points testers to the contact
 * email for changes on real data.
 */
export default function DemoReadOnlyBanner({ user }) {
  const { t } = useTranslation(['common'])
  const isReadOnly = Boolean(user?.readOnly)
  const contact = user?.demoContact || 'mouhamedbachir2323@gmail.com'

  const bannerRef = useRef(null)
  useEffect(() => {
    if (!isReadOnly) return undefined
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
  }, [isReadOnly])

  if (!isReadOnly) return null

  return (
    <div
      ref={bannerRef}
      role="status"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 10001,
        background: 'linear-gradient(90deg, rgba(79, 70, 229, 0.97), rgba(67, 56, 202, 0.97))',
        color: '#fff',
        padding: '9px 16px',
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
          padding: '2px 9px',
          borderRadius: 999,
          background: 'rgba(255, 255, 255, 0.18)',
          fontWeight: 700,
          fontSize: 12,
          whiteSpace: 'nowrap',
          flexShrink: 0,
        }}
      >
        {t('demoBanner.badge')}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <span style={{ opacity: 0.95 }}>{t('demoBanner.message')}</span>
        <span style={{ marginLeft: 6, opacity: 0.9 }}>
          {t('demoBanner.contact')} <strong>{contact}</strong>
        </span>
      </div>
    </div>
  )
}

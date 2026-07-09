import React, { Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import AdminSidebar from './AdminSidebar'
import AdminHeader from './AdminHeader'
import RouteErrorBoundary from '../common/RouteErrorBoundary'
import PageLoader from '../common/PageLoader'
import '../../styles/AdminPanel.css'

/**
 * Selector for focusable elements — used by the drawer focus trap so Tab
 * cycles inside the open sidebar instead of escaping to the obscured page.
 */
const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

export default function AdminLayout() {
  const { t } = useTranslation(['admin', 'common'])
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const location = useLocation()
  const lastTriggerRef = useRef(null)

  // ── Close on route change ───────────────────────────────────────────────
  useEffect(() => { setMobileNavOpen(false) }, [location.pathname, location.search])

  // ── Body scroll lock while the drawer is open ───────────────────────────
  useEffect(() => {
    if (typeof document === 'undefined') return undefined
    const previous = document.body.style.overflow
    if (mobileNavOpen) document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = previous }
  }, [mobileNavOpen])

  // ── Auto-close when viewport grows past the drawer breakpoint ──────────
  useEffect(() => {
    if (typeof window === 'undefined') return undefined
    const mql = window.matchMedia('(min-width: 1025px)')
    const handler = (event) => { if (event.matches) setMobileNavOpen(false) }
    mql.addEventListener?.('change', handler)
    return () => mql.removeEventListener?.('change', handler)
  }, [])

  // ── Focus trap + restore — the drawer is a modal surface on mobile, so
  //    keyboard focus should stay inside it until it closes; when it does,
  //    focus returns to whatever opened it (typically the hamburger). ─────
  useEffect(() => {
    if (typeof document === 'undefined') return undefined
    if (mobileNavOpen) {
      lastTriggerRef.current = document.activeElement
      const sidebar = document.getElementById('admin-sidebar')
      const first = sidebar?.querySelector(FOCUSABLE_SELECTOR)
      // Slight async so the slide-in transition doesn't fight the focus().
      const t = setTimeout(() => first?.focus?.({ preventScroll: true }), 50)
      const onKeyDown = (event) => {
        if (event.key === 'Escape') {
          setMobileNavOpen(false)
          return
        }
        if (event.key !== 'Tab' || !sidebar) return
        const focusables = sidebar.querySelectorAll(FOCUSABLE_SELECTOR)
        if (focusables.length === 0) return
        const firstEl = focusables[0]
        const lastEl = focusables[focusables.length - 1]
        if (event.shiftKey && document.activeElement === firstEl) {
          event.preventDefault()
          lastEl.focus?.()
        } else if (!event.shiftKey && document.activeElement === lastEl) {
          event.preventDefault()
          firstEl.focus?.()
        }
      }
      document.addEventListener('keydown', onKeyDown)
      return () => {
        clearTimeout(t)
        document.removeEventListener('keydown', onKeyDown)
      }
    }
    // Drawer just closed — return focus to whichever button opened it.
    if (lastTriggerRef.current && typeof lastTriggerRef.current.focus === 'function') {
      lastTriggerRef.current.focus({ preventScroll: true })
      lastTriggerRef.current = null
    }
    return undefined
  }, [mobileNavOpen])

  const closeMobileNav = useCallback(() => setMobileNavOpen(false), [])
  const toggleMobileNav = useCallback(() => setMobileNavOpen((v) => !v), [])

  return (
    <div className={`admin-root${mobileNavOpen ? ' is-mobile-nav-open' : ''}`}>
      <AdminSidebar mobileOpen={mobileNavOpen} />
      {mobileNavOpen ? (
        <div
          className="admin-mobile-backdrop"
          role="button"
          tabIndex={0}
          aria-label={t('adminLayout.closeNavigation')}
          onClick={closeMobileNav}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault()
              closeMobileNav()
            }
          }}
        />
      ) : null}
      <div className="admin-workspace">
        <AdminHeader
          mobileNavOpen={mobileNavOpen}
          onToggleMobileNav={toggleMobileNav}
        />
        <main className="admin-content" role="main" id="admin-main">
          <RouteErrorBoundary resetKey={location.pathname} homePath="/admin">
            <Suspense fallback={<PageLoader />}>
              <Outlet />
            </Suspense>
          </RouteErrorBoundary>
        </main>
      </div>
    </div>
  )
}

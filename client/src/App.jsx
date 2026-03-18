import React, { useEffect } from 'react'
import { BrowserRouter } from 'react-router-dom'

import { NotificationProvider } from './contexts/NotificationContext'
import AppRouter from './routes/AppRouter'
import { registerPushServiceWorker } from './services/pushService'
import './App.css'

export default function App() {
  useEffect(() => {
    registerPushServiceWorker().catch((error) => {
      console.warn('[push] service_worker_registration_failed', error)
    })
  }, [])

  useEffect(() => {
    const MOBILE_BREAKPOINT = 1024

    const syncButtonState = (headerInner) => {
      const toggleButton = headerInner.querySelector('.dash-hamburger-btn')
      if (!toggleButton) {
        return
      }

      const isOpen = headerInner.classList.contains('dash-menu-open')
      toggleButton.setAttribute('aria-expanded', String(isOpen))
    }

    const closeAllMenus = () => {
      document.querySelectorAll('.dash-header-inner.dash-menu-open').forEach((headerInner) => {
        headerInner.classList.remove('dash-menu-open')
        syncButtonState(headerInner)
      })
    }

    const enhanceHeaders = () => {
      document.querySelectorAll('.siara-dashboard-header .dash-header-inner').forEach((headerInner) => {
        const headerLeft = headerInner.querySelector('.dash-header-left')
        const tabs = headerInner.querySelector('.dash-header-tabs')

        if (!headerLeft || !tabs || headerInner.querySelector('.dash-hamburger-btn')) {
          return
        }

        const toggleButton = document.createElement('button')
        toggleButton.type = 'button'
        toggleButton.className = 'dash-hamburger-btn'
        toggleButton.setAttribute('aria-label', 'Toggle navigation menu')
        toggleButton.setAttribute('aria-expanded', 'false')
        toggleButton.innerHTML = '<span></span><span></span><span></span>'

        const logoBlock = headerLeft.querySelector('.dash-logo-block')
        if (logoBlock && logoBlock.nextSibling) {
          headerLeft.insertBefore(toggleButton, logoBlock.nextSibling)
        } else {
          headerLeft.appendChild(toggleButton)
        }
      })
    }

    const handleDocumentClick = (event) => {
      const toggleButton = event.target.closest('.dash-hamburger-btn')
      if (toggleButton) {
        const headerInner = toggleButton.closest('.dash-header-inner')
        if (!headerInner) {
          return
        }

        const isOpen = headerInner.classList.toggle('dash-menu-open')
        toggleButton.setAttribute('aria-expanded', String(isOpen))
        return
      }

      const clickedTabButton = event.target.closest('.dash-header-tabs .dash-tab')
      if (clickedTabButton && window.innerWidth <= MOBILE_BREAKPOINT) {
        const headerInner = clickedTabButton.closest('.dash-header-inner')
        if (headerInner) {
          headerInner.classList.remove('dash-menu-open')
          syncButtonState(headerInner)
        }
        return
      }

      const insideHeader = event.target.closest('.dash-header-inner')
      if (!insideHeader) {
        closeAllMenus()
      }
    }

    const handleResize = () => {
      if (window.innerWidth > MOBILE_BREAKPOINT) {
        closeAllMenus()
      }
    }

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        closeAllMenus()
      }
    }

    const observer = new MutationObserver(() => {
      enhanceHeaders()
    })

    enhanceHeaders()
    observer.observe(document.body, { childList: true, subtree: true })
    document.addEventListener('click', handleDocumentClick)
    document.addEventListener('keydown', handleKeyDown)
    window.addEventListener('resize', handleResize)

    return () => {
      observer.disconnect()
      document.removeEventListener('click', handleDocumentClick)
      document.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('resize', handleResize)
    }
  }, [])

  return (
    <BrowserRouter>
      <NotificationProvider>
        <AppRouter />
      </NotificationProvider>
    </BrowserRouter>
  )
}

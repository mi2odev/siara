import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import useOnlineStatus from '../../hooks/useOnlineStatus'
import { getQueueCount, OFFLINE_QUEUE_CHANGED_EVENT } from '../../services/offlineReportQueue'

/**
 * Persistent, unobtrusive status strip shown only when it matters: the user is
 * offline, or there are reports saved on the device still waiting to send. It
 * reassures a driver that a report made on a dead connection is not lost.
 */
export default function OfflineBanner() {
  const { t } = useTranslation(['pages'])
  const online = useOnlineStatus()
  const [count, setCount] = useState(0)

  useEffect(() => {
    let active = true
    const refresh = () =>
      getQueueCount()
        .then((next) => {
          if (active) setCount(next)
        })
        .catch(() => {})

    refresh()
    const onChanged = (event) => {
      if (typeof event?.detail?.count === 'number') {
        setCount(event.detail.count)
      } else {
        refresh()
      }
    }
    window.addEventListener(OFFLINE_QUEUE_CHANGED_EVENT, onChanged)
    return () => {
      active = false
      window.removeEventListener(OFFLINE_QUEUE_CHANGED_EVENT, onChanged)
    }
  }, [])

  if (online && count === 0) {
    return null
  }

  let message
  let syncing = false
  if (!online && count > 0) {
    message = t('offlineBanner.queued', { count })
  } else if (!online) {
    message = t('offlineBanner.offline')
  } else {
    message = t('offlineBanner.syncing')
    syncing = true
  }

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: 'fixed',
        left: '50%',
        bottom: '16px',
        transform: 'translateX(-50%)',
        zIndex: 4000,
        maxWidth: 'calc(100vw - 24px)',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '9px 16px',
        borderRadius: '999px',
        fontSize: '13px',
        fontWeight: 600,
        color: '#fff',
        background: syncing ? '#2563eb' : '#b45309',
        boxShadow: '0 8px 24px rgba(15, 23, 42, 0.25)',
      }}
    >
      <span aria-hidden="true">{syncing ? '🔄' : '📴'}</span>
      <span>{message}</span>
    </div>
  )
}

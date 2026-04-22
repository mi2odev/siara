import React from 'react'

import PoliceShell from '../../components/layout/PoliceShell'
import { listPoliceAlerts, markPoliceAlertRead } from '../../services/policeService'

function displayLabel(value) {
  return String(value || '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

function formatAlertWindow(alert) {
  if (!alert?.startsAt && !alert?.endsAt) {
    return 'Immediate'
  }

  const startLabel = alert?.startsAt ? new Date(alert.startsAt).toLocaleString('en-GB') : null
  const endLabel = alert?.endsAt ? new Date(alert.endsAt).toLocaleString('en-GB') : null

  if (alert?.startsAt && alert?.endsAt) {
    return `${startLabel} to ${endLabel}`
  }

  if (alert?.endsAt) {
    return `Until ${endLabel}`
  }

  return `From ${startLabel}`
}

export default function PoliceAlertCenterPage() {
  const [alerts, setAlerts] = React.useState([])
  const [unreadCount, setUnreadCount] = React.useState(0)
  const [selectedAlertId, setSelectedAlertId] = React.useState(null)
  const [isLoading, setIsLoading] = React.useState(true)
  const [isRefreshing, setIsRefreshing] = React.useState(false)
  const [busyAlertId, setBusyAlertId] = React.useState('')
  const [error, setError] = React.useState('')

  const selectedAlert = React.useMemo(
    () => alerts.find((item) => item.id === selectedAlertId) || alerts[0] || null,
    [alerts, selectedAlertId],
  )

  const loadAlerts = React.useCallback(async ({ refresh = false } = {}) => {
    if (refresh) {
      setIsRefreshing(true)
    } else {
      setIsLoading(true)
    }
    setError('')

    try {
      const response = await listPoliceAlerts({ page: 1, pageSize: 30 })
      setAlerts(response.items)
      setUnreadCount(response.unreadCount)
      setSelectedAlertId((previousId) => {
        if (previousId && response.items.some((item) => item.id === previousId)) {
          return previousId
        }
        return response.items[0]?.id || null
      })
    } catch (loadError) {
      setError(loadError.message || 'Failed to load police alerts.')
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }, [])

  React.useEffect(() => {
    loadAlerts()
  }, [loadAlerts])

  const handleOpenAlert = async (alert) => {
    if (!alert) {
      return
    }

    setSelectedAlertId(alert.id)
    setError('')

    if (alert.read) {
      return
    }

    setBusyAlertId(alert.id)
    try {
      const response = await markPoliceAlertRead(alert.id)
      const nextAlert = response.alert || { ...alert, read: true }

      setAlerts((previous) => previous.map((item) => (
        item.id === alert.id
          ? { ...item, ...nextAlert, read: true }
          : item
      )))
      setUnreadCount((previous) => Math.max(0, previous - 1))
      await loadAlerts({ refresh: true })
    } catch (markError) {
      setError(markError.message || 'Failed to mark alert as read.')
    } finally {
      setBusyAlertId('')
    }
  }

  const counters = React.useMemo(() => ({
    total: alerts.length,
    high: alerts.filter((item) => ['high', 'critical'].includes(item.severity)).length,
    unread: unreadCount,
  }), [alerts, unreadCount])

  const rightPanel = (
    <>
      <section className="police-section">
        <h2>Alert Summary</h2>
        <ul className="police-list">
          <li><strong>Visible alerts:</strong> {counters.total}</li>
          <li><strong>High severity:</strong> {counters.high}</li>
          <li><strong>Unread:</strong> {counters.unread}</li>
        </ul>
      </section>

      <section className="police-section">
        <h2>Selected Alert</h2>
        {selectedAlert ? (
          <>
            <p><strong>{selectedAlert.title}</strong></p>
            <ul className="police-list">
              <li><strong>Severity:</strong> {displayLabel(selectedAlert.severity)}</li>
              <li><strong>Status:</strong> {selectedAlert.expired ? 'Expired' : displayLabel(selectedAlert.status)}</li>
              <li><strong>Timing:</strong> {formatAlertWindow(selectedAlert)}</li>
              <li><strong>Read:</strong> {selectedAlert.read ? 'Yes' : 'No'}</li>
            </ul>
          </>
        ) : (
          <p className="police-meta">Select an alert to view details.</p>
        )}
      </section>
    </>
  )

  return (
    <PoliceShell activeKey="alert-center" rightPanel={rightPanel} notificationCount={unreadCount}>
      <section className="police-section police-alert-center-page">
        <div className="police-command-section-head">
          <h2>Alert Center</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <span className="police-alert-important-note">
              {isRefreshing ? 'Refreshing alerts...' : 'Live targeted alerts'}
            </span>
            <button
              type="button"
              className="police-action police-action-secondary"
              onClick={() => loadAlerts({ refresh: true })}
              disabled={isLoading || isRefreshing || Boolean(busyAlertId)}
            >
              {isRefreshing ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>
        </div>

        {error ? (
          <div className="police-empty-state" role="alert" aria-live="assertive">
            <div className="police-empty-icon" aria-hidden="true">!</div>
            <h3>Unable to load alerts</h3>
            <p>{error}</p>
            <button type="button" className="police-action police-action-secondary" onClick={() => loadAlerts({ refresh: true })}>
              Retry
            </button>
          </div>
        ) : null}

        {!error && (isLoading || isRefreshing) ? (
          <p className="police-meta" aria-live="polite">
            {isLoading ? 'Loading alert feed...' : 'Refreshing alert feed...'}
          </p>
        ) : null}

        {!error && selectedAlert ? (
          <section className="police-section" aria-live="polite">
            <div className="police-alert-item-head">
              <h3>{selectedAlert.title}</h3>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <span className={`police-badge ${selectedAlert.severity}`}>{displayLabel(selectedAlert.severity)}</span>
                {selectedAlert.expired ? <span className="police-badge neutral">Expired</span> : null}
              </div>
            </div>

            <p>{selectedAlert.description || 'No description provided.'}</p>

            <div className="police-alert-item-meta">
              <span>Type: <strong>{displayLabel(selectedAlert.alertType)}</strong></span>
              <span>Status: <strong>{selectedAlert.expired ? 'Expired' : displayLabel(selectedAlert.status)}</strong></span>
              <span>Issued: <strong>{selectedAlert.createdAtLabel}</strong></span>
              <span>Window: <strong>{formatAlertWindow(selectedAlert)}</strong></span>
            </div>
          </section>
        ) : null}

        <div className="police-alert-list">
          {alerts.map((alert) => {
            const isRead = Boolean(alert.read)
            const isBusy = busyAlertId === alert.id
            const isSelected = selectedAlert?.id === alert.id
            const severity = String(alert.severity || '').toLowerCase()

            return (
              <article
                key={alert.id}
                className={`police-alert-item ${severity} ${isRead ? 'read' : ''} ${isSelected ? 'active' : ''}`}
              >
                <div className="police-alert-item-main">
                  <div className="police-alert-item-head">
                    <h3>{alert.title}</h3>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                      <span className={`police-badge ${severity}`}>{displayLabel(alert.severity)}</span>
                      {alert.expired ? <span className="police-badge neutral">Expired</span> : null}
                    </div>
                  </div>

                  <p>{alert.description || 'No description provided.'}</p>

                  <div className="police-alert-item-meta">
                    <span>Type: <strong>{displayLabel(alert.alertType)}</strong></span>
                    <span>Status: <strong>{alert.expired ? 'Expired' : displayLabel(alert.status)}</strong></span>
                    <time dateTime={alert.createdAt}>{alert.createdAtLabel}</time>
                  </div>
                </div>

                <div className="police-alert-item-actions">
                  <button
                    type="button"
                    className="police-action police-action-secondary"
                    disabled={isBusy || isRefreshing}
                    onClick={() => handleOpenAlert(alert)}
                  >
                    {isBusy ? 'Opening...' : isRead ? 'Open' : 'Read'}
                  </button>
                </div>
              </article>
            )
          })}

          {!isLoading && !error && alerts.length === 0 ? (
            <div className="police-empty-state" role="status" aria-live="polite">
              <div className="police-empty-icon" aria-hidden="true">✅</div>
              <h3>No important alerts</h3>
              <p>No supervisor-targeted alerts are waiting right now.</p>
            </div>
          ) : null}
        </div>
      </section>
    </PoliceShell>
  )
}

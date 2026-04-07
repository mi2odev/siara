import React, { useMemo, useState } from 'react'

import PoliceShell from '../../components/layout/PoliceShell'
import { getPoliceCriticalAlerts } from '../../data/policeMockData'

function formatTime(value) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Unknown time'

  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

function labelSeverity(value) {
  const normalized = String(value || '').toLowerCase()
  if (normalized === 'high') return 'High'
  if (normalized === 'medium') return 'Medium'
  return 'Low'
}

export default function PoliceAlertCenterPage() {
  const importantAlerts = useMemo(
    () => getPoliceCriticalAlerts()
      .filter((item) => ['high', 'medium', 'low'].includes(String(item.severity || '').toLowerCase()))
      .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
      .slice(0, 8),
    [],
  )

  const [readIds, setReadIds] = useState([])
  const [dismissedIds, setDismissedIds] = useState([])

  const visibleAlerts = useMemo(
    () => importantAlerts.filter((item) => !dismissedIds.includes(item.id)),
    [importantAlerts, dismissedIds],
  )

  const counters = useMemo(() => ({
    total: visibleAlerts.length,
    high: visibleAlerts.filter((item) => String(item.severity).toLowerCase() === 'high').length,
    unread: visibleAlerts.filter((item) => !readIds.includes(item.id)).length,
  }), [visibleAlerts, readIds])

  const rightPanel = (
    <section className="police-section">
      <h2>Alert Summary</h2>
      <ul className="police-list">
        <li><strong>Visible alerts:</strong> {counters.total}</li>
        <li><strong>High severity:</strong> {counters.high}</li>
        <li><strong>Unread:</strong> {counters.unread}</li>
      </ul>
    </section>
  )

  return (
    <PoliceShell activeKey="alert-center" rightPanel={rightPanel} notificationCount={counters.unread}>
      <section className="police-section police-alert-center-page">
        <div className="police-command-section-head">
          <h2>Alert Center</h2>
          <span className="police-alert-important-note">Important alerts only</span>
        </div>

        <div className="police-alert-list">
          {visibleAlerts.map((alert) => {
            const severity = String(alert.severity || '').toLowerCase()
            const isRead = readIds.includes(alert.id)

            return (
              <article key={alert.id} className={`police-alert-item ${severity} ${isRead ? 'read' : ''}`}>
                <div className="police-alert-item-main">
                  <div className="police-alert-item-head">
                    <h3>{alert.title}</h3>
                    <span className={`police-badge ${severity}`}>{labelSeverity(alert.severity)}</span>
                  </div>

                  <div className="police-alert-item-meta">
                    <span>Area: <strong>{alert.area}</strong></span>
                    <time dateTime={alert.createdAt}>{formatTime(alert.createdAt)}</time>
                  </div>
                </div>

                <div className="police-alert-item-actions">
                  <button
                    type="button"
                    className="police-action police-action-secondary"
                    onClick={() => setReadIds((prev) => (prev.includes(alert.id) ? prev : [...prev, alert.id]))}
                  >
                    {isRead ? 'Read' : 'Mark as read'}
                  </button>
                  <button
                    type="button"
                    className="police-action police-action-reject"
                    onClick={() => setDismissedIds((prev) => (prev.includes(alert.id) ? prev : [...prev, alert.id]))}
                  >
                    Dismiss
                  </button>
                </div>
              </article>
            )
          })}

          {visibleAlerts.length === 0 ? (
            <div className="police-empty-state" role="status" aria-live="polite">
              <div className="police-empty-icon" aria-hidden="true">✅</div>
              <h3>No important alerts</h3>
              <p>All critical alerts have been handled.</p>
            </div>
          ) : null}
        </div>
      </section>
    </PoliceShell>
  )
}

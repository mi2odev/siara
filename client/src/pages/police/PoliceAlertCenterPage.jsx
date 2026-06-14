import React from 'react'
import CheckCircleOutlineRoundedIcon from '@mui/icons-material/CheckCircleOutlineRounded'
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded'
import CloudOutlinedIcon from '@mui/icons-material/CloudOutlined'
import CarCrashOutlinedIcon from '@mui/icons-material/CarCrashOutlined'
import TrafficOutlinedIcon from '@mui/icons-material/TrafficOutlined'
import ConstructionOutlinedIcon from '@mui/icons-material/ConstructionOutlined'
import WarningAmberOutlinedIcon from '@mui/icons-material/WarningAmberOutlined'
import CampaignOutlinedIcon from '@mui/icons-material/CampaignOutlined'
import AccessTimeRoundedIcon from '@mui/icons-material/AccessTimeRounded'

import PoliceShell from '../../components/layout/PoliceShell'
import PoliceOfficerPanel from '../../components/police/PoliceOfficerPanel'
import PoliceSortControl from '../../components/police/PoliceSortControl'
import { usePoliceAccess } from '../../components/police/PoliceAccessGate'
import { listPoliceAlerts, markPoliceAlertRead } from '../../services/policeService'
import { usePoliceSort, ALERT_SORT_ACCESSORS, ALERT_SORT_OPTIONS } from '../../utils/policeSort'

function displayLabel(value) {
  return String(value || '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

function renderAlertTypeIcon(type) {
  switch (String(type || '').toLowerCase()) {
    case 'weather':
      return <CloudOutlinedIcon fontSize="inherit" />
    case 'accident':
      return <CarCrashOutlinedIcon fontSize="inherit" />
    case 'traffic':
      return <TrafficOutlinedIcon fontSize="inherit" />
    case 'roadworks':
      return <ConstructionOutlinedIcon fontSize="inherit" />
    case 'danger':
      return <WarningAmberOutlinedIcon fontSize="inherit" />
    default:
      return <CampaignOutlinedIcon fontSize="inherit" />
  }
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
  const { policeMe } = usePoliceAccess()
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

  const { sorted: sortedAlerts, sortKey, setSortKey, sortDir, toggleDir } = usePoliceSort(alerts, ALERT_SORT_ACCESSORS)

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
    high: alerts.filter((item) => item.severity === 'high').length,
    unread: unreadCount,
  }), [alerts, unreadCount])

  const rightPanel = (
    <PoliceOfficerPanel officer={policeMe?.officer} workZone={policeMe?.workZone}>
      <div className="pop-extra">
        <div className="pop-extra-head">
          <span className="pop-extra-title">Alert Summary</span>
        </div>
        <div className="pop-extra-body">
          <div className="pop-stat-row"><span>Total alerts</span><strong>{counters.total}</strong></div>
          <div className="pop-stat-row"><span>High severity</span><strong className={counters.high > 0 ? 'pop-stat--danger' : ''}>{counters.high}</strong></div>
          <div className="pop-stat-row"><span>Unread</span><strong className={counters.unread > 0 ? 'pop-stat--warn' : 'pop-stat--ok'}>{counters.unread}</strong></div>
        </div>
      </div>
    </PoliceOfficerPanel>
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
            {alerts.length > 0 ? (
              <PoliceSortControl
                options={ALERT_SORT_OPTIONS}
                value={sortKey}
                direction={sortDir}
                onChange={setSortKey}
                onToggleDirection={toggleDir}
              />
            ) : null}
            <button
              type="button"
              className="police-action police-action-secondary police-alert-center-refresh"
              onClick={() => loadAlerts({ refresh: true })}
              disabled={isLoading || isRefreshing || Boolean(busyAlertId)}
            >
              <RefreshRoundedIcon fontSize="inherit" className={isLoading || isRefreshing ? 'is-spinning' : ''} />
              <span>Refresh</span>
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

        <div className="police-alert-list">
          {sortedAlerts.map((alert) => {
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
                    <div className="police-alert-item-title">
                      <span className={`police-alert-type-icon police-alert-type-icon--${severity}`} aria-hidden="true">
                        {renderAlertTypeIcon(alert.alertType)}
                      </span>
                      <div className="police-alert-item-titletext">
                        <h3>{alert.title}</h3>
                        <span className="police-alert-type-label">{displayLabel(alert.alertType)}</span>
                      </div>
                    </div>
                    <div className="police-alert-item-badges">
                      {!isRead ? <span className="police-alert-unread-dot" title="Unread" aria-label="Unread" /> : null}
                      <span className={`police-badge ${severity}`}>{displayLabel(alert.severity)}</span>
                      {alert.expired ? <span className="police-badge neutral">Expired</span> : null}
                    </div>
                  </div>

                  <p className="police-alert-desc">{alert.description || 'No description provided.'}</p>

                  <div className="police-alert-item-meta">
                    <span className="police-alert-meta-cell">
                      <span className="police-alert-meta-label">Status</span>
                      <strong>{alert.expired ? 'Expired' : displayLabel(alert.status)}</strong>
                    </span>
                    <span className="police-alert-meta-cell">
                      <span className="police-alert-meta-label">Issued</span>
                      <strong>{alert.createdAtLabel}</strong>
                    </span>
                    <span className="police-alert-meta-cell">
                      <span className="police-alert-meta-label">Active window</span>
                      <strong>{formatAlertWindow(alert)}</strong>
                    </span>
                  </div>
                </div>

                <div className="police-alert-item-actions">
                  <button
                    type="button"
                    className="police-action police-action-secondary"
                    disabled={isBusy || isRefreshing}
                    onClick={() => handleOpenAlert(alert)}
                  >
                    {isBusy ? 'Opening...' : isRead ? 'Open' : 'Mark read'}
                  </button>
                </div>
              </article>
            )
          })}

          {!isLoading && !error && alerts.length === 0 ? (
            <div className="police-empty-state" role="status" aria-live="polite">
              <div className="police-empty-icon" aria-hidden="true"><CheckCircleOutlineRoundedIcon fontSize="inherit" className="icon-success" /></div>
              <h3>No important alerts</h3>
              <p>No supervisor-targeted alerts are waiting right now.</p>
            </div>
          ) : null}
        </div>
      </section>
    </PoliceShell>
  )
}

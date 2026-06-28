import React from 'react'
import { useTranslation } from 'react-i18next'
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

function formatAlertWindow(alert, t) {
  if (!alert?.startsAt && !alert?.endsAt) {
    return t('policeAlertCenterPage.window.immediate')
  }

  const startLabel = alert?.startsAt ? new Date(alert.startsAt).toLocaleString('en-GB') : null
  const endLabel = alert?.endsAt ? new Date(alert.endsAt).toLocaleString('en-GB') : null

  if (alert?.startsAt && alert?.endsAt) {
    return t('policeAlertCenterPage.window.range', { start: startLabel, end: endLabel })
  }

  if (alert?.endsAt) {
    return t('policeAlertCenterPage.window.until', { end: endLabel })
  }

  return t('policeAlertCenterPage.window.from', { start: startLabel })
}

export default function PoliceAlertCenterPage() {
  const { t } = useTranslation(['police', 'common'])
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
      setError(loadError.message || t('policeAlertCenterPage.error.loadFailed'))
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
      setError(markError.message || t('policeAlertCenterPage.error.markReadFailed'))
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
          <span className="pop-extra-title">{t('policeAlertCenterPage.summary.title')}</span>
        </div>
        <div className="pop-extra-body">
          <div className="pop-stat-row"><span>{t('policeAlertCenterPage.summary.total')}</span><strong>{counters.total}</strong></div>
          <div className="pop-stat-row"><span>{t('policeAlertCenterPage.summary.highSeverity')}</span><strong className={counters.high > 0 ? 'pop-stat--danger' : ''}>{counters.high}</strong></div>
          <div className="pop-stat-row"><span>{t('policeAlertCenterPage.summary.unread')}</span><strong className={counters.unread > 0 ? 'pop-stat--warn' : 'pop-stat--ok'}>{counters.unread}</strong></div>
        </div>
      </div>
    </PoliceOfficerPanel>
  )

  return (
    <PoliceShell activeKey="alert-center" rightPanel={rightPanel} notificationCount={unreadCount}>
      <section className="police-section police-alert-center-page">
        <div className="police-command-section-head">
          <h2>{t('policeAlertCenterPage.heading')}</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <span className="police-alert-important-note">
              {isRefreshing ? t('policeAlertCenterPage.status.refreshing') : t('policeAlertCenterPage.status.live')}
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
              <span>{t('policeAlertCenterPage.actions.refresh')}</span>
            </button>
          </div>
        </div>

        {error ? (
          <div className="police-empty-state" role="alert" aria-live="assertive">
            <div className="police-empty-icon" aria-hidden="true">!</div>
            <h3>{t('policeAlertCenterPage.error.unableToLoad')}</h3>
            <p>{error}</p>
            <button type="button" className="police-action police-action-secondary" onClick={() => loadAlerts({ refresh: true })}>
              {t('common:actions.retry')}
            </button>
          </div>
        ) : null}

        {!error && (isLoading || isRefreshing) ? (
          <p className="police-meta" aria-live="polite">
            {isLoading ? t('policeAlertCenterPage.status.loadingFeed') : t('policeAlertCenterPage.status.refreshingFeed')}
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
                      {!isRead ? <span className="police-alert-unread-dot" title={t('policeAlertCenterPage.badge.unread')} aria-label={t('policeAlertCenterPage.badge.unread')} /> : null}
                      <span className={`police-badge ${severity}`}>{displayLabel(alert.severity)}</span>
                      {alert.expired ? <span className="police-badge neutral">{t('policeAlertCenterPage.badge.expired')}</span> : null}
                    </div>
                  </div>

                  <p className="police-alert-desc">{alert.description || t('policeAlertCenterPage.alert.noDescription')}</p>

                  <div className="police-alert-item-meta">
                    <span className="police-alert-meta-cell">
                      <span className="police-alert-meta-label">{t('policeAlertCenterPage.meta.status')}</span>
                      <strong>{alert.expired ? t('policeAlertCenterPage.badge.expired') : displayLabel(alert.status)}</strong>
                    </span>
                    <span className="police-alert-meta-cell">
                      <span className="police-alert-meta-label">{t('policeAlertCenterPage.meta.issued')}</span>
                      <strong>{alert.createdAtLabel}</strong>
                    </span>
                    <span className="police-alert-meta-cell">
                      <span className="police-alert-meta-label">{t('policeAlertCenterPage.meta.activeWindow')}</span>
                      <strong>{formatAlertWindow(alert, t)}</strong>
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
                    {isBusy ? t('policeAlertCenterPage.actions.opening') : isRead ? t('policeAlertCenterPage.actions.open') : t('policeAlertCenterPage.actions.markRead')}
                  </button>
                </div>
              </article>
            )
          })}

          {!isLoading && !error && alerts.length === 0 ? (
            <div className="police-empty-state" role="status" aria-live="polite">
              <div className="police-empty-icon" aria-hidden="true"><CheckCircleOutlineRoundedIcon fontSize="inherit" className="icon-success" /></div>
              <h3>{t('policeAlertCenterPage.empty.heading')}</h3>
              <p>{t('policeAlertCenterPage.empty.body')}</p>
            </div>
          ) : null}
        </div>
      </section>
    </PoliceShell>
  )
}

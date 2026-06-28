import React from 'react'
import { useTranslation } from 'react-i18next'

import PoliceShell from '../../components/layout/PoliceShell'
import PoliceOfficerPanel from '../../components/police/PoliceOfficerPanel'
import { usePoliceAccess } from '../../components/police/PoliceAccessGate'
import { getPoliceDashboard } from '../../services/policeService'

function groupCount(items, keySelector) {
  const counts = new Map()

  items.forEach((item) => {
    const key = keySelector(item)
    if (!key) {
      return
    }

    counts.set(key, (counts.get(key) || 0) + 1)
  })

  return [...counts.entries()].sort((left, right) => right[1] - left[1])
}

export default function PoliceAIInsightsPage() {
  const { t } = useTranslation(['police', 'common'])
  const { policeMe } = usePoliceAccess()
  const [dashboard, setDashboard] = React.useState(null)
  const [isLoading, setIsLoading] = React.useState(true)
  const [error, setError] = React.useState('')

  React.useEffect(() => {
    let isCancelled = false

    async function loadDashboard() {
      setIsLoading(true)
      setError('')

      try {
        const response = await getPoliceDashboard()
        if (!isCancelled) {
          setDashboard(response)
        }
      } catch (loadError) {
        if (!isCancelled) {
          setError(loadError.message || t('policeAIInsightsPage.errorLoadFailed'))
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false)
        }
      }
    }

    loadDashboard()
    return () => {
      isCancelled = true
    }
  }, [])

  const incidents = [
    ...(dashboard?.activeIncidents || []),
    ...(dashboard?.myIncidents || []),
  ]

  const topCommunes = groupCount(incidents, (item) => item.commune?.name)
  const statusBreakdown = groupCount(incidents, (item) => item.status)
  const sourceBreakdown = groupCount(incidents, (item) => item.sourceChannel || 'citizen')
  const topZone = topCommunes[0]?.[0] || 'N/A'
  const highSeverityCount = incidents.filter((item) => item.severity === 'high').length

  const rightPanel = (
    <PoliceOfficerPanel officer={policeMe?.officer} workZone={policeMe?.workZone}>
      <div className="pop-extra">
        <div className="pop-extra-head">
          <span className="pop-extra-title">{t('policeAIInsightsPage.contextSnapshot')}</span>
        </div>
        <div className="pop-extra-body">
          <div className="pop-stat-row"><span>{t('policeAIInsightsPage.topCommune')}</span><strong>{topZone}</strong></div>
          <div className="pop-stat-row"><span>{t('policeAIInsightsPage.highPriority')}</span><strong className={highSeverityCount > 0 ? 'pop-stat--danger' : ''}>{highSeverityCount}</strong></div>
          <div className="pop-stat-row"><span>{t('policeAIInsightsPage.unreadAlerts')}</span><strong className={dashboard?.stats?.unreadAlertsCount > 0 ? 'pop-stat--warn' : ''}>{dashboard?.stats?.unreadAlertsCount || 0}</strong></div>
          <div className="pop-stat-row"><span>{t('policeAIInsightsPage.pendingVerify')}</span><strong className={dashboard?.stats?.pendingVerificationCount > 0 ? 'pop-stat--accent' : ''}>{dashboard?.stats?.pendingVerificationCount || 0}</strong></div>
        </div>
      </div>
    </PoliceOfficerPanel>
  )

  return (
    <PoliceShell
      activeKey="analytics"
      rightPanel={rightPanel}
      notificationCount={dashboard?.stats?.unreadAlertsCount || 0}
      emergencyMode={highSeverityCount >= 3}
    >
      <section className="police-section">
        <div className="police-command-section-head">
          <div>
            <h2>{t('policeAIInsightsPage.title')}</h2>
            <p className="police-shortcuts-hint">{t('policeAIInsightsPage.subtitle')}</p>
          </div>
        </div>

        {error ? <p className="police-meta" style={{ color: '#b91c1c' }}>{error}</p> : null}
        {isLoading ? <p className="police-meta">{t('policeAIInsightsPage.loadingInsights')}</p> : null}

        <div className="police-stats-grid">
          <div className="police-stat"><span>{t('policeAIInsightsPage.statActiveIncidents')}</span><strong>{dashboard?.stats?.activeCount || 0}</strong><em>{t('policeAIInsightsPage.statActiveIncidentsHint')}</em></div>
          <div className="police-stat"><span>{t('policeAIInsightsPage.statHighPriority')}</span><strong>{dashboard?.stats?.highPriorityCount || 0}</strong><em>{t('policeAIInsightsPage.statHighPriorityHint')}</em></div>
          <div className="police-stat"><span>{t('policeAIInsightsPage.statTopZone')}</span><strong>{topZone}</strong><em>{t('policeAIInsightsPage.statTopZoneHint')}</em></div>
          <div className="police-stat"><span>{t('policeAIInsightsPage.statNearbyResults')}</span><strong>{dashboard?.nearbyIncidents?.length || 0}</strong><em>{t('policeAIInsightsPage.statNearbyResultsHint')}</em></div>
        </div>
      </section>

      <section className="police-section">
        <h2>{t('policeAIInsightsPage.statusPressure')}</h2>
        <div className="police-table-wrap">
          <table className="police-table">
            <thead>
              <tr>
                <th>{t('policeAIInsightsPage.colStatus')}</th>
                <th>{t('policeAIInsightsPage.colCount')}</th>
              </tr>
            </thead>
            <tbody>
              {statusBreakdown.map(([status, count]) => (
                <tr key={status}>
                  <td>{status.replace(/_/g, ' ')}</td>
                  <td>{count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="police-section">
        <h2>{t('policeAIInsightsPage.topCommunes')}</h2>
        <div className="police-table-wrap">
          <table className="police-table">
            <thead>
              <tr>
                <th>{t('policeAIInsightsPage.colCommune')}</th>
                <th>{t('policeAIInsightsPage.colIncidents')}</th>
              </tr>
            </thead>
            <tbody>
              {topCommunes.map(([commune, count]) => (
                <tr key={commune}>
                  <td>{commune}</td>
                  <td>{count}</td>
                </tr>
              ))}
              {!isLoading && topCommunes.length === 0 ? (
                <tr>
                  <td colSpan="2">{t('policeAIInsightsPage.noClusteringData')}</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="police-section">
        <h2>{t('policeAIInsightsPage.sourceChannels')}</h2>
        <ul className="police-list">
          {sourceBreakdown.map(([source, count]) => (
            <li key={source}><strong>{source}</strong>: {count}</li>
          ))}
          {!isLoading && sourceBreakdown.length === 0 ? <li>{t('policeAIInsightsPage.noSourceData')}</li> : null}
        </ul>
      </section>
    </PoliceShell>
  )
}

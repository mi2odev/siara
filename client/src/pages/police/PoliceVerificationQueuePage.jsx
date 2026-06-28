import React from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded'

import PoliceShell from '../../components/layout/PoliceShell'
import PoliceOfficerPanel from '../../components/police/PoliceOfficerPanel'
import PoliceSortControl from '../../components/police/PoliceSortControl'
import { usePoliceAccess } from '../../components/police/PoliceAccessGate'
import { usePoliceSort, INCIDENT_SORT_ACCESSORS, INCIDENT_SORT_OPTIONS } from '../../utils/policeSort'
import {
  assignSelfToPoliceIncident,
  listPoliceIncidents,
  rejectPoliceIncident,
  verifyPoliceIncident,
} from '../../services/policeService'

function displayLabel(value) {
  return String(value || '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

export default function PoliceVerificationQueuePage() {
  const { t } = useTranslation(['police', 'common'])
  const navigate = useNavigate()
  const { policeMe } = usePoliceAccess()
  const [queue, setQueue] = React.useState([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [error, setError] = React.useState('')
  const { sorted: sortedQueue, sortKey, setSortKey, sortDir, toggleDir } = usePoliceSort(queue, INCIDENT_SORT_ACCESSORS)

  const highPriorityCount = queue.filter((item) => item.severity === 'high').length
  const assignedCount = queue.filter((item) => item.assignedOfficer?.id).length

  const loadQueue = React.useCallback(async () => {
    setIsLoading(true)
    setError('')

    try {
      const response = await listPoliceIncidents({
        page: 1,
        pageSize: 50,
        status: 'pending',
      })
      setQueue(response.items)
    } catch (loadError) {
      setError(loadError.message || t('policeVerificationQueuePage.errorLoadQueue'))
    } finally {
      setIsLoading(false)
    }
  }, [t])

  React.useEffect(() => {
    loadQueue()
  }, [loadQueue])

  const handleAction = async (incidentId, action) => {
    setError('')

    try {
      if (action === 'verify') {
        await verifyPoliceIncident(incidentId)
      } else if (action === 'reject') {
        await rejectPoliceIncident(incidentId)
      } else if (action === 'assign') {
        await assignSelfToPoliceIncident(incidentId)
      }

      setQueue((previous) => previous.filter((item) => item.id !== incidentId))
    } catch (actionError) {
      setError(actionError.message || t('policeVerificationQueuePage.errorUpdateItem'))
    }
  }

  const rightPanel = (
    <PoliceOfficerPanel officer={policeMe?.officer} workZone={policeMe?.workZone}>
      <div className="pop-extra">
        <div className="pop-extra-head">
          <span className="pop-extra-title">{t('policeVerificationQueuePage.queueMetrics')}</span>
        </div>
        <div className="pop-extra-body">
          <div className="pop-stat-row"><span>{t('policeVerificationQueuePage.awaitingReview')}</span><strong className={queue.length > 0 ? 'pop-stat--accent' : ''}>{queue.length}</strong></div>
          <div className="pop-stat-row"><span>{t('policeVerificationQueuePage.urgentReports')}</span><strong className={highPriorityCount > 0 ? 'pop-stat--danger' : ''}>{highPriorityCount}</strong></div>
          <div className="pop-stat-row"><span>{t('policeVerificationQueuePage.assigned')}</span><strong>{assignedCount}</strong></div>
        </div>
      </div>
    </PoliceOfficerPanel>
  )

  return (
    <PoliceShell
      activeKey="verification-queue"
      rightPanel={rightPanel}
      notificationCount={queue.length}
    >
      <section className="police-section police-verification-page">
        <div className="police-command-section-head police-verification-page-head">
          <div>
            <h2>{t('policeVerificationQueuePage.title')}</h2>
            <p className="police-shortcuts-hint">{t('policeVerificationQueuePage.subtitle')}</p>
          </div>
          <div className="police-page-toolbar-actions">
            {queue.length > 0 ? (
              <PoliceSortControl
                options={INCIDENT_SORT_OPTIONS}
                value={sortKey}
                direction={sortDir}
                onChange={setSortKey}
                onToggleDirection={toggleDir}
              />
            ) : null}
            <button type="button" className="police-action police-action-secondary police-verification-refresh" onClick={loadQueue} disabled={isLoading}>
              <RefreshRoundedIcon fontSize="inherit" className={isLoading ? 'is-spinning' : ''} />
              <span>{t('policeVerificationQueuePage.refresh')}</span>
            </button>
          </div>
        </div>

        {error ? <p className="police-meta police-verification-feedback police-verification-feedback-error">{error}</p> : null}
        {isLoading ? <p className="police-meta police-verification-feedback">{t('policeVerificationQueuePage.loadingQueue')}</p> : null}

        <div className="police-verification-grid">
          {sortedQueue.map((incident) => (
            <article key={incident.id} className="police-verification-card" data-severity={incident.severity}>
              <div className="police-verification-center">
                <strong className="police-title police-verification-title">{incident.displayId} · {incident.title || t('policeVerificationQueuePage.untitledReport')}</strong>
                <p className="police-meta police-verification-description">{incident.description || t('policeVerificationQueuePage.noDescription')}</p>
                <div className="police-verification-facts">
                  <span className="police-meta police-verification-fact">{t('policeVerificationQueuePage.location')}: {incident.locationText || t('policeVerificationQueuePage.notProvided')}</span>
                  <span className="police-meta police-verification-fact">{t('policeVerificationQueuePage.reported')}: {incident.timeAgo || t('policeVerificationQueuePage.unknownTime')}</span>
                  {incident.reportedBy?.name ? <span className="police-meta police-verification-fact">{t('policeVerificationQueuePage.reporter')}: {incident.reportedBy.name}</span> : null}
                </div>
              </div>

              <div className="police-verification-right">
                <div className="police-verification-status-line">
                  <span className={`police-badge ${incident.severity}`}>{displayLabel(incident.severity)}</span>
                  <span className="police-meta">{displayLabel(incident.status)}</span>
                </div>
                <div className="police-verification-actions">
                  <div className="pvq-primary-row">
                    <button className="police-action police-verification-btn police-verification-btn-verify" onClick={() => handleAction(incident.id, 'verify')}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      {t('policeVerificationQueuePage.approve')}
                    </button>
                    <button className="police-action police-verification-btn police-verification-btn-reject" onClick={() => handleAction(incident.id, 'reject')}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/></svg>
                      {t('policeVerificationQueuePage.decline')}
                    </button>
                  </div>
                  <div className="pvq-secondary-row">
                    <button className="police-action police-verification-btn police-verification-btn-assign" onClick={() => handleAction(incident.id, 'assign')}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="2"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
                      {t('policeVerificationQueuePage.takeCase')}
                    </button>
                    <button className="police-action police-verification-btn police-verification-btn-open" onClick={() => navigate(`/police/incident/${incident.id}`)}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M2.4 12C4.3 8.6 7.8 6.5 12 6.5s7.7 2.1 9.6 5.5c-1.9 3.4-5.4 5.5-9.6 5.5S4.3 15.4 2.4 12Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/><circle cx="12" cy="12" r="2.5" fill="currentColor"/></svg>
                      {t('policeVerificationQueuePage.details')}
                    </button>
                  </div>
                </div>
              </div>
            </article>
          ))}

          {!isLoading && queue.length === 0 ? <p className="police-meta">{t('policeVerificationQueuePage.emptyQueue')}</p> : null}
        </div>
      </section>
    </PoliceShell>
  )
}

import React from 'react'
import { useNavigate } from 'react-router-dom'

import PoliceShell from '../../components/layout/PoliceShell'
import PoliceOfficerPanel from '../../components/police/PoliceOfficerPanel'
import { usePoliceAccess } from '../../components/police/PoliceAccessGate'
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
  const navigate = useNavigate()
  const { policeMe } = usePoliceAccess()
  const [queue, setQueue] = React.useState([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [error, setError] = React.useState('')

  const highPriorityCount = queue.filter((item) => ['high', 'critical'].includes(item.severity)).length
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
      setError(loadError.message || 'Failed to load verification queue.')
    } finally {
      setIsLoading(false)
    }
  }, [])

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
      setError(actionError.message || 'Failed to update queue item.')
    }
  }

  const rightPanel = (
    <PoliceOfficerPanel officer={policeMe?.officer} workZone={policeMe?.workZone}>
      <div className="pop-extra">
        <div className="pop-extra-head">
          <span className="pop-extra-title">Queue Metrics</span>
        </div>
        <div className="pop-extra-body">
          <div className="pop-stat-row"><span>Awaiting review</span><strong className={queue.length > 0 ? 'pop-stat--accent' : ''}>{queue.length}</strong></div>
          <div className="pop-stat-row"><span>Urgent reports</span><strong className={highPriorityCount > 0 ? 'pop-stat--danger' : ''}>{highPriorityCount}</strong></div>
          <div className="pop-stat-row"><span>Assigned</span><strong>{assignedCount}</strong></div>
        </div>
      </div>
    </PoliceOfficerPanel>
  )

  return (
    <PoliceShell
      activeKey="verification-queue"
      rightPanel={rightPanel}
      notificationCount={queue.length}
      verificationPendingCount={queue.length}
    >
      <section className="police-section police-verification-page">
        <div className="police-command-section-head police-verification-page-head">
          <div>
            <h2>Verification Queue</h2>
            <p className="police-shortcuts-hint">Review incoming field reports before they enter active operations.</p>
          </div>
          <button type="button" className="police-action police-action-secondary police-verification-refresh" onClick={loadQueue}>
            Refresh
          </button>
        </div>

        {error ? <p className="police-meta police-verification-feedback police-verification-feedback-error">{error}</p> : null}
        {isLoading ? <p className="police-meta police-verification-feedback">Loading verification queue...</p> : null}

        <div className="police-verification-grid">
          {queue.map((incident) => (
            <article key={incident.id} className="police-verification-card" data-severity={incident.severity}>
              <div className="police-verification-center">
                <strong className="police-title police-verification-title">{incident.displayId} · {incident.title || 'Untitled report'}</strong>
                <p className="police-meta police-verification-description">{incident.description || 'No additional description provided.'}</p>
                <div className="police-verification-facts">
                  <span className="police-meta police-verification-fact">Location: {incident.locationText || 'Not provided'}</span>
                  <span className="police-meta police-verification-fact">Reported: {incident.timeAgo || 'Unknown time'}</span>
                  {incident.reportedBy?.name ? <span className="police-meta police-verification-fact">Reporter: {incident.reportedBy.name}</span> : null}
                </div>
              </div>

              <div className="police-verification-right">
                <div className="police-verification-status-line">
                  <span className={`police-badge ${incident.severity}`}>{displayLabel(incident.severity)}</span>
                  <span className="police-meta">{displayLabel(incident.status)}</span>
                </div>
                <div className="police-verification-actions">
                  <button className="police-action police-verification-btn police-verification-btn-verify" onClick={() => handleAction(incident.id, 'verify')}>Approve</button>
                  <button className="police-action police-verification-btn police-verification-btn-reject" onClick={() => handleAction(incident.id, 'reject')}>Decline</button>
                  <button className="police-action police-verification-btn police-verification-btn-assign" onClick={() => handleAction(incident.id, 'assign')}>Take Case</button>
                  <button className="police-action police-verification-btn police-verification-btn-open" onClick={() => navigate(`/police/incident/${incident.id}`)}>Details</button>
                </div>
              </div>
            </article>
          ))}

          {!isLoading && queue.length === 0 ? <p className="police-meta">No pending incidents in the verification queue.</p> : null}
        </div>
      </section>
    </PoliceShell>
  )
}

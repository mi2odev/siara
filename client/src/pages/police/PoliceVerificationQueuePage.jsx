import React from 'react'
import { useNavigate } from 'react-router-dom'

import PoliceShell from '../../components/layout/PoliceShell'
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
        scope: 'field_reports',
        page: 1,
        pageSize: 30,
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
    <>
      <section className="police-section">
        <h2>Queue Metrics</h2>
        <ul className="police-list police-verification-side-list">
          <li><strong>Awaiting review:</strong> {queue.length}</li>
          <li><strong>Urgent reports:</strong> {highPriorityCount}</li>
          <li><strong>Already assigned:</strong> {assignedCount}</li>
        </ul>
      </section>
      <section className="police-section">
        <h2>Review Tips</h2>
        <ul className="police-list police-verification-side-list">
          <li>Approve reports only when location and context are clear.</li>
          <li>Decline reports that are duplicates, spam, or clearly invalid.</li>
          <li>Take case before field dispatch when you own the operation.</li>
        </ul>
      </section>
    </>
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

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
        <ul className="police-list">
          <li><strong>Pending queue:</strong> {queue.length}</li>
          <li><strong>High priority:</strong> {queue.filter((item) => ['high', 'critical'].includes(item.severity)).length}</li>
          <li><strong>Assigned already:</strong> {queue.filter((item) => item.assignedOfficer?.id).length}</li>
        </ul>
      </section>
      <section className="police-section">
        <h2>Review Tips</h2>
        <ul className="police-list">
          <li>Verify incidents that have enough field context and location clarity.</li>
          <li>Reject reports only when the incident is clearly invalid or duplicated.</li>
          <li>Assign self when you are taking ownership in the field.</li>
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
      <section className="police-section">
        <div className="police-command-section-head">
          <div>
            <h2>Verification Queue</h2>
            <p className="police-shortcuts-hint">Pending citizen or officer reports awaiting police verification.</p>
          </div>
          <button type="button" className="police-action police-action-secondary" onClick={loadQueue}>
            Refresh
          </button>
        </div>

        {error ? <p className="police-meta" style={{ color: '#b91c1c' }}>{error}</p> : null}
        {isLoading ? <p className="police-meta">Loading verification queue...</p> : null}

        <div className="police-verification-grid">
          {queue.map((incident) => (
            <article key={incident.id} className="police-verification-card">
              <div className="police-verification-center">
                <strong className="police-title">{incident.displayId} · {incident.title}</strong>
                <p className="police-meta">{incident.description || 'No description provided.'}</p>
                <span className="police-meta">📍 {incident.locationText}</span>
                <span className="police-meta">Reported {incident.timeAgo}</span>
                {incident.reportedBy?.name ? <span className="police-meta">Reporter: {incident.reportedBy.name}</span> : null}
              </div>

              <div className="police-verification-right">
                <span className={`police-badge ${incident.severity}`}>{displayLabel(incident.severity)}</span>
                <span className="police-meta">{displayLabel(incident.status)}</span>
                <div className="police-verification-actions">
                  <button className="police-action police-action-verify" onClick={() => handleAction(incident.id, 'verify')}>Verify</button>
                  <button className="police-action police-action-reject" onClick={() => handleAction(incident.id, 'reject')}>Reject</button>
                  <button className="police-action police-action-view" onClick={() => handleAction(incident.id, 'assign')}>Assign Self</button>
                  <button className="police-action police-action-secondary" onClick={() => navigate(`/police/incident/${incident.id}`)}>Open</button>
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

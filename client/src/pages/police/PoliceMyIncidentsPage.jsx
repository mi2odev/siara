import React from 'react'
import { useNavigate } from 'react-router-dom'

import PoliceShell from '../../components/layout/PoliceShell'
import { listPoliceIncidents } from '../../services/policeService'

function displayLabel(value) {
  return String(value || '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

export default function PoliceMyIncidentsPage() {
  const navigate = useNavigate()
  const [statusFilter, setStatusFilter] = React.useState('all')
  const [incidents, setIncidents] = React.useState([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [error, setError] = React.useState('')

  React.useEffect(() => {
    let isCancelled = false

    async function loadIncidents() {
      setIsLoading(true)
      setError('')

      try {
        const response = await listPoliceIncidents({
          scope: 'my',
          page: 1,
          pageSize: 30,
          status: statusFilter === 'all' ? undefined : statusFilter,
        })

        if (!isCancelled) {
          setIncidents(response.items)
        }
      } catch (loadError) {
        if (!isCancelled) {
          setError(loadError.message || 'Failed to load assigned incidents.')
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false)
        }
      }
    }

    loadIncidents()
    return () => {
      isCancelled = true
    }
  }, [statusFilter])

  const rightPanel = (
    <section className="police-section">
      <h2>Assignment Summary</h2>
      <ul className="police-list">
        <li><strong>Total:</strong> {incidents.length}</li>
        <li><strong>Under review:</strong> {incidents.filter((item) => item.status === 'under_review').length}</li>
        <li><strong>Verified:</strong> {incidents.filter((item) => item.status === 'verified').length}</li>
        <li><strong>Resolved:</strong> {incidents.filter((item) => item.status === 'resolved').length}</li>
      </ul>
    </section>
  )

  return (
    <PoliceShell activeKey="my-incidents" rightPanel={rightPanel} verificationPendingCount={incidents.filter((item) => item.status === 'pending').length}>
      <section className="police-section police-my-incidents-page">
        <div className="police-command-section-head">
          <div>
            <h2>My Incidents</h2>
            <p className="police-shortcuts-hint">Incidents you created or are currently assigned to handle.</p>
          </div>
          <label className="police-filter-field">
            <span>Status</span>
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option value="all">All</option>
              <option value="pending">Pending</option>
              <option value="under_review">Under review</option>
              <option value="verified">Verified</option>
              <option value="dispatched">Dispatched</option>
              <option value="resolved">Resolved</option>
            </select>
          </label>
        </div>

        {error ? <p className="police-meta" style={{ color: '#b91c1c' }}>{error}</p> : null}
        {isLoading ? <p className="police-meta">Loading assigned incidents...</p> : null}

        <div className="police-my-incidents-list">
          {incidents.map((incident) => (
            <article key={incident.id} className="police-my-incident-card" data-severity={incident.severity}>
              <div className="police-my-incident-main">
                <h3>{incident.displayId}</h3>
                <p>{incident.title}</p>
                <div className="police-my-incident-meta">
                  <span>Location: <strong>{incident.locationText}</strong></span>
                  <span>Priority: <strong>{displayLabel(incident.severity)}</strong></span>
                  <span>Status: <strong>{displayLabel(incident.status)}</strong></span>
                  <span>Updated: <strong>{incident.timeAgo}</strong></span>
                </div>
              </div>

              <div className="police-my-incident-actions">
                <button className="police-action police-action-view" onClick={() => navigate(`/police/incident/${incident.id}`)}>
                  View
                </button>
              </div>
            </article>
          ))}

          {!isLoading && incidents.length === 0 ? (
            <div className="police-empty-state" role="status">
              <div className="police-empty-icon" aria-hidden="true">🗂️</div>
              <h3>No incidents found</h3>
              <p>No assigned incidents match the current status filter.</p>
            </div>
          ) : null}
        </div>
      </section>
    </PoliceShell>
  )
}

import React from 'react'
import { useNavigate } from 'react-router-dom'

import PoliceShell from '../../components/layout/PoliceShell'
import { listPoliceIncidents } from '../../services/policeService'

function displayLabel(value) {
  return String(value || '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

export default function PoliceFieldReportsPage() {
  const navigate = useNavigate()
  const [reports, setReports] = React.useState([])
  const [statusFilter, setStatusFilter] = React.useState('all')
  const [error, setError] = React.useState('')
  const [isLoading, setIsLoading] = React.useState(true)

  const loadReports = React.useCallback(async () => {
    setIsLoading(true)
    setError('')

    try {
      const response = await listPoliceIncidents({
        scope: 'field_reports',
        page: 1,
        pageSize: 30,
        status: statusFilter === 'all' ? undefined : statusFilter,
      })
      setReports(response.items)
    } catch (loadError) {
      setError(loadError.message || 'Failed to load field reports.')
    } finally {
      setIsLoading(false)
    }
  }, [statusFilter])

  React.useEffect(() => {
    loadReports()
  }, [loadReports])

  const rightPanel = (
    <section className="police-section">
      <h2>Reports Summary</h2>
      <ul className="police-list">
        <li><strong>Total visible:</strong> {reports.length}</li>
        <li><strong>Pending:</strong> {reports.filter((item) => item.status === 'pending').length}</li>
        <li><strong>Officer notes:</strong> {reports.reduce((sum, item) => sum + Number(item.fieldNoteCount || 0), 0)}</li>
      </ul>
    </section>
  )

  return (
    <PoliceShell activeKey="field-reports" rightPanel={rightPanel} notificationCount={reports.length}>
      <section className="police-section police-field-reports-page">
        <div className="police-command-section-head">
          <div>
            <h2>Field Reports</h2>
            <p className="police-shortcuts-hint">Citizen and officer reports available for police review.</p>
          </div>

          <label className="police-filter-field">
            <span>Status</span>
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option value="all">All</option>
              <option value="pending">Pending</option>
              <option value="under_review">Under review</option>
              <option value="verified">Verified</option>
              <option value="resolved">Resolved</option>
            </select>
          </label>
        </div>

        {error ? <p className="police-meta" style={{ color: '#b91c1c' }}>{error}</p> : null}
        {isLoading ? <p className="police-meta">Loading field reports...</p> : null}

        <div className="police-feed">
          {reports.map((incident) => (
            <article key={incident.id} className="police-stream-row" data-severity={incident.severity}>
              <span className={`police-severity-strip ${incident.severity}`} aria-hidden="true"></span>
              <div className="police-stream-main">
                <div className="police-stream-headline">
                  <span className={`police-badge ${incident.severity}`}>{displayLabel(incident.severity)}</span>
                  <strong className="police-stream-title">{incident.title}</strong>
                  <span className="police-stream-time">{incident.timeAgo}</span>
                </div>
                <div className="police-stream-meta-line">
                  <span>{incident.locationText}</span>
                  <span>Status: {displayLabel(incident.status)}</span>
                  <span>Source: {displayLabel(incident.sourceChannel || 'citizen')}</span>
                </div>
                <p className="police-stream-description">{incident.description || 'No description provided.'}</p>
              </div>
              <div className="police-stream-actions">
                <button type="button" className="police-action police-action-view" onClick={() => navigate(`/police/incident/${incident.id}`)}>
                  Open
                </button>
              </div>
            </article>
          ))}

          {!isLoading && reports.length === 0 ? (
            <div className="police-empty-state" role="status">
              <div className="police-empty-icon" aria-hidden="true">📝</div>
              <h3>No field reports found</h3>
              <p>Try another status filter or check back for new reports.</p>
            </div>
          ) : null}
        </div>
      </section>
    </PoliceShell>
  )
}

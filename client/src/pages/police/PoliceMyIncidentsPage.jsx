import React from 'react'
import { useNavigate } from 'react-router-dom'

import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined'
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded'
import PersonSearchOutlinedIcon from '@mui/icons-material/PersonSearchOutlined'
import PriorityHighRoundedIcon from '@mui/icons-material/PriorityHighRounded'
import ReportProblemOutlinedIcon from '@mui/icons-material/ReportProblemOutlined'
import CheckCircleOutlinedIcon from '@mui/icons-material/CheckCircleOutlined'

import PoliceShell from '../../components/layout/PoliceShell'
import { listPoliceIncidents } from '../../services/policeService'

function displayLabel(value) {
  return String(value || '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

function SeverityBadgeIcon({ severity }) {
  const props = { fontSize: 'inherit' }
  if (severity === 'critical' || severity === 'high') return <PriorityHighRoundedIcon {...props} />
  if (severity === 'medium') return <ReportProblemOutlinedIcon {...props} />
  return <CheckCircleOutlinedIcon {...props} />
}

const STATUS_OPTIONS = [
  { value: 'all', label: 'All statuses' },
  { value: 'pending', label: 'Pending' },
  { value: 'under_review', label: 'Under review' },
  { value: 'verified', label: 'Verified' },
  { value: 'dispatched', label: 'Dispatched' },
  { value: 'resolved', label: 'Resolved' },
]

export default function PoliceMyIncidentsPage() {
  const navigate = useNavigate()
  const [statusFilter, setStatusFilter] = React.useState('all')
  const [incidents, setIncidents] = React.useState([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [error, setError] = React.useState('')

  const loadIncidents = React.useCallback(async () => {
    setIsLoading(true)
    setError('')

    try {
      const response = await listPoliceIncidents({
        scope: 'my',
        page: 1,
        pageSize: 30,
        status: statusFilter === 'all' ? undefined : statusFilter,
      })
      setIncidents(response.items)
    } catch (loadError) {
      setError(loadError.message || 'Failed to load assigned incidents.')
    } finally {
      setIsLoading(false)
    }
  }, [statusFilter])

  React.useEffect(() => {
    loadIncidents()
  }, [loadIncidents])

  const totalCount = incidents.length
  const underReviewCount = incidents.filter((item) => item.status === 'under_review').length
  const verifiedCount = incidents.filter((item) => item.status === 'verified').length
  const resolvedCount = incidents.filter((item) => item.status === 'resolved').length
  const pendingCount = incidents.filter((item) => item.status === 'pending').length

  const rightPanel = (
    <section className="police-section police-dashboard-side-card">
      <div className="police-dashboard-side-header">
        <h2>Assignment Summary</h2>
      </div>
      <div className="police-selected-details police-dashboard-side-details">
        <div className="police-selected-line"><span>Total</span><strong>{totalCount}</strong></div>
        <div className="police-selected-line"><span>Pending</span><strong>{pendingCount}</strong></div>
        <div className="police-selected-line"><span>Under review</span><strong>{underReviewCount}</strong></div>
        <div className="police-selected-line"><span>Verified</span><strong>{verifiedCount}</strong></div>
        <div className="police-selected-line"><span>Resolved</span><strong>{resolvedCount}</strong></div>
      </div>
    </section>
  )

  return (
    <PoliceShell
      activeKey="my-incidents"
      rightPanel={rightPanel}
      verificationPendingCount={pendingCount}
    >
      <section className="police-section police-dashboard-overview police-my-incidents-page">
        <div className="police-command-section-head police-dashboard-head">
          <div className="police-dashboard-head-text">
            <h2>My Incidents</h2>
            <p className="police-shortcuts-hint">
              Cases you reported or that have been assigned to you.
            </p>
          </div>
          <div className="police-dashboard-head-actions police-my-incidents-actions-bar">
            <label className="police-filter-field">
              <span>Status</span>
              <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                {STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>
            <button
              type="button"
              className="police-action police-dashboard-refresh police-dashboard-refresh-icon"
              onClick={loadIncidents}
              disabled={isLoading}
              title="Refresh"
              aria-label="Refresh"
            >
              <RefreshRoundedIcon fontSize="inherit" className={isLoading ? 'is-spinning' : ''} />
              <span>Refresh</span>
            </button>
          </div>
        </div>
      </section>

      <section className="police-section police-my-incidents-section">
        {error ? <p className="police-history-feedback police-history-feedback-error">{error}</p> : null}
        {isLoading ? <p className="police-meta">Loading assigned incidents…</p> : null}

        <div className="police-my-incidents-list">
          {incidents.map((incident) => (
            <article
              key={incident.id}
              className="police-my-incident-card"
              data-severity={incident.severity}
            >
              <span className={`police-my-incident-strip ${incident.severity}`} aria-hidden="true" />
              <div className="police-my-incident-main">
                <div className="police-my-incident-top">
                  <span className="police-my-incident-id">{incident.displayId}</span>
                  <span className={`police-badge ${incident.severity}`}>
                    <SeverityBadgeIcon severity={incident.severity} />
                    {displayLabel(incident.severity)}
                  </span>
                  <span className={`police-badge ${incident.status} police-my-incident-status`}>
                    {displayLabel(incident.status)}
                  </span>
                </div>
                <h3 className="police-my-incident-title">{incident.title || 'Untitled incident'}</h3>
                {incident.locationText ? (
                  <p className="police-my-incident-location">{incident.locationText}</p>
                ) : null}
                <div className="police-my-incident-meta">
                  <span>Updated <strong>{incident.timeAgo || '—'}</strong></span>
                  {incident.reportedBy?.name ? (
                    <span>Reporter <strong>{incident.reportedBy.name}</strong></span>
                  ) : null}
                </div>
              </div>

              <div className="police-my-incident-actions">
                <button
                  type="button"
                  className="police-action police-action-view police-my-incident-view"
                  onClick={() => navigate(`/police/incident/${incident.id}`)}
                >
                  <VisibilityOutlinedIcon fontSize="inherit" />
                  <span>View</span>
                </button>
              </div>
            </article>
          ))}

          {!isLoading && incidents.length === 0 ? (
            <div className="police-empty-state" role="status">
              <div className="police-empty-icon" aria-hidden="true">
                <PersonSearchOutlinedIcon fontSize="inherit" />
              </div>
              <h3>No incidents found</h3>
              <p>No assigned incidents match the current status filter.</p>
            </div>
          ) : null}
        </div>
      </section>
    </PoliceShell>
  )
}

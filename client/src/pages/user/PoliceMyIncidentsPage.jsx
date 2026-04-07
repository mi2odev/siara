import React, { useContext, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import PoliceShell from '../../components/layout/PoliceShell'
import { AuthContext } from '../../contexts/AuthContext'
import { getPoliceIncidents, subscribePoliceIncidents } from '../../data/policeMockData'

const FILTER_OPTIONS = [
  { key: 'under_review', label: 'Under Review' },
  { key: 'verified', label: 'Verified' },
  { key: 'resolved', label: 'Resolved' },
]

function normalizeText(value) {
  return String(value || '').trim().toLowerCase()
}

function isAssignedToOfficer(incident, officerName) {
  const assigned = normalizeText(incident?.assignedOfficer)
  const officer = normalizeText(officerName)
  if (!assigned || !officer) return false

  if (assigned === officer) return true

  const officerTokens = officer.split(/\s+/).filter(Boolean)
  return officerTokens.some((token) => token.length >= 3 && assigned.includes(token))
}

function displayStatus(value) {
  return String(value || '')
    .replace('_', ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

export default function PoliceMyIncidentsPage() {
  const navigate = useNavigate()
  const { user } = useContext(AuthContext)
  const officerName = user?.name || 'Officer'

  const [incidents, setIncidents] = useState(() => getPoliceIncidents())
  const [statusFilter, setStatusFilter] = useState('under_review')

  useEffect(() => {
    const unsubscribe = subscribePoliceIncidents((items) => {
      setIncidents(items)
    })

    return unsubscribe
  }, [])

  const assignedIncidents = useMemo(
    () => incidents
      .filter((item) => isAssignedToOfficer(item, officerName))
      .sort((left, right) => new Date(right.occurredAt).getTime() - new Date(left.occurredAt).getTime()),
    [incidents, officerName],
  )

  const filteredIncidents = useMemo(
    () => assignedIncidents.filter((item) => item.status === statusFilter),
    [assignedIncidents, statusFilter],
  )

  const counters = useMemo(() => ({
    under_review: assignedIncidents.filter((item) => item.status === 'under_review').length,
    verified: assignedIncidents.filter((item) => item.status === 'verified').length,
    resolved: assignedIncidents.filter((item) => item.status === 'resolved').length,
  }), [assignedIncidents])

  const rightPanel = (
    <section className="police-section">
      <h2>Assignment Summary</h2>
      <ul className="police-list">
        <li><strong>Officer:</strong> {officerName}</li>
        <li><strong>Total assigned:</strong> {assignedIncidents.length}</li>
        <li><strong>Under review:</strong> {counters.under_review}</li>
        <li><strong>Verified:</strong> {counters.verified}</li>
        <li><strong>Resolved:</strong> {counters.resolved}</li>
      </ul>
    </section>
  )

  return (
    <PoliceShell
      activeKey="my-incidents"
      rightPanel={rightPanel}
      notificationCount={counters.under_review}
      verificationPendingCount={counters.under_review}
    >
      <section className="police-section police-my-incidents-page">
        <div className="police-my-incidents-head">
          <div>
            <h2>My Incidents</h2>
            <p className="police-shortcuts-hint">You are handling {assignedIncidents.length} incidents</p>
          </div>
        </div>

        <div className="police-my-incidents-filters">
          {FILTER_OPTIONS.map((item) => (
            <button
              key={item.key}
              className={`police-status-chip ${statusFilter === item.key ? 'active' : ''}`}
              onClick={() => setStatusFilter(item.key)}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="police-my-incidents-list">
          {filteredIncidents.map((incident) => (
            <article key={incident.id} className="police-my-incident-card">
              <div className="police-my-incident-main">
                <h3>{incident.id}</h3>
                <p>{incident.location}</p>
                <div className="police-my-incident-meta">
                  <span>Priority: <strong>{displayStatus(incident.severity)}</strong></span>
                  <span>Status: <strong>{displayStatus(incident.status)}</strong></span>
                  <span>Last update: <strong>{incident.timeAgo}</strong></span>
                </div>
              </div>

              <div className="police-my-incident-actions">
                <button
                  className="police-action police-action-view"
                  onClick={() => navigate(`/police/incident/${incident.id}`)}
                >
                  View
                </button>
                <button
                  className="police-action police-action-review"
                  onClick={() => navigate('/police/verification', { state: { incidentId: incident.id } })}
                >
                  Continue handling
                </button>
              </div>
            </article>
          ))}

          {filteredIncidents.length === 0 ? (
            <div className="police-empty-state" role="status" aria-live="polite">
              <div className="police-empty-icon" aria-hidden="true">🗂️</div>
              <h3>No incidents in this status</h3>
              <p>Switch status filter or wait for new assignments.</p>
            </div>
          ) : null}
        </div>
      </section>
    </PoliceShell>
  )
}
import React, { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import PoliceShell from '../../components/layout/PoliceShell'
import { getPoliceFieldReports, getPoliceIncidents } from '../../data/policeMockData'

function formatTime(value) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Unknown time'

  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

export default function PoliceFieldReportsPage() {
  const navigate = useNavigate()

  const reports = useMemo(
    () => getPoliceFieldReports()
      .sort((left, right) => new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime()),
    [],
  )

  const incidents = useMemo(() => getPoliceIncidents(), [])
  const incidentOptions = useMemo(
    () => Array.from(new Set(reports.map((item) => item.incidentId))).sort((left, right) => left.localeCompare(right)),
    [reports],
  )

  const [incidentFilter, setIncidentFilter] = useState('all')

  const filteredReports = useMemo(
    () => reports.filter((item) => incidentFilter === 'all' || item.incidentId === incidentFilter),
    [reports, incidentFilter],
  )

  const incidentById = useMemo(
    () => Object.fromEntries(incidents.map((item) => [item.id, item])),
    [incidents],
  )

  const rightPanel = (
    <section className="police-section">
      <h2>Reports Summary</h2>
      <ul className="police-list">
        <li><strong>Total reports:</strong> {reports.length}</li>
        <li><strong>Visible:</strong> {filteredReports.length}</li>
        <li><strong>Incidents covered:</strong> {incidentOptions.length}</li>
      </ul>
    </section>
  )

  return (
    <PoliceShell activeKey="field-reports" rightPanel={rightPanel} notificationCount={filteredReports.length}>
      <section className="police-section police-field-reports-page">
        <div className="police-command-section-head">
          <h2>Field Reports</h2>
          <label className="police-filter-field">
            <span>Incident</span>
            <select value={incidentFilter} onChange={(event) => setIncidentFilter(event.target.value)}>
              <option value="all">All incidents</option>
              {incidentOptions.map((id) => (
                <option key={id} value={id}>{id}</option>
              ))}
            </select>
          </label>
        </div>

        <p className="police-shortcuts-hint">Operational notes submitted by officers in the field.</p>

        <div className="police-field-timeline">
          {filteredReports.map((report) => (
            <article key={report.id} className="police-field-report-item">
              <div className="police-field-report-dot" aria-hidden="true"></div>

              <div className="police-field-report-card">
                <div className="police-field-report-head">
                  <strong>{report.officerName}</strong>
                  <time dateTime={report.timestamp}>{formatTime(report.timestamp)}</time>
                </div>

                <p>{report.content}</p>

                <div className="police-field-report-meta">
                  <span>Incident: <strong>{report.incidentId}</strong></span>
                  <button
                    type="button"
                    className="police-action police-action-view"
                    onClick={() => navigate(`/police/incident/${report.incidentId}`)}
                  >
                    Open incident
                  </button>
                </div>

                {incidentById[report.incidentId]?.location ? (
                  <span className="police-field-report-location">{incidentById[report.incidentId].location}</span>
                ) : null}
              </div>
            </article>
          ))}

          {filteredReports.length === 0 ? (
            <div className="police-empty-state" role="status" aria-live="polite">
              <div className="police-empty-icon" aria-hidden="true">📝</div>
              <h3>No reports found</h3>
              <p>Try another incident filter.</p>
            </div>
          ) : null}
        </div>
      </section>
    </PoliceShell>
  )
}

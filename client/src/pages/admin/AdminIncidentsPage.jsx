/**
 * @file AdminIncidentsPage.jsx
 * @description Incident management page for reviewing and actioning reported incidents.
 */
import React, { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'

import {
  fetchAdminIncidents,
  normalizeIncidentFilter,
} from '../../services/adminIncidentsService'

const EMPTY_TEXT = '\u2014'
const TAB_DEFINITIONS = [
  { key: 'all', label: 'All' },
  { key: 'pending', label: 'Pending' },
  { key: 'ai-flagged', label: 'AI-Flagged' },
  { key: 'community', label: 'Community' },
  { key: 'merged', label: 'Merged' },
  { key: 'archived', label: 'Archived' },
]

function formatIncidentType(value) {
  return String(value || 'other')
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (match) => match.toUpperCase())
}

function getConfidenceFillClass(confidence) {
  if (typeof confidence !== 'number') {
    return ''
  }

  if (confidence >= 85) {
    return 'success'
  }

  if (confidence >= 65) {
    return 'warning'
  }

  return 'danger'
}

function getEmptyState(filter, completedAiReports) {
  if (filter === 'ai-flagged' && completedAiReports === 0) {
    return 'AI verification is not active yet for incident reports.'
  }

  if (filter === 'community') {
    return 'No reports currently have open community flags.'
  }

  if (filter === 'merged') {
    return 'No merged incidents were found.'
  }

  if (filter === 'archived') {
    return 'No archived incidents were found.'
  }

  if (filter === 'pending') {
    return 'No pending incidents are waiting for review.'
  }

  return 'No incidents match the current filters.'
}

function downloadCsv(rows) {
  if (!rows.length) {
    return
  }

  const header = [
    'Display ID',
    'Report ID',
    'Type',
    'Title',
    'Location',
    'Severity',
    'Severity Source',
    'Confidence Status',
    'Confidence',
    'Status',
    'Open Flags',
    'Created At',
  ]

  const csvRows = rows.map((row) => [
    row.displayId,
    row.reportId,
    row.incidentType,
    row.title,
    row.location,
    row.severity,
    row.severitySource,
    row.confidenceStatus || '',
    row.confidence ?? '',
    row.status,
    row.openFlagCount,
    row.createdAt || '',
  ])

  const content = [header, ...csvRows]
    .map((line) => line.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(','))
    .join('\n')

  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = 'admin-incidents.csv'
  anchor.click()
  URL.revokeObjectURL(url)
}

export default function AdminIncidentsPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [search, setSearch] = useState('')
  const [sortField, setSortField] = useState('confidence')
  const [sortDir, setSortDir] = useState('desc')
  const [incidents, setIncidents] = useState([])
  const [counts, setCounts] = useState({
    all: 0,
    pending: 0,
    'ai-flagged': 0,
    community: 0,
    merged: 0,
    archived: 0,
    completedAiReports: 0,
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const filterParam = normalizeIncidentFilter(searchParams.get('filter') || 'all')

  useEffect(() => {
    const controller = new AbortController()

    async function loadIncidents() {
      setLoading(true)
      setError(null)

      try {
        const payload = await fetchAdminIncidents(
          {
            filter: filterParam,
            search,
            sortField,
            sortDir,
          },
          { signal: controller.signal },
        )

        if (!controller.signal.aborted) {
          setIncidents(payload.incidents)
          setCounts(payload.counts)
        }
      } catch (requestError) {
        if (!controller.signal.aborted) {
          setError(requestError)
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false)
        }
      }
    }

    loadIncidents()

    return () => controller.abort()
  }, [filterParam, search, sortField, sortDir])

  function toggleSort(field) {
    if (sortField === field) {
      setSortDir((current) => (current === 'desc' ? 'asc' : 'desc'))
      return
    }

    setSortField(field)
    setSortDir('desc')
  }

  function SortIcon({ field }) {
    if (sortField !== field) {
      return null
    }

    return (
      <span style={{ marginLeft: 3, fontSize: 9 }}>
        {sortDir === 'desc' ? '▼' : '▲'}
      </span>
    )
  }

  return (
    <>
      <div className="admin-page-header">
        <div>
          <h1 className="admin-page-title">Incident Management</h1>
          <p className="admin-page-subtitle">Review, classify and action all reported incidents</p>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <input
            className="admin-input"
            type="text"
            placeholder="Search ID, title, location, reporter…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            style={{ width: 260, height: 32, fontSize: 11.5 }}
          />
          <button
            className="admin-btn admin-btn-ghost"
            type="button"
            onClick={() => downloadCsv(incidents)}
            disabled={!incidents.length}
          >
            Export CSV
          </button>
        </div>
      </div>

      <div className="admin-tabs" style={{ marginBottom: 12 }}>
        {TAB_DEFINITIONS.map((tab) => (
          <button
            key={tab.key}
            className={`admin-tab ${filterParam === tab.key ? 'active' : ''}`}
            onClick={() => setSearchParams(tab.key === 'all' ? {} : { filter: tab.key })}
          >
            {tab.label}
            <span className="tab-count">{counts[tab.key] ?? 0}</span>
          </button>
        ))}
      </div>

      {error && (
        <div
          className="admin-card"
          style={{
            marginBottom: 12,
            borderColor: 'rgba(239, 68, 68, 0.35)',
            background: 'rgba(239, 68, 68, 0.05)',
          }}
        >
          <div className="admin-card-header">
            <div>
              <h2 className="admin-card-title">Unable to load incidents</h2>
              <p className="admin-card-subtitle">{error.message || 'Please try again.'}</p>
            </div>
          </div>
        </div>
      )}

      <div className="admin-card">
        <div className="admin-table-wrapper">
          <table className="admin-table">
            <thead>
              <tr>
                <th style={{ cursor: 'pointer' }} onClick={() => toggleSort('id')}>ID <SortIcon field="id" /></th>
                <th style={{ cursor: 'pointer' }} onClick={() => toggleSort('incidentType')}>Type <SortIcon field="incidentType" /></th>
                <th style={{ cursor: 'pointer' }} onClick={() => toggleSort('location')}>Location <SortIcon field="location" /></th>
                <th style={{ cursor: 'pointer' }} onClick={() => toggleSort('severity')}>Severity <SortIcon field="severity" /></th>
                <th style={{ cursor: 'pointer' }} onClick={() => toggleSort('confidence')}>Confidence <SortIcon field="confidence" /></th>
                <th>Reporter Score</th>
                <th style={{ cursor: 'pointer' }} onClick={() => toggleSort('createdAt')}>Since Reported <SortIcon field="createdAt" /></th>
                <th style={{ cursor: 'pointer' }} onClick={() => toggleSort('status')}>Status <SortIcon field="status" /></th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={9} style={{ textAlign: 'center', padding: 32, color: 'var(--admin-text-muted)' }}>
                    Loading incidents…
                  </td>
                </tr>
              ) : incidents.length > 0 ? (
                incidents.map((incident) => (
                  <tr
                    key={incident.reportId}
                    className={incident.severity === 'high' && incident.status === 'pending' ? 'row-highlight' : ''}
                  >
                    <td style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                      {incident.displayId}
                    </td>
                    <td style={{ fontSize: 11 }}>{formatIncidentType(incident.incidentType)}</td>
                    <td style={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {incident.location}
                    </td>
                    <td>
                      <span className={`admin-pill ${incident.severity}`}>{incident.severity}</span>
                    </td>
                    <td>
                      {typeof incident.confidence === 'number' && incident.confidenceStatus === 'completed' ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                          <div className="admin-progress" style={{ width: 44 }}>
                            <div
                              className={`admin-progress-fill ${getConfidenceFillClass(incident.confidence)}`}
                              style={{ width: `${incident.confidence}%` }}
                            ></div>
                          </div>
                          <span style={{ fontSize: 10.5, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                            {incident.confidence}%
                          </span>
                        </div>
                      ) : (
                        <span style={{ fontSize: 11, color: 'var(--admin-text-muted)', fontWeight: 500 }}>
                          {incident.confidenceStatus === 'pending'
                            ? 'Pending AI'
                            : incident.confidenceStatus === 'failed'
                              ? 'AI failed'
                              : EMPTY_TEXT}
                        </span>
                      )}
                    </td>
                    <td>
                      <span style={{ fontWeight: 600, fontSize: 11, color: 'var(--admin-text-muted)' }}>
                        {EMPTY_TEXT}
                      </span>
                    </td>
                    <td style={{ fontVariantNumeric: 'tabular-nums', fontSize: 11, color: 'var(--admin-text-secondary)' }}>
                      {incident.ago}
                    </td>
                    <td>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        <span className={`admin-pill ${incident.status}`}>{incident.status}</span>
                        {incident.openFlagCount > 0 ? (
                          <span className="admin-pill warning">{incident.openFlagCount} flag{incident.openFlagCount === 1 ? '' : 's'}</span>
                        ) : null}
                      </div>
                    </td>
                    <td>
                      <button
                        className="admin-btn admin-btn-sm admin-btn-primary"
                        onClick={() => navigate(`/admin/incidents/${incident.reportId}`)}
                      >
                        Review
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={9} style={{ textAlign: 'center', padding: 32, color: 'var(--admin-text-muted)' }}>
                    {getEmptyState(filterParam, counts.completedAiReports)}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '10px 14px',
            borderTop: '1px solid var(--admin-border)',
            fontSize: 11,
            color: 'var(--admin-text-muted)',
          }}
        >
          <span>
            Showing {incidents.length} of {counts[filterParam] ?? 0} incidents
          </span>
          <span>
            Total reports: {counts.all}
          </span>
        </div>
      </div>
    </>
  )
}

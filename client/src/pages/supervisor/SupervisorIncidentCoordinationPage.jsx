import React, { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded'
import FancySelect from '../../components/ui/FancySelect'
import AssignmentOutlinedIcon from '@mui/icons-material/AssignmentOutlined'

import PoliceShell from '../../components/layout/PoliceShell'
import {
  assignIncidentToOfficer,
  listAssignableOfficersForIncident,
  listPoliceIncidents,
} from '../../services/policeService'
import '../../styles/SupervisorMode.css'

function severityLabel(hint) {
  if (hint >= 4) return 'High'
  if (hint === 3) return 'Medium'
  return 'Low'
}

function severityClass(hint) {
  if (hint >= 4) return 'high'
  if (hint === 3) return 'medium'
  return 'low'
}

function statusLabel(status) {
  return String(status || '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

function formatRelative(value) {
  if (!value) return '—'
  const diff = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 60000))
  if (diff < 1) return 'Just now'
  if (diff < 60) return `${diff}m ago`
  const h = Math.floor(diff / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

export default function SupervisorIncidentCoordinationPage() {
  const navigate = useNavigate()

  const [incidents, setIncidents] = useState([])
  const [officersByIncident, setOfficersByIncident] = useState({})
  const [officersLoading, setOfficersLoading] = useState({})
  const [officersError, setOfficersError] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [statusFilter, setStatusFilter] = useState('all')
  const [severityFilter, setSeverityFilter] = useState('all')
  const [search, setSearch] = useState('')

  const [assigning, setAssigning] = useState({})
  const [selectedOfficer, setSelectedOfficer] = useState({})
  const [toast, setToast] = useState(null)

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  const load = useCallback(async () => {
    try {
      const incResult = await listPoliceIncidents({ scope: 'all', pageSize: 50 })
      setIncidents(incResult.items || [])
      setError(null)
    } catch (err) {
      setError(err.message || 'Failed to load coordination data')
    } finally {
      setLoading(false)
    }
  }, [])

  const loadAssignableOfficers = useCallback(async (incidentId) => {
    if (!incidentId) return
    setOfficersLoading((prev) => ({ ...prev, [incidentId]: true }))
    setOfficersError((prev) => ({ ...prev, [incidentId]: null }))
    try {
      const result = await listAssignableOfficersForIncident(incidentId)
      setOfficersByIncident((prev) => ({ ...prev, [incidentId]: result.items || [] }))
    } catch (err) {
      setOfficersError((prev) => ({
        ...prev,
        [incidentId]: err.message || 'Failed to load officers',
      }))
      setOfficersByIncident((prev) => ({ ...prev, [incidentId]: [] }))
    } finally {
      setOfficersLoading((prev) => ({ ...prev, [incidentId]: false }))
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    incidents.forEach((inc) => {
      if (inc.id && officersByIncident[inc.id] == null && !officersLoading[inc.id]) {
        loadAssignableOfficers(inc.id)
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [incidents])

  const handleAssign = async (incidentId) => {
    const officerId = selectedOfficer[incidentId]
    if (!officerId) return

    setAssigning((prev) => ({ ...prev, [incidentId]: true }))
    try {
      await assignIncidentToOfficer(incidentId, { officerUserId: officerId })
      showToast('Officer assigned successfully')
      await load()
      await loadAssignableOfficers(incidentId)
      setSelectedOfficer((prev) => ({ ...prev, [incidentId]: '' }))
    } catch (err) {
      showToast(err.message || 'Assignment failed', 'error')
    } finally {
      setAssigning((prev) => ({ ...prev, [incidentId]: false }))
    }
  }

  const renderOfficerOption = (off) => {
    const distance =
      off.distanceLabel
      || (off.distanceMeters == null
        ? 'Location unavailable'
        : off.distanceMeters < 1000
          ? `${Math.round(off.distanceMeters)} m away`
          : `${(off.distanceMeters / 1000).toFixed(1)} km away`)
    const badge = off.badgeNumber ? ` (${off.badgeNumber})` : ''
    const dutyTag = off.isOnDuty ? '' : ' — Off duty'
    return `${off.name}${badge} — ${distance}${dutyTag}`
  }

  const filteredIncidents = incidents.filter((inc) => {
    if (statusFilter !== 'all' && inc.status !== statusFilter) return false
    if (severityFilter !== 'all') {
      const sev = severityClass(inc.severityHint)
      if (sev !== severityFilter) return false
    }
    if (search) {
      const q = search.toLowerCase()
      const haystack = [inc.title, inc.locationLabel, inc.id].filter(Boolean).join(' ').toLowerCase()
      if (!haystack.includes(q)) return false
    }
    return true
  })

  const statuses = ['all', 'pending', 'under_review', 'verified', 'dispatched']
  const severities = ['all', 'high', 'medium', 'low']

  return (
    <PoliceShell activeKey="incident-coordination" rightPanelCollapsed>
      <div className="supervisor-page">
        <div className="sv-page-header">
          <div className="sv-page-title-block">
            <span className="sv-page-eyebrow">Supervisor — Operations</span>
            <h1 className="sv-page-title">Incident Coordination</h1>
            <p className="sv-page-subtitle">Assign and coordinate officer responses to active incidents</p>
          </div>
          <div className="sv-page-actions">
            <button className="sv-btn sv-btn-ghost sv-btn-refresh" onClick={load} disabled={loading}><RefreshRoundedIcon fontSize="inherit" /> Refresh</button>
          </div>
        </div>

        {error && <div className="sv-error" style={{ marginBottom: 20 }}>{error}</div>}

        {/* Filters */}
        <div className="sv-filters-bar">
          <input
            className="sv-search-input"
            type="search"
            placeholder="Search incidents..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {statuses.map((s) => (
              <button
                key={s}
                className={`sv-filter-btn ${statusFilter === s ? 'active' : ''}`}
                onClick={() => setStatusFilter(s)}
              >
                {s === 'all' ? 'All Statuses' : statusLabel(s)}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {severities.map((s) => (
              <button
                key={s}
                className={`sv-filter-btn ${severityFilter === s ? 'active' : ''}`}
                onClick={() => setSeverityFilter(s)}
              >
                {s === 'all' ? 'All Severity' : s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="sv-loading"><div className="sv-loading-spinner" /><span>Loading incidents...</span></div>
        ) : filteredIncidents.length === 0 ? (
          <div className="sv-section">
            <div className="sv-empty">
              <span className="sv-empty-icon"><AssignmentOutlinedIcon fontSize="inherit" /></span>
              No incidents match the current filters
            </div>
          </div>
        ) : (
          <div className="sv-section">
            <div className="sv-section-head">
              <h2 className="sv-section-title">
                Active Incidents
                <span className="sv-badge sv-badge-primary" style={{ marginLeft: 8 }}>
                  {filteredIncidents.length}
                </span>
              </h2>
            </div>
            <div className="sv-table-wrap">
              <table className="sv-table">
                <thead>
                  <tr>
                    <th>Incident</th>
                    <th>Location</th>
                    <th>Severity</th>
                    <th>Status</th>
                    <th>Assigned To</th>
                    <th>Reported</th>
                    <th>Assign Officer</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredIncidents.map((inc) => {
                    const sev = severityClass(inc.severityHint)
                    return (
                      <tr key={inc.id}>
                        <td>
                          <div style={{ fontWeight: 600, fontSize: 13 }}>
                            {inc.title || inc.displayId || inc.id?.slice(0, 8)}
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--sv-text-muted)' }}>
                            {inc.displayId || inc.id?.slice(0, 8)}
                          </div>
                        </td>
                        <td style={{ fontSize: 12, color: 'var(--sv-text-muted)', maxWidth: 140 }}>
                          {inc.commune?.name || inc.wilaya?.name || inc.locationLabel || '—'}
                        </td>
                        <td>
                          <span className={`sv-badge sv-badge-${sev}`}>
                            {severityLabel(inc.severityHint)}
                          </span>
                        </td>
                        <td>
                          <span className="sv-badge sv-badge-neutral">
                            {statusLabel(inc.status)}
                          </span>
                        </td>
                        <td style={{ fontSize: 12 }}>
                          {inc.assignedOfficer?.name || (
                            <span style={{ color: 'var(--sv-text-muted)', fontStyle: 'italic' }}>Unassigned</span>
                          )}
                        </td>
                        <td style={{ fontSize: 11, color: 'var(--sv-text-muted)' }}>
                          {formatRelative(inc.occurredAt || inc.createdAt)}
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                            {(() => {
                              const list = officersByIncident[inc.id]
                              const isOfficersLoading = officersLoading[inc.id]
                              const officersErr = officersError[inc.id]
                              if (officersErr) {
                                return (
                                  <span style={{ fontSize: 11, color: 'var(--sv-text-muted)' }}>
                                    {officersErr}
                                  </span>
                                )
                              }
                              if (isOfficersLoading || list == null) {
                                return (
                                  <span style={{ fontSize: 11, color: 'var(--sv-text-muted)' }}>
                                    Loading…
                                  </span>
                                )
                              }
                              if (list.length === 0) {
                                return (
                                  <span style={{ fontSize: 11, color: 'var(--sv-text-muted)' }}>
                                    No officers in your commune
                                  </span>
                                )
                              }
                              return (
                                <FancySelect
                                  value={selectedOfficer[inc.id] || ''}
                                  onChange={(value) =>
                                    setSelectedOfficer((prev) => ({ ...prev, [inc.id]: value }))
                                  }
                                  menuAlign="left"
                                  options={[
                                    { value: '', label: 'Select officer...' },
                                    ...list.map((off) => ({
                                      value: off.id,
                                      label: renderOfficerOption(off),
                                    })),
                                  ]}
                                />
                              )
                            })()}
                            <button
                              className="sv-assign-btn"
                              onClick={() => handleAssign(inc.id)}
                              disabled={!selectedOfficer[inc.id] || assigning[inc.id]}
                            >
                              {assigning[inc.id] ? '...' : 'Assign'}
                            </button>
                          </div>
                        </td>
                        <td>
                          <button
                            className="sv-btn sv-btn-ghost"
                            style={{ fontSize: 11, padding: '4px 10px' }}
                            onClick={() => navigate(`/police/incident/${inc.id}`)}
                          >
                            View
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {toast && (
          <div className={`sv-toast sv-toast-${toast.type}`}>{toast.msg}</div>
        )}
      </div>
    </PoliceShell>
  )
}

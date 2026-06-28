import React, { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
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

function severityLabel(hint, t) {
  if (hint >= 4) return t('supervisorIncidentCoordinationPage.severity.high')
  if (hint === 3) return t('supervisorIncidentCoordinationPage.severity.medium')
  return t('supervisorIncidentCoordinationPage.severity.low')
}

function severityClass(hint) {
  if (hint >= 4) return 'high'
  if (hint === 3) return 'medium'
  return 'low'
}

function statusLabel(status) {
  return String(status || '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

function formatRelative(value, t) {
  if (!value) return '—'
  const diff = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 60000))
  if (diff < 1) return t('supervisorIncidentCoordinationPage.time.justNow')
  if (diff < 60) return t('supervisorIncidentCoordinationPage.time.minutesAgo', { count: diff })
  const h = Math.floor(diff / 60)
  if (h < 24) return t('supervisorIncidentCoordinationPage.time.hoursAgo', { count: h })
  return t('supervisorIncidentCoordinationPage.time.daysAgo', { count: Math.floor(h / 24) })
}

export default function SupervisorIncidentCoordinationPage() {
  const { t } = useTranslation(['supervisor', 'common'])
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
      setError(err.message || t('supervisorIncidentCoordinationPage.errors.loadFailed'))
    } finally {
      setLoading(false)
    }
  }, [t])

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
        [incidentId]: err.message || t('supervisorIncidentCoordinationPage.errors.loadOfficersFailed'),
      }))
      setOfficersByIncident((prev) => ({ ...prev, [incidentId]: [] }))
    } finally {
      setOfficersLoading((prev) => ({ ...prev, [incidentId]: false }))
    }
  }, [t])

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
      showToast(t('supervisorIncidentCoordinationPage.toast.assignSuccess'))
      await load()
      await loadAssignableOfficers(incidentId)
      setSelectedOfficer((prev) => ({ ...prev, [incidentId]: '' }))
    } catch (err) {
      showToast(err.message || t('supervisorIncidentCoordinationPage.toast.assignFailed'), 'error')
    } finally {
      setAssigning((prev) => ({ ...prev, [incidentId]: false }))
    }
  }

  const renderOfficerOption = (off) => {
    const distance =
      off.distanceLabel
      || (off.distanceMeters == null
        ? t('supervisorIncidentCoordinationPage.officer.locationUnavailable')
        : off.distanceMeters < 1000
          ? t('supervisorIncidentCoordinationPage.officer.metersAway', { meters: Math.round(off.distanceMeters) })
          : t('supervisorIncidentCoordinationPage.officer.kmAway', { km: (off.distanceMeters / 1000).toFixed(1) }))
    const badge = off.badgeNumber ? ` (${off.badgeNumber})` : ''
    const dutyTag = off.isOnDuty ? '' : ` — ${t('supervisorIncidentCoordinationPage.officer.offDuty')}`
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
            <span className="sv-page-eyebrow">{t('supervisorIncidentCoordinationPage.eyebrow')}</span>
            <h1 className="sv-page-title">{t('supervisorIncidentCoordinationPage.title')}</h1>
            <p className="sv-page-subtitle">{t('supervisorIncidentCoordinationPage.subtitle')}</p>
          </div>
          <div className="sv-page-actions">
            <button className="sv-btn sv-btn-ghost sv-btn-refresh" onClick={load} disabled={loading}><RefreshRoundedIcon fontSize="inherit" /> {t('supervisorIncidentCoordinationPage.actions.refresh')}</button>
          </div>
        </div>

        {error && <div className="sv-error" style={{ marginBottom: 20 }}>{error}</div>}

        {/* Filters */}
        <div className="sv-filters-bar">
          <input
            className="sv-search-input"
            type="search"
            placeholder={t('supervisorIncidentCoordinationPage.filters.searchPlaceholder')}
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
                {s === 'all' ? t('supervisorIncidentCoordinationPage.filters.allStatuses') : statusLabel(s)}
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
                {s === 'all' ? t('supervisorIncidentCoordinationPage.filters.allSeverity') : severityLabel(s === 'high' ? 4 : s === 'medium' ? 3 : 1, t)}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="sv-loading"><div className="sv-loading-spinner" /><span>{t('supervisorIncidentCoordinationPage.loadingIncidents')}</span></div>
        ) : filteredIncidents.length === 0 ? (
          <div className="sv-section">
            <div className="sv-empty">
              <span className="sv-empty-icon"><AssignmentOutlinedIcon fontSize="inherit" /></span>
              {t('supervisorIncidentCoordinationPage.emptyState')}
            </div>
          </div>
        ) : (
          <div className="sv-section">
            <div className="sv-section-head">
              <h2 className="sv-section-title">
                {t('supervisorIncidentCoordinationPage.activeIncidents')}
                <span className="sv-badge sv-badge-primary" style={{ marginLeft: 8 }}>
                  {filteredIncidents.length}
                </span>
              </h2>
            </div>
            <div className="sv-table-wrap">
              <table className="sv-table">
                <thead>
                  <tr>
                    <th>{t('supervisorIncidentCoordinationPage.table.incident')}</th>
                    <th>{t('supervisorIncidentCoordinationPage.table.location')}</th>
                    <th>{t('supervisorIncidentCoordinationPage.table.severity')}</th>
                    <th>{t('supervisorIncidentCoordinationPage.table.status')}</th>
                    <th>{t('supervisorIncidentCoordinationPage.table.assignedTo')}</th>
                    <th>{t('supervisorIncidentCoordinationPage.table.reported')}</th>
                    <th>{t('supervisorIncidentCoordinationPage.table.assignOfficer')}</th>
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
                            {severityLabel(inc.severityHint, t)}
                          </span>
                        </td>
                        <td>
                          <span className="sv-badge sv-badge-neutral">
                            {statusLabel(inc.status)}
                          </span>
                        </td>
                        <td style={{ fontSize: 12 }}>
                          {inc.assignedOfficer?.name || (
                            <span style={{ color: 'var(--sv-text-muted)', fontStyle: 'italic' }}>{t('supervisorIncidentCoordinationPage.table.unassigned')}</span>
                          )}
                        </td>
                        <td style={{ fontSize: 11, color: 'var(--sv-text-muted)' }}>
                          {formatRelative(inc.occurredAt || inc.createdAt, t)}
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
                                    {t('common:actions.loading')}
                                  </span>
                                )
                              }
                              if (list.length === 0) {
                                return (
                                  <span style={{ fontSize: 11, color: 'var(--sv-text-muted)' }}>
                                    {t('supervisorIncidentCoordinationPage.officer.noneInCommune')}
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
                                    { value: '', label: t('supervisorIncidentCoordinationPage.officer.selectPlaceholder') },
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
                              {assigning[inc.id] ? '...' : t('supervisorIncidentCoordinationPage.actions.assign')}
                            </button>
                          </div>
                        </td>
                        <td>
                          <button
                            className="sv-btn sv-btn-ghost"
                            style={{ fontSize: 11, padding: '4px 10px' }}
                            onClick={() => navigate(`/police/incident/${inc.id}`)}
                          >
                            {t('supervisorIncidentCoordinationPage.actions.view')}
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

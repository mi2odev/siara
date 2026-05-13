import React, { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded'
import LocalPoliceOutlinedIcon from '@mui/icons-material/LocalPoliceOutlined'
import LocationOnOutlinedIcon from '@mui/icons-material/LocationOnOutlined'
import AccessTimeOutlinedIcon from '@mui/icons-material/AccessTimeOutlined'

import PoliceShell from '../../components/layout/PoliceShell'
import { listSupervisorOfficers } from '../../services/policeService'
import '../../styles/SupervisorMode.css'

function formatRelative(value) {
  if (!value) return 'Never'
  const diff = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 60000))
  if (diff < 1) return 'Just now'
  if (diff < 60) return `${diff}m ago`
  const h = Math.floor(diff / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

function getInitials(name) {
  return String(name || 'O')
    .split(' ')
    .map((part) => part[0] || '')
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

function OfficerDetailPanel({ officer, onClose }) {
  if (!officer) return null

  return (
    <div className="sv-modal-backdrop" onClick={onClose}>
      <div className="sv-modal" onClick={(e) => e.stopPropagation()}>
        <div className="sv-modal-head">
          <h3 className="sv-modal-title">Officer Profile</h3>
          <button className="sv-modal-close" onClick={onClose} aria-label="Close">×</button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
          <div className="sv-officer-avatar" style={{ width: 60, height: 60, fontSize: 22 }}>
            {officer.avatarUrl
              ? <img src={officer.avatarUrl} alt={officer.name} />
              : getInitials(officer.name)}
          </div>
          <div>
            <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--sv-text)' }}>{officer.name}</div>
            {officer.rank && (
              <div style={{ fontSize: 13, color: 'var(--sv-text-muted)' }}>{officer.rank}</div>
            )}
            {officer.badgeNumber && (
              <div style={{ fontSize: 12, color: 'var(--sv-text-muted)' }}>Badge #{officer.badgeNumber}</div>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--sv-border)' }}>
            <span style={{ fontSize: 13, color: 'var(--sv-text-muted)' }}>Status</span>
            <span className={`sv-badge ${officer.isOnDuty ? 'sv-badge-low' : 'sv-badge-neutral'}`}>
              {officer.isOnDuty ? 'On Duty' : 'Off Duty'}
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--sv-border)' }}>
            <span style={{ fontSize: 13, color: 'var(--sv-text-muted)' }}>Work Zone</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--sv-text)' }}>
              {[officer.workZone?.commune?.name, officer.workZone?.wilaya?.name].filter(Boolean).join(', ') || 'No zone set'}
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--sv-border)' }}>
            <span style={{ fontSize: 13, color: 'var(--sv-text-muted)' }}>Last Location</span>
            <span style={{ fontSize: 13, color: 'var(--sv-text)' }}>
              {officer.latestLocation
                ? formatRelative(officer.latestLocation.capturedAt)
                : 'Unknown'}
            </span>
          </div>
          {officer.email && (
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0' }}>
              <span style={{ fontSize: 13, color: 'var(--sv-text-muted)' }}>Contact</span>
              <span style={{ fontSize: 13, color: 'var(--sv-text)' }}>{officer.email}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function SupervisorOfficerMonitoringPage() {
  const navigate = useNavigate()

  const [officers, setOfficers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [selectedOfficer, setSelectedOfficer] = useState(null)
  const [scopeCommuneName, setScopeCommuneName] = useState(null)

  const load = useCallback(async () => {
    try {
      const result = await listSupervisorOfficers()
      setOfficers(result.items || [])
      const firstCommune = (result.items || []).find((o) => o.workZone?.commune?.name)?.workZone
        ?.commune?.name
      setScopeCommuneName(firstCommune || null)
      setError(null)
    } catch (err) {
      setError(err.message || 'Failed to load officer list')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const filtered = officers.filter((off) => {
    if (statusFilter === 'on-duty' && !off.isOnDuty) return false
    if (statusFilter === 'off-duty' && off.isOnDuty) return false
    if (search) {
      const q = search.toLowerCase()
      const haystack = [off.name, off.badgeNumber, off.email, off.rank].filter(Boolean).join(' ').toLowerCase()
      if (!haystack.includes(q)) return false
    }
    return true
  })

  const onDutyCount = officers.filter((o) => o.isOnDuty).length
  const offDutyCount = officers.filter((o) => !o.isOnDuty).length

  return (
    <PoliceShell activeKey="officer-monitoring" rightPanelCollapsed>
      <div className="supervisor-page">
        <div className="sv-page-header">
          <div className="sv-page-title-block">
            <span className="sv-page-eyebrow">Supervisor — Monitoring</span>
            <h1 className="sv-page-title">Officer Monitoring</h1>
            <p className="sv-page-subtitle">
              {scopeCommuneName
                ? `Showing officers in your assigned commune${scopeCommuneName ? ` — ${scopeCommuneName}` : ''}`
                : 'Track officer availability, workload, and operational status'}
            </p>
          </div>
          <div className="sv-page-actions">
            <button className="sv-btn sv-btn-ghost" onClick={load} disabled={loading}><RefreshRoundedIcon fontSize="inherit" /> Refresh</button>
          </div>
        </div>

        {error && <div className="sv-error" style={{ marginBottom: 20 }}>{error}</div>}

        {/* Summary KPIs */}
        <div className="sv-kpi-bar" style={{ gridTemplateColumns: 'repeat(3, 1fr)', marginBottom: 24 }}>
          <div className="sv-kpi-card kpi-primary">
            <div className="sv-kpi-label">Total Officers</div>
            <div className="sv-kpi-value">{officers.length}</div>
          </div>
          <div className="sv-kpi-card kpi-good">
            <div className="sv-kpi-label">On Duty</div>
            <div className="sv-kpi-value">{onDutyCount}</div>
          </div>
          <div className="sv-kpi-card kpi-warning">
            <div className="sv-kpi-label">Off Duty</div>
            <div className="sv-kpi-value">{offDutyCount}</div>
          </div>
        </div>

        {/* Filters */}
        <div className="sv-filters-bar">
          <input
            className="sv-search-input"
            type="search"
            placeholder="Search officer name, badge, email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {['all', 'on-duty', 'off-duty'].map((f) => (
            <button
              key={f}
              className={`sv-filter-btn ${statusFilter === f ? 'active' : ''}`}
              onClick={() => setStatusFilter(f)}
            >
              {f === 'all' ? 'All Officers' : f === 'on-duty' ? 'On Duty' : 'Off Duty'}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="sv-loading"><div className="sv-loading-spinner" /><span>Loading officers...</span></div>
        ) : filtered.length === 0 ? (
          <div className="sv-section">
            <div className="sv-empty">
              <span className="sv-empty-icon"><LocalPoliceOutlinedIcon fontSize="inherit" /></span>
              No officers match the current filters
            </div>
          </div>
        ) : (
          <div className="sv-officer-grid">
            {filtered.map((off) => (
              <div
                key={off.id}
                className="sv-officer-card"
                onClick={() => setSelectedOfficer(off)}
                role="button"
                tabIndex={0}
              >
                <div className="sv-officer-card-top">
                  <div className="sv-officer-avatar">
                    {off.avatarUrl
                      ? <img src={off.avatarUrl} alt={off.name} />
                      : getInitials(off.name)}
                  </div>
                  <div className="sv-officer-info">
                    <div className="sv-officer-name">{off.name}</div>
                    <div className="sv-officer-sub">
                      {off.rank && `${off.rank} · `}
                      {off.badgeNumber ? `#${off.badgeNumber}` : 'No badge'}
                    </div>
                  </div>
                </div>

                <div className="sv-officer-status-row">
                  <div className={`sv-status-dot ${off.isOnDuty ? 'on-duty' : 'off-duty'}`} />
                  <span className={`sv-badge ${off.isOnDuty ? 'sv-badge-low' : 'sv-badge-neutral'}`}
                    style={{ fontSize: 11 }}>
                    {off.isOnDuty ? 'On Duty' : 'Off Duty'}
                  </span>
                </div>

                <div style={{ fontSize: 12, color: 'var(--sv-text-muted)', display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <LocationOnOutlinedIcon fontSize="inherit" /> {[off.workZone?.commune?.name, off.workZone?.wilaya?.name].filter(Boolean).join(', ') || 'No zone'}
                  </div>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <AccessTimeOutlinedIcon fontSize="inherit" /> Last seen: {off.latestLocation ? formatRelative(off.latestLocation.capturedAt) : 'Unknown'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {selectedOfficer && (
          <OfficerDetailPanel
            officer={selectedOfficer}
            onClose={() => setSelectedOfficer(null)}
          />
        )}
      </div>
    </PoliceShell>
  )
}

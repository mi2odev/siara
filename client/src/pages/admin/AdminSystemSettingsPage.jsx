/**
 * @file AdminSystemSettingsPage.jsx
 * @description System-wide settings panel for the SIARA admin area.
 *
 * Each of the four tabs (severity, notifications, geofencing, general) is
 * fully data-driven against GET/PATCH /api/admin/system-settings. Defaults
 * live on the backend and are merged on top of any persisted overrides so the
 * page always renders something sensible on a fresh database.
 */
import React, { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import AddRoundedIcon from '@mui/icons-material/AddRounded'
import FancySelect from '../../components/ui/FancySelect'
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded'
import RestartAltRoundedIcon from '@mui/icons-material/RestartAltRounded'
import GavelOutlinedIcon from '@mui/icons-material/GavelOutlined'
import NotificationsActiveOutlinedIcon from '@mui/icons-material/NotificationsActiveOutlined'
import SmsOutlinedIcon from '@mui/icons-material/SmsOutlined'
import EmailOutlinedIcon from '@mui/icons-material/EmailOutlined'
import LayersOutlinedIcon from '@mui/icons-material/LayersOutlined'
import HubOutlinedIcon from '@mui/icons-material/HubOutlined'
import RadarOutlinedIcon from '@mui/icons-material/RadarOutlined'
import TuneOutlinedIcon from '@mui/icons-material/TuneOutlined'
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded'
import ErrorOutlineRoundedIcon from '@mui/icons-material/ErrorOutlineRounded'
import PowerSettingsNewRoundedIcon from '@mui/icons-material/PowerSettingsNewRounded'
import BuildOutlinedIcon from '@mui/icons-material/BuildOutlined'

import {
  fetchAdminSystemSettings,
  resetAdminSystemSettings,
  saveAdminSystemSettings,
} from '../../services/adminSystemSettingsService'

const TABS = [
  { key: 'severity',      label: 'Severity Rules' },
  { key: 'notifications', label: 'Notification Logic' },
  { key: 'geofencing',    label: 'Geo-fencing' },
  { key: 'general',       label: 'General' },
]

const SEVERITY_OPTIONS = [
  { value: 'low',    label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high',   label: 'High' },
]

const ARCHIVE_OPTIONS = [
  { value: 30,  label: '30 days' },
  { value: 60,  label: '60 days' },
  { value: 90,  label: '90 days' },
  { value: 365, label: '1 year' },
  { value: 0,   label: 'Never' },
]

const RETENTION_OPTIONS = [
  { value: '1y',         label: '1 year' },
  { value: '2y',         label: '2 years' },
  { value: '5y',         label: '5 years' },
  { value: 'indefinite', label: 'Indefinite' },
]

const ALLOWED_EVENT_TAGS = ['collision', 'roadwork', 'weather', 'hazard', 'traffic']

const CHANNEL_ICON = {
  push:    { Icon: NotificationsActiveOutlinedIcon, kind: 'push' },
  sms:     { Icon: SmsOutlinedIcon,                 kind: 'sms' },
  in_app:  { Icon: LayersOutlinedIcon,              kind: 'in_app' },
  email:   { Icon: EmailOutlinedIcon,               kind: 'email' },
  webhook: { Icon: HubOutlinedIcon,                 kind: 'webhook' },
}

function arraysEqual(a, b) {
  return JSON.stringify(a) === JSON.stringify(b)
}

function nextId(rules) {
  const max = rules.reduce((m, r) => Math.max(m, Number(r.id) || 0), 0)
  return max + 1
}

/** Animated on/off pill — replaces bare checkboxes throughout the page. */
function ToggleSwitch({ checked, onChange, disabled, ariaLabel }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={() => onChange?.(!checked)}
      className={`admin-toggle ${checked ? 'active' : ''}`}
      style={disabled ? { opacity: 0.5, cursor: 'not-allowed' } : undefined}
    >
      <span className="admin-toggle-thumb" />
    </button>
  )
}

/** Numeric input with a static unit chip on the right (%, km, MB, req/min). */
function SuffixNumberInput({ value, onChange, unit, min, max, step = 1, disabled, style }) {
  return (
    <span className="admin-suffix-input" style={style}>
      <input
        type="number"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange?.(Number(event.target.value))}
        disabled={disabled}
      />
      <span className="admin-suffix-input-unit">{unit}</span>
    </span>
  )
}

export default function AdminSystemSettingsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const currentTab = TABS.some((t) => t.key === searchParams.get('tab'))
    ? searchParams.get('tab')
    : 'severity'

  /** Server-confirmed snapshot — used to detect "dirty" state per tab. */
  const [server, setServer] = useState(null)
  /** Local drafts — what the form fields currently show. */
  const [draft, setDraft] = useState(null)
  const [loading, setLoading] = useState(true)
  const [savingTab, setSavingTab] = useState(null)
  const [error, setError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

  const loadSettings = async () => {
    setLoading(true)
    setError('')
    try {
      const payload = await fetchAdminSystemSettings()
      setServer(payload)
      setDraft(payload)
    } catch (err) {
      setError(err?.message || 'Failed to load settings')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadSettings() }, [])

  const setTab = (key) => {
    const next = new URLSearchParams(searchParams)
    next.set('tab', key)
    setSearchParams(next)
  }

  const showSuccess = (message) => {
    setSuccessMessage(message)
    setTimeout(() => setSuccessMessage(''), 2500)
  }

  const handleSave = async (updates, tabKey) => {
    setSavingTab(tabKey)
    setError('')
    try {
      const updated = await saveAdminSystemSettings(updates)
      setServer(updated)
      setDraft(updated)
      showSuccess('Settings saved.')
    } catch (err) {
      setError(err?.message || 'Failed to save settings')
    } finally {
      setSavingTab(null)
    }
  }

  const handleResetAll = async () => {
    if (!window.confirm('Reset every system setting to its default? Stored overrides will be lost.')) return
    setSavingTab('reset')
    setError('')
    try {
      const updated = await resetAdminSystemSettings()
      setServer(updated)
      setDraft(updated)
      showSuccess('Settings reset to defaults.')
    } catch (err) {
      setError(err?.message || 'Failed to reset settings')
    } finally {
      setSavingTab(null)
    }
  }

  /* ─────────────────────────────────────────────────────────────
     Severity Rules
     ───────────────────────────────────────────────────────────── */
  const severityDraft = draft?.severity?.rules || []
  const severityServer = server?.severity?.rules || []
  const severityDirty = !arraysEqual(severityDraft, severityServer)
  const severityActive = severityDraft.filter((r) => r.enabled).length

  const updateSeverityRow = (id, patch) => {
    setDraft((prev) => ({
      ...prev,
      severity: {
        ...prev.severity,
        rules: prev.severity.rules.map((rule) => (rule.id === id ? { ...rule, ...patch } : rule)),
      },
    }))
  }
  const removeSeverityRow = (id) => {
    setDraft((prev) => ({
      ...prev,
      severity: {
        ...prev.severity,
        rules: prev.severity.rules.filter((rule) => rule.id !== id),
      },
    }))
  }
  const addSeverityRow = () => {
    setDraft((prev) => ({
      ...prev,
      severity: {
        ...prev.severity,
        rules: [
          ...prev.severity.rules,
          { id: nextId(prev.severity.rules), name: 'New rule', autoSeverity: 'medium', minConfidence: 60, enabled: true },
        ],
      },
    }))
  }
  const saveSeverity = () => handleSave([{ key: 'severity.rules', value: severityDraft }], 'severity')

  /* ─────────────────────────────────────────────────────────────
     Notification Channels
     ───────────────────────────────────────────────────────────── */
  const channelsDraft = draft?.notifications?.channels || []
  const channelsServer = server?.notifications?.channels || []
  const channelsDirty = !arraysEqual(channelsDraft, channelsServer)
  const channelsEnabled = channelsDraft.filter((c) => c.enabled).length

  const updateChannel = (id, patch) => {
    setDraft((prev) => ({
      ...prev,
      notifications: {
        ...prev.notifications,
        channels: prev.notifications.channels.map((ch) => (ch.id === id ? { ...ch, ...patch } : ch)),
      },
    }))
  }
  const saveNotifications = () => handleSave([{ key: 'notifications.channels', value: channelsDraft }], 'notifications')

  /* ─────────────────────────────────────────────────────────────
     Geo-fencing
     ───────────────────────────────────────────────────────────── */
  const geofenceDraft = draft?.geofencing?.rules || []
  const geofenceServer = server?.geofencing?.rules || []
  const geofenceDirty = !arraysEqual(geofenceDraft, geofenceServer)
  const geofenceActive = geofenceDraft.filter((g) => g.active).length

  const updateGeofence = (id, patch) => {
    setDraft((prev) => ({
      ...prev,
      geofencing: {
        ...prev.geofencing,
        rules: prev.geofencing.rules.map((rule) => (rule.id === id ? { ...rule, ...patch } : rule)),
      },
    }))
  }
  const removeGeofence = (id) => {
    setDraft((prev) => ({
      ...prev,
      geofencing: {
        ...prev.geofencing,
        rules: prev.geofencing.rules.filter((rule) => rule.id !== id),
      },
    }))
  }
  const addGeofence = () => {
    setDraft((prev) => ({
      ...prev,
      geofencing: {
        ...prev.geofencing,
        rules: [
          ...prev.geofencing.rules,
          { id: nextId(prev.geofencing.rules), name: 'New zone', lat: 36.75, lng: 3.05, radiusKm: 5, events: ['collision'], active: true },
        ],
      },
    }))
  }
  const toggleGeofenceEvent = (id, eventTag) => {
    setDraft((prev) => ({
      ...prev,
      geofencing: {
        ...prev.geofencing,
        rules: prev.geofencing.rules.map((rule) => {
          if (rule.id !== id) return rule
          const has = rule.events.includes(eventTag)
          return { ...rule, events: has ? rule.events.filter((e) => e !== eventTag) : [...rule.events, eventTag] }
        }),
      },
    }))
  }
  const saveGeofencing = () => handleSave([{ key: 'geofence.rules', value: geofenceDraft }], 'geofencing')

  /* ─────────────────────────────────────────────────────────────
     General
     ───────────────────────────────────────────────────────────── */
  const generalDraft = draft?.general || {}
  const generalServer = server?.general || {}
  const generalDirty = JSON.stringify(generalDraft) !== JSON.stringify(generalServer)

  const updateGeneral = (patch) => {
    setDraft((prev) => ({ ...prev, general: { ...prev.general, ...patch } }))
  }
  const saveGeneral = () => handleSave([
    { key: 'general.auto_approve',           value: generalDraft.autoApprove },
    { key: 'general.maintenance_mode',       value: generalDraft.maintenanceMode },
    { key: 'general.incident_archive_days',  value: generalDraft.incidentArchiveDays },
    { key: 'general.audit_log_retention',    value: generalDraft.auditLogRetention },
    { key: 'general.api_rate_limit_per_min', value: generalDraft.apiRateLimitPerMin },
    { key: 'general.max_upload_mb',          value: generalDraft.maxUploadMb },
  ], 'general')

  /** Per-tab dirty flags for the orange dot in the tab strip. */
  const dirtyByTab = {
    severity: severityDirty,
    notifications: channelsDirty,
    geofencing: geofenceDirty,
    general: generalDirty,
  }

  const lastUpdatedLabel = useMemo(() => {
    if (!server?.updatedAt) return 'Never edited'
    try {
      return `Last edited ${new Date(server.updatedAt).toLocaleString()}`
    } catch {
      return ''
    }
  }, [server?.updatedAt])

  return (
    <>
      <div className="admin-page-header">
        <div>
          <h1 className="admin-page-title">System Settings</h1>
          <p className="admin-page-subtitle">
            Configure severity rules, notifications, geo-fencing and system behavior · {lastUpdatedLabel}
          </p>
        </div>
        <button
          className="admin-btn admin-btn-ghost"
          onClick={handleResetAll}
          disabled={loading || savingTab === 'reset'}
          style={{ color: 'var(--admin-danger)' }}
        >
          <RestartAltRoundedIcon fontSize="inherit" /> {savingTab === 'reset' ? 'Resetting…' : 'Reset to Defaults'}
        </button>
      </div>

      <div className="admin-tabs" style={{ marginBottom: 14 }}>
        {TABS.map((t) => (
          <button
            key={t.key}
            className={`admin-tab ${currentTab === t.key ? 'active' : ''}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
            {dirtyByTab[t.key] && <span className="admin-tab-dirty-dot" aria-label="unsaved changes" />}
          </button>
        ))}
      </div>

      {error && (
        <div className="admin-toast error" role="alert">
          <ErrorOutlineRoundedIcon fontSize="inherit" /> {error}
        </div>
      )}
      {successMessage && (
        <div className="admin-toast success" role="status">
          <CheckCircleRoundedIcon fontSize="inherit" /> {successMessage}
        </div>
      )}

      {loading && !draft && (
        <div className="admin-card">Loading settings…</div>
      )}

      {/* ═══ TAB: SEVERITY RULES ═══ */}
      {currentTab === 'severity' && draft && (
        <>
          <div className="admin-settings-hero">
            <div className="admin-settings-hero-chip">
              <div className="admin-settings-hero-chip-icon"><GavelOutlinedIcon fontSize="inherit" /></div>
              <div className="admin-settings-hero-chip-body">
                <span className="admin-settings-hero-chip-label">Total rules</span>
                <span className="admin-settings-hero-chip-value">{severityDraft.length}</span>
              </div>
            </div>
            <div className="admin-settings-hero-chip">
              <div className="admin-settings-hero-chip-icon" style={{ background: 'var(--admin-success-subtle)', color: 'var(--admin-success)' }}>
                <CheckCircleRoundedIcon fontSize="inherit" />
              </div>
              <div className="admin-settings-hero-chip-body">
                <span className="admin-settings-hero-chip-label">Enabled</span>
                <span className="admin-settings-hero-chip-value">{severityActive}</span>
              </div>
            </div>
            <div className="admin-settings-hero-chip">
              <div className="admin-settings-hero-chip-icon" style={{ background: 'var(--admin-warning-subtle)', color: 'var(--admin-warning)' }}>
                <ErrorOutlineRoundedIcon fontSize="inherit" />
              </div>
              <div className="admin-settings-hero-chip-body">
                <span className="admin-settings-hero-chip-label">Disabled</span>
                <span className="admin-settings-hero-chip-value">{severityDraft.length - severityActive}</span>
              </div>
            </div>
          </div>

          <div className="admin-card">
            <div className="admin-card-header">
              <div>
                <h3 className="admin-card-title">Auto-Classification Severity Rules</h3>
                <p className="admin-card-subtitle">When the AI's confidence in the matched rule clears its threshold, the report is auto-assigned the chosen severity.</p>
              </div>
              <button className="admin-btn admin-btn-primary admin-btn-sm" onClick={addSeverityRow}>
                <AddRoundedIcon fontSize="inherit" /> Add Rule
              </button>
            </div>
            <div className="admin-table-wrapper" style={{ marginTop: 4 }}>
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Rule Name</th>
                    <th>Auto Severity</th>
                    <th>Min. Confidence</th>
                    <th>Enabled</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {severityDraft.map((rule) => (
                    <tr key={rule.id}>
                      <td>
                        <input
                          className="admin-input"
                          type="text"
                          value={rule.name}
                          onChange={(e) => updateSeverityRow(rule.id, { name: e.target.value })}
                          style={{ height: 30, fontSize: 12, width: '100%', minWidth: 200 }}
                        />
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <FancySelect
                            value={rule.autoSeverity}
                            onChange={(value) => updateSeverityRow(rule.id, { autoSeverity: value })}
                            options={SEVERITY_OPTIONS}
                            size="sm"
                            menuAlign="left"
                          />
                          <span className={`admin-pill ${rule.autoSeverity}`}>{rule.autoSeverity}</span>
                        </div>
                      </td>
                      <td>
                        <SuffixNumberInput
                          value={rule.minConfidence}
                          onChange={(v) => updateSeverityRow(rule.id, { minConfidence: v })}
                          unit="%"
                          min={0}
                          max={100}
                          style={{ width: 110 }}
                        />
                      </td>
                      <td>
                        <ToggleSwitch
                          checked={rule.enabled}
                          onChange={(checked) => updateSeverityRow(rule.id, { enabled: checked })}
                          ariaLabel={`Toggle ${rule.name}`}
                        />
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button
                          className="admin-btn admin-btn-sm admin-btn-danger"
                          onClick={() => removeSeverityRow(rule.id)}
                          aria-label="Delete rule"
                        >
                          <DeleteOutlineRoundedIcon fontSize="inherit" />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {severityDraft.length === 0 && (
                    <tr>
                      <td colSpan={5} style={{ textAlign: 'center', padding: 24, color: 'var(--admin-text-muted)' }}>
                        No rules defined. Click <strong>Add Rule</strong> to create one.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="admin-settings-actions">
              {severityDirty && <span className="dirty-hint">Unsaved changes</span>}
              <button
                className="admin-btn admin-btn-ghost admin-btn-sm"
                onClick={() => setDraft({ ...draft, severity: { ...draft.severity, rules: severityServer } })}
                disabled={!severityDirty || savingTab === 'severity'}
              >
                Discard
              </button>
              <button
                className="admin-btn admin-btn-primary admin-btn-sm"
                onClick={saveSeverity}
                disabled={!severityDirty || savingTab === 'severity'}
              >
                {savingTab === 'severity' ? 'Saving…' : 'Save Severity Rules'}
              </button>
            </div>
          </div>
        </>
      )}

      {/* ═══ TAB: NOTIFICATION LOGIC ═══ */}
      {currentTab === 'notifications' && draft && (
        <>
          <div className="admin-settings-hero">
            <div className="admin-settings-hero-chip">
              <div className="admin-settings-hero-chip-icon"><NotificationsActiveOutlinedIcon fontSize="inherit" /></div>
              <div className="admin-settings-hero-chip-body">
                <span className="admin-settings-hero-chip-label">Channels</span>
                <span className="admin-settings-hero-chip-value">{channelsDraft.length}</span>
              </div>
            </div>
            <div className="admin-settings-hero-chip">
              <div className="admin-settings-hero-chip-icon" style={{ background: 'var(--admin-success-subtle)', color: 'var(--admin-success)' }}>
                <CheckCircleRoundedIcon fontSize="inherit" />
              </div>
              <div className="admin-settings-hero-chip-body">
                <span className="admin-settings-hero-chip-label">Active</span>
                <span className="admin-settings-hero-chip-value">{channelsEnabled}</span>
              </div>
            </div>
          </div>

          <div className="admin-card">
            <div className="admin-card-header">
              <div>
                <h3 className="admin-card-title">Notification Channels</h3>
                <p className="admin-card-subtitle">Configure how alerts reach end users. The minimum severity filter applies per channel.</p>
              </div>
            </div>
            <div style={{ marginTop: 4 }}>
              {channelsDraft.map((ch) => {
                const meta = CHANNEL_ICON[ch.id] || CHANNEL_ICON.in_app
                const Icon = meta.Icon
                return (
                  <div key={ch.id} className="admin-channel-row">
                    <div className={`admin-channel-icon ${meta.kind}`}>
                      <Icon fontSize="inherit" />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--admin-text)' }}>{ch.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--admin-text-muted)', marginTop: 2 }}>{ch.description}</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 10, color: 'var(--admin-text-muted)' }}>Min. severity</span>
                      <FancySelect
                        value={ch.minSeverity}
                        onChange={(value) => updateChannel(ch.id, { minSeverity: value })}
                        options={SEVERITY_OPTIONS}
                        disabled={!ch.enabled}
                        size="sm"
                      />
                      <ToggleSwitch
                        checked={ch.enabled}
                        onChange={(checked) => updateChannel(ch.id, { enabled: checked })}
                        ariaLabel={`Toggle ${ch.name}`}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
            <div className="admin-settings-actions">
              {channelsDirty && <span className="dirty-hint">Unsaved changes</span>}
              <button
                className="admin-btn admin-btn-ghost admin-btn-sm"
                onClick={() => setDraft({ ...draft, notifications: { ...draft.notifications, channels: channelsServer } })}
                disabled={!channelsDirty || savingTab === 'notifications'}
              >
                Discard
              </button>
              <button
                className="admin-btn admin-btn-primary admin-btn-sm"
                onClick={saveNotifications}
                disabled={!channelsDirty || savingTab === 'notifications'}
              >
                {savingTab === 'notifications' ? 'Saving…' : 'Save Notification Settings'}
              </button>
            </div>
          </div>
        </>
      )}

      {/* ═══ TAB: GEO-FENCING ═══ */}
      {currentTab === 'geofencing' && draft && (
        <>
          <div className="admin-settings-hero">
            <div className="admin-settings-hero-chip">
              <div className="admin-settings-hero-chip-icon"><RadarOutlinedIcon fontSize="inherit" /></div>
              <div className="admin-settings-hero-chip-body">
                <span className="admin-settings-hero-chip-label">Total zones</span>
                <span className="admin-settings-hero-chip-value">{geofenceDraft.length}</span>
              </div>
            </div>
            <div className="admin-settings-hero-chip">
              <div className="admin-settings-hero-chip-icon" style={{ background: 'var(--admin-success-subtle)', color: 'var(--admin-success)' }}>
                <CheckCircleRoundedIcon fontSize="inherit" />
              </div>
              <div className="admin-settings-hero-chip-body">
                <span className="admin-settings-hero-chip-label">Active</span>
                <span className="admin-settings-hero-chip-value">{geofenceActive}</span>
              </div>
            </div>
            <div className="admin-settings-hero-chip">
              <div className="admin-settings-hero-chip-icon" style={{ background: 'rgba(59, 130, 246, 0.10)', color: '#2563EB' }}>
                <LayersOutlinedIcon fontSize="inherit" />
              </div>
              <div className="admin-settings-hero-chip-body">
                <span className="admin-settings-hero-chip-label">Total coverage</span>
                <span className="admin-settings-hero-chip-value">
                  {geofenceDraft.filter((g) => g.active).reduce((sum, g) => sum + (Number(g.radiusKm) || 0), 0)} km
                </span>
              </div>
            </div>
          </div>

          <div className="admin-card">
            <div className="admin-card-header">
              <div>
                <h3 className="admin-card-title">Geo-fence Rules</h3>
                <p className="admin-card-subtitle">Define circular boundaries (center + radius) for targeted alert delivery. Clicks on event tags toggle them.</p>
              </div>
              <button className="admin-btn admin-btn-primary admin-btn-sm" onClick={addGeofence}>
                <AddRoundedIcon fontSize="inherit" /> Add Zone
              </button>
            </div>
            <div className="admin-table-wrapper" style={{ marginTop: 4 }}>
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Latitude</th>
                    <th>Longitude</th>
                    <th>Radius</th>
                    <th>Event Types</th>
                    <th>Active</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {geofenceDraft.map((rule) => (
                    <tr key={rule.id}>
                      <td>
                        <input
                          className="admin-input"
                          type="text"
                          value={rule.name}
                          onChange={(e) => updateGeofence(rule.id, { name: e.target.value })}
                          style={{ height: 30, fontSize: 12, minWidth: 160 }}
                        />
                      </td>
                      <td>
                        <input
                          className="admin-input"
                          type="number"
                          step="0.000001"
                          value={rule.lat}
                          onChange={(e) => updateGeofence(rule.id, { lat: Number(e.target.value) })}
                          style={{ width: 100, height: 30, fontSize: 11, fontVariantNumeric: 'tabular-nums' }}
                        />
                      </td>
                      <td>
                        <input
                          className="admin-input"
                          type="number"
                          step="0.000001"
                          value={rule.lng}
                          onChange={(e) => updateGeofence(rule.id, { lng: Number(e.target.value) })}
                          style={{ width: 100, height: 30, fontSize: 11, fontVariantNumeric: 'tabular-nums' }}
                        />
                      </td>
                      <td>
                        <SuffixNumberInput
                          value={rule.radiusKm}
                          onChange={(v) => updateGeofence(rule.id, { radiusKm: v })}
                          unit="km"
                          min={1}
                          max={500}
                          style={{ width: 110 }}
                        />
                      </td>
                      <td>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                          {ALLOWED_EVENT_TAGS.map((tag) => {
                            const checked = rule.events.includes(tag)
                            return (
                              <button
                                key={tag}
                                type="button"
                                onClick={() => toggleGeofenceEvent(rule.id, tag)}
                                style={{
                                  padding: '3px 9px',
                                  borderRadius: 999,
                                  fontSize: 10.5,
                                  fontWeight: 600,
                                  textTransform: 'capitalize',
                                  cursor: 'pointer',
                                  border: `1px solid ${checked ? 'var(--admin-primary)' : 'var(--admin-border)'}`,
                                  background: checked ? 'var(--admin-primary-subtle)' : 'var(--admin-surface-2)',
                                  color: checked ? 'var(--admin-primary)' : 'var(--admin-text-muted)',
                                  transition: 'all 120ms ease',
                                }}
                              >
                                {tag}
                              </button>
                            )
                          })}
                        </div>
                      </td>
                      <td>
                        <ToggleSwitch
                          checked={rule.active}
                          onChange={(checked) => updateGeofence(rule.id, { active: checked })}
                          ariaLabel={`Toggle zone ${rule.name}`}
                        />
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button
                          className="admin-btn admin-btn-sm admin-btn-danger"
                          onClick={() => removeGeofence(rule.id)}
                          aria-label="Delete zone"
                        >
                          <DeleteOutlineRoundedIcon fontSize="inherit" />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {geofenceDraft.length === 0 && (
                    <tr>
                      <td colSpan={7} style={{ textAlign: 'center', padding: 24, color: 'var(--admin-text-muted)' }}>
                        No geo-fence zones defined. Click <strong>Add Zone</strong> to create one.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="admin-settings-actions">
              {geofenceDirty && <span className="dirty-hint">Unsaved changes</span>}
              <button
                className="admin-btn admin-btn-ghost admin-btn-sm"
                onClick={() => setDraft({ ...draft, geofencing: { ...draft.geofencing, rules: geofenceServer } })}
                disabled={!geofenceDirty || savingTab === 'geofencing'}
              >
                Discard
              </button>
              <button
                className="admin-btn admin-btn-primary admin-btn-sm"
                onClick={saveGeofencing}
                disabled={!geofenceDirty || savingTab === 'geofencing'}
              >
                {savingTab === 'geofencing' ? 'Saving…' : 'Save Geo-fence Rules'}
              </button>
            </div>
          </div>
        </>
      )}

      {/* ═══ TAB: GENERAL ═══ */}
      {currentTab === 'general' && draft && (
        <>
          <div className="admin-settings-hero">
            <div className="admin-settings-hero-chip">
              <div
                className="admin-settings-hero-chip-icon"
                style={{
                  background: generalDraft.maintenanceMode ? 'var(--admin-danger-subtle)' : 'var(--admin-success-subtle)',
                  color:      generalDraft.maintenanceMode ? 'var(--admin-danger)'        : 'var(--admin-success)',
                }}
              >
                <PowerSettingsNewRoundedIcon fontSize="inherit" />
              </div>
              <div className="admin-settings-hero-chip-body">
                <span className="admin-settings-hero-chip-label">System status</span>
                <span className="admin-settings-hero-chip-value" style={{ fontSize: 14 }}>
                  {generalDraft.maintenanceMode ? 'Maintenance' : 'Operational'}
                </span>
              </div>
            </div>
            <div className="admin-settings-hero-chip">
              <div className="admin-settings-hero-chip-icon"><TuneOutlinedIcon fontSize="inherit" /></div>
              <div className="admin-settings-hero-chip-body">
                <span className="admin-settings-hero-chip-label">Auto-approve</span>
                <span className="admin-settings-hero-chip-value" style={{ fontSize: 14 }}>
                  {generalDraft.autoApprove ? 'On (≥ 95%)' : 'Off'}
                </span>
              </div>
            </div>
            <div className="admin-settings-hero-chip">
              <div className="admin-settings-hero-chip-icon"><BuildOutlinedIcon fontSize="inherit" /></div>
              <div className="admin-settings-hero-chip-body">
                <span className="admin-settings-hero-chip-label">API rate limit</span>
                <span className="admin-settings-hero-chip-value">{generalDraft.apiRateLimitPerMin}<span style={{ fontSize: 10, color: 'var(--admin-text-muted)', fontWeight: 500 }}> /min</span></span>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="admin-card">
              <div className="admin-card-header">
                <div>
                  <h3 className="admin-card-title">System Controls</h3>
                  <p className="admin-card-subtitle">Toggle platform-wide behavior. Maintenance mode disables every public-facing endpoint until you turn it back off.</p>
                </div>
              </div>
              <div style={{ marginTop: 4 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 0', borderBottom: '1px solid var(--admin-border)' }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>Auto-Approve High Confidence Reports</div>
                    <div style={{ fontSize: 11, color: 'var(--admin-text-muted)', marginTop: 2 }}>Automatically approve reports with AI confidence above 95%</div>
                  </div>
                  <ToggleSwitch
                    checked={Boolean(generalDraft.autoApprove)}
                    onChange={(checked) => updateGeneral({ autoApprove: checked })}
                    ariaLabel="Toggle auto-approve"
                  />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 0' }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>Maintenance Mode</div>
                    <div style={{ fontSize: 11, color: 'var(--admin-text-muted)', marginTop: 2 }}>Disable public-facing features for maintenance</div>
                  </div>
                  <ToggleSwitch
                    checked={Boolean(generalDraft.maintenanceMode)}
                    onChange={(checked) => updateGeneral({ maintenanceMode: checked })}
                    ariaLabel="Toggle maintenance mode"
                  />
                </div>
              </div>
            </div>

            <div className="admin-card">
              <div className="admin-card-header">
                <div>
                  <h3 className="admin-card-title">Data Retention</h3>
                  <p className="admin-card-subtitle">When records older than the threshold are archived or pruned.</p>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginTop: 4 }}>
                <div>
                  <label className="admin-form-label">Incident Archive After</label>
                  <FancySelect
                    value={String(generalDraft.incidentArchiveDays ?? 90)}
                    onChange={(value) => updateGeneral({ incidentArchiveDays: Number(value) })}
                    options={ARCHIVE_OPTIONS.map((opt) => ({ value: String(opt.value), label: opt.label }))}
                    menuAlign="left"
                  />
                </div>
                <div>
                  <label className="admin-form-label">Audit Log Retention</label>
                  <FancySelect
                    value={generalDraft.auditLogRetention || '2y'}
                    onChange={(value) => updateGeneral({ auditLogRetention: value })}
                    options={RETENTION_OPTIONS}
                    menuAlign="left"
                  />
                </div>
              </div>
            </div>

            <div className="admin-card">
              <div className="admin-card-header">
                <div>
                  <h3 className="admin-card-title">API Configuration</h3>
                  <p className="admin-card-subtitle">Server-side limits applied to every authenticated request.</p>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginTop: 4 }}>
                <div>
                  <label className="admin-form-label">Rate Limit</label>
                  <SuffixNumberInput
                    value={generalDraft.apiRateLimitPerMin ?? 100}
                    onChange={(v) => updateGeneral({ apiRateLimitPerMin: v })}
                    unit="req/min"
                    min={1}
                    max={100000}
                    style={{ width: '100%' }}
                  />
                </div>
                <div>
                  <label className="admin-form-label">Max Upload Size</label>
                  <SuffixNumberInput
                    value={generalDraft.maxUploadMb ?? 10}
                    onChange={(v) => updateGeneral({ maxUploadMb: v })}
                    unit="MB"
                    min={1}
                    max={1024}
                    style={{ width: '100%' }}
                  />
                </div>
              </div>
              <div className="admin-settings-actions">
                {generalDirty && <span className="dirty-hint">Unsaved changes</span>}
                <button
                  className="admin-btn admin-btn-ghost admin-btn-sm"
                  onClick={() => setDraft({ ...draft, general: generalServer })}
                  disabled={!generalDirty || savingTab === 'general'}
                >
                  Discard
                </button>
                <button
                  className="admin-btn admin-btn-primary admin-btn-sm"
                  onClick={saveGeneral}
                  disabled={!generalDirty || savingTab === 'general'}
                >
                  {savingTab === 'general' ? 'Saving…' : 'Save General Settings'}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  )
}

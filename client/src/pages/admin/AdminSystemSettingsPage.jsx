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
import { useTranslation } from 'react-i18next'
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
  const { t } = useTranslation(['admin', 'common'])

  const TABS = [
    { key: 'severity',      label: t('adminSystemSettingsPage.tabs.severity') },
    { key: 'notifications', label: t('adminSystemSettingsPage.tabs.notifications') },
    { key: 'geofencing',    label: t('adminSystemSettingsPage.tabs.geofencing') },
    { key: 'general',       label: t('adminSystemSettingsPage.tabs.general') },
  ]

  const SEVERITY_OPTIONS = [
    { value: 'low',    label: t('adminSystemSettingsPage.severity.low') },
    { value: 'medium', label: t('adminSystemSettingsPage.severity.medium') },
    { value: 'high',   label: t('adminSystemSettingsPage.severity.high') },
  ]

  const ARCHIVE_OPTIONS = [
    { value: 30,  label: t('adminSystemSettingsPage.archive.days', { count: 30 }) },
    { value: 60,  label: t('adminSystemSettingsPage.archive.days', { count: 60 }) },
    { value: 90,  label: t('adminSystemSettingsPage.archive.days', { count: 90 }) },
    { value: 365, label: t('adminSystemSettingsPage.archive.oneYear') },
    { value: 0,   label: t('adminSystemSettingsPage.archive.never') },
  ]

  const RETENTION_OPTIONS = [
    { value: '1y',         label: t('adminSystemSettingsPage.retention.oneYear') },
    { value: '2y',         label: t('adminSystemSettingsPage.retention.twoYears') },
    { value: '5y',         label: t('adminSystemSettingsPage.retention.fiveYears') },
    { value: 'indefinite', label: t('adminSystemSettingsPage.retention.indefinite') },
  ]

  const [searchParams, setSearchParams] = useSearchParams()
  const currentTab = TABS.some((tab) => tab.key === searchParams.get('tab'))
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
      setError(err?.message || t('adminSystemSettingsPage.errors.loadFailed'))
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
      showSuccess(t('adminSystemSettingsPage.messages.saved'))
    } catch (err) {
      setError(err?.message || t('adminSystemSettingsPage.errors.saveFailed'))
    } finally {
      setSavingTab(null)
    }
  }

  const handleResetAll = async () => {
    if (!window.confirm(t('adminSystemSettingsPage.confirmReset'))) return
    setSavingTab('reset')
    setError('')
    try {
      const updated = await resetAdminSystemSettings()
      setServer(updated)
      setDraft(updated)
      showSuccess(t('adminSystemSettingsPage.messages.reset'))
    } catch (err) {
      setError(err?.message || t('adminSystemSettingsPage.errors.resetFailed'))
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
          { id: nextId(prev.severity.rules), name: t('adminSystemSettingsPage.newRuleName'), autoSeverity: 'medium', minConfidence: 60, enabled: true },
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
          { id: nextId(prev.geofencing.rules), name: t('adminSystemSettingsPage.newZoneName'), lat: 36.75, lng: 3.05, radiusKm: 5, events: ['collision'], active: true },
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
    if (!server?.updatedAt) return t('adminSystemSettingsPage.neverEdited')
    try {
      return t('adminSystemSettingsPage.lastEdited', { date: new Date(server.updatedAt).toLocaleString() })
    } catch {
      return ''
    }
  }, [server?.updatedAt, t])

  return (
    <>
      <div className="admin-page-header">
        <div>
          <h1 className="admin-page-title">{t('adminSystemSettingsPage.title')}</h1>
          <p className="admin-page-subtitle">
            {t('adminSystemSettingsPage.subtitle')} · {lastUpdatedLabel}
          </p>
        </div>
        <button
          className="admin-btn admin-btn-ghost"
          onClick={handleResetAll}
          disabled={loading || savingTab === 'reset'}
          style={{ color: 'var(--admin-danger)' }}
        >
          <RestartAltRoundedIcon fontSize="inherit" /> {savingTab === 'reset' ? t('adminSystemSettingsPage.resetting') : t('adminSystemSettingsPage.resetToDefaults')}
        </button>
      </div>

      <div className="admin-tabs" style={{ marginBottom: 14 }}>
        {TABS.map((tab) => (
          <button
            key={tab.key}
            className={`admin-tab ${currentTab === tab.key ? 'active' : ''}`}
            onClick={() => setTab(tab.key)}
          >
            {tab.label}
            {dirtyByTab[tab.key] && <span className="admin-tab-dirty-dot" aria-label={t('adminSystemSettingsPage.unsavedChanges')} />}
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
        <div className="admin-card">{t('adminSystemSettingsPage.loadingSettings')}</div>
      )}

      {/* ═══ TAB: SEVERITY RULES ═══ */}
      {currentTab === 'severity' && draft && (
        <>
          <div className="admin-settings-hero">
            <div className="admin-settings-hero-chip">
              <div className="admin-settings-hero-chip-icon"><GavelOutlinedIcon fontSize="inherit" /></div>
              <div className="admin-settings-hero-chip-body">
                <span className="admin-settings-hero-chip-label">{t('adminSystemSettingsPage.chips.totalRules')}</span>
                <span className="admin-settings-hero-chip-value">{severityDraft.length}</span>
              </div>
            </div>
            <div className="admin-settings-hero-chip">
              <div className="admin-settings-hero-chip-icon" style={{ background: 'var(--admin-success-subtle)', color: 'var(--admin-success)' }}>
                <CheckCircleRoundedIcon fontSize="inherit" />
              </div>
              <div className="admin-settings-hero-chip-body">
                <span className="admin-settings-hero-chip-label">{t('adminSystemSettingsPage.chips.enabled')}</span>
                <span className="admin-settings-hero-chip-value">{severityActive}</span>
              </div>
            </div>
            <div className="admin-settings-hero-chip">
              <div className="admin-settings-hero-chip-icon" style={{ background: 'var(--admin-warning-subtle)', color: 'var(--admin-warning)' }}>
                <ErrorOutlineRoundedIcon fontSize="inherit" />
              </div>
              <div className="admin-settings-hero-chip-body">
                <span className="admin-settings-hero-chip-label">{t('adminSystemSettingsPage.chips.disabled')}</span>
                <span className="admin-settings-hero-chip-value">{severityDraft.length - severityActive}</span>
              </div>
            </div>
          </div>

          <div className="admin-card">
            <div className="admin-card-header">
              <div>
                <h3 className="admin-card-title">{t('adminSystemSettingsPage.severityRules.title')}</h3>
                <p className="admin-card-subtitle">{t('adminSystemSettingsPage.severityRules.subtitle')}</p>
              </div>
              <button className="admin-btn admin-btn-primary admin-btn-sm" onClick={addSeverityRow}>
                <AddRoundedIcon fontSize="inherit" /> {t('adminSystemSettingsPage.severityRules.addRule')}
              </button>
            </div>
            <div className="admin-table-wrapper" style={{ marginTop: 4 }}>
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>{t('adminSystemSettingsPage.severityRules.colRuleName')}</th>
                    <th>{t('adminSystemSettingsPage.severityRules.colAutoSeverity')}</th>
                    <th>{t('adminSystemSettingsPage.severityRules.colMinConfidence')}</th>
                    <th>{t('adminSystemSettingsPage.severityRules.colEnabled')}</th>
                    <th style={{ textAlign: 'right' }}>{t('adminSystemSettingsPage.colActions')}</th>
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
                          ariaLabel={t('adminSystemSettingsPage.ariaToggleRule', { name: rule.name })}
                        />
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button
                          className="admin-btn admin-btn-sm admin-btn-danger"
                          onClick={() => removeSeverityRow(rule.id)}
                          aria-label={t('adminSystemSettingsPage.ariaDeleteRule')}
                        >
                          <DeleteOutlineRoundedIcon fontSize="inherit" />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {severityDraft.length === 0 && (
                    <tr>
                      <td colSpan={5} style={{ textAlign: 'center', padding: 24, color: 'var(--admin-text-muted)' }}>
                        {t('adminSystemSettingsPage.severityRules.empty', { addLabel: t('adminSystemSettingsPage.severityRules.addRule') })}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="admin-settings-actions">
              {severityDirty && <span className="dirty-hint">{t('adminSystemSettingsPage.unsavedChangesHint')}</span>}
              <button
                className="admin-btn admin-btn-ghost admin-btn-sm"
                onClick={() => setDraft({ ...draft, severity: { ...draft.severity, rules: severityServer } })}
                disabled={!severityDirty || savingTab === 'severity'}
              >
                {t('adminSystemSettingsPage.discard')}
              </button>
              <button
                className="admin-btn admin-btn-primary admin-btn-sm"
                onClick={saveSeverity}
                disabled={!severityDirty || savingTab === 'severity'}
              >
                {savingTab === 'severity' ? t('adminSystemSettingsPage.saving') : t('adminSystemSettingsPage.severityRules.save')}
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
                <span className="admin-settings-hero-chip-label">{t('adminSystemSettingsPage.chips.channels')}</span>
                <span className="admin-settings-hero-chip-value">{channelsDraft.length}</span>
              </div>
            </div>
            <div className="admin-settings-hero-chip">
              <div className="admin-settings-hero-chip-icon" style={{ background: 'var(--admin-success-subtle)', color: 'var(--admin-success)' }}>
                <CheckCircleRoundedIcon fontSize="inherit" />
              </div>
              <div className="admin-settings-hero-chip-body">
                <span className="admin-settings-hero-chip-label">{t('adminSystemSettingsPage.chips.active')}</span>
                <span className="admin-settings-hero-chip-value">{channelsEnabled}</span>
              </div>
            </div>
          </div>

          <div className="admin-card">
            <div className="admin-card-header">
              <div>
                <h3 className="admin-card-title">{t('adminSystemSettingsPage.notificationChannels.title')}</h3>
                <p className="admin-card-subtitle">{t('adminSystemSettingsPage.notificationChannels.subtitle')}</p>
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
                      <span style={{ fontSize: 10, color: 'var(--admin-text-muted)' }}>{t('adminSystemSettingsPage.notificationChannels.minSeverity')}</span>
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
                        ariaLabel={t('adminSystemSettingsPage.ariaToggleChannel', { name: ch.name })}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
            <div className="admin-settings-actions">
              {channelsDirty && <span className="dirty-hint">{t('adminSystemSettingsPage.unsavedChangesHint')}</span>}
              <button
                className="admin-btn admin-btn-ghost admin-btn-sm"
                onClick={() => setDraft({ ...draft, notifications: { ...draft.notifications, channels: channelsServer } })}
                disabled={!channelsDirty || savingTab === 'notifications'}
              >
                {t('adminSystemSettingsPage.discard')}
              </button>
              <button
                className="admin-btn admin-btn-primary admin-btn-sm"
                onClick={saveNotifications}
                disabled={!channelsDirty || savingTab === 'notifications'}
              >
                {savingTab === 'notifications' ? t('adminSystemSettingsPage.saving') : t('adminSystemSettingsPage.notificationChannels.save')}
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
                <span className="admin-settings-hero-chip-label">{t('adminSystemSettingsPage.chips.totalZones')}</span>
                <span className="admin-settings-hero-chip-value">{geofenceDraft.length}</span>
              </div>
            </div>
            <div className="admin-settings-hero-chip">
              <div className="admin-settings-hero-chip-icon" style={{ background: 'var(--admin-success-subtle)', color: 'var(--admin-success)' }}>
                <CheckCircleRoundedIcon fontSize="inherit" />
              </div>
              <div className="admin-settings-hero-chip-body">
                <span className="admin-settings-hero-chip-label">{t('adminSystemSettingsPage.chips.active')}</span>
                <span className="admin-settings-hero-chip-value">{geofenceActive}</span>
              </div>
            </div>
            <div className="admin-settings-hero-chip">
              <div className="admin-settings-hero-chip-icon" style={{ background: 'rgba(59, 130, 246, 0.10)', color: '#2563EB' }}>
                <LayersOutlinedIcon fontSize="inherit" />
              </div>
              <div className="admin-settings-hero-chip-body">
                <span className="admin-settings-hero-chip-label">{t('adminSystemSettingsPage.chips.totalCoverage')}</span>
                <span className="admin-settings-hero-chip-value">
                  {geofenceDraft.filter((g) => g.active).reduce((sum, g) => sum + (Number(g.radiusKm) || 0), 0)} km
                </span>
              </div>
            </div>
          </div>

          <div className="admin-card">
            <div className="admin-card-header">
              <div>
                <h3 className="admin-card-title">{t('adminSystemSettingsPage.geofenceRules.title')}</h3>
                <p className="admin-card-subtitle">{t('adminSystemSettingsPage.geofenceRules.subtitle')}</p>
              </div>
              <button className="admin-btn admin-btn-primary admin-btn-sm" onClick={addGeofence}>
                <AddRoundedIcon fontSize="inherit" /> {t('adminSystemSettingsPage.geofenceRules.addZone')}
              </button>
            </div>
            <div className="admin-table-wrapper" style={{ marginTop: 4 }}>
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>{t('adminSystemSettingsPage.geofenceRules.colName')}</th>
                    <th>{t('adminSystemSettingsPage.geofenceRules.colLatitude')}</th>
                    <th>{t('adminSystemSettingsPage.geofenceRules.colLongitude')}</th>
                    <th>{t('adminSystemSettingsPage.geofenceRules.colRadius')}</th>
                    <th>{t('adminSystemSettingsPage.geofenceRules.colEventTypes')}</th>
                    <th>{t('adminSystemSettingsPage.geofenceRules.colActive')}</th>
                    <th style={{ textAlign: 'right' }}>{t('adminSystemSettingsPage.colActions')}</th>
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
                          ariaLabel={t('adminSystemSettingsPage.ariaToggleZone', { name: rule.name })}
                        />
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button
                          className="admin-btn admin-btn-sm admin-btn-danger"
                          onClick={() => removeGeofence(rule.id)}
                          aria-label={t('adminSystemSettingsPage.ariaDeleteZone')}
                        >
                          <DeleteOutlineRoundedIcon fontSize="inherit" />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {geofenceDraft.length === 0 && (
                    <tr>
                      <td colSpan={7} style={{ textAlign: 'center', padding: 24, color: 'var(--admin-text-muted)' }}>
                        {t('adminSystemSettingsPage.geofenceRules.empty', { addLabel: t('adminSystemSettingsPage.geofenceRules.addZone') })}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="admin-settings-actions">
              {geofenceDirty && <span className="dirty-hint">{t('adminSystemSettingsPage.unsavedChangesHint')}</span>}
              <button
                className="admin-btn admin-btn-ghost admin-btn-sm"
                onClick={() => setDraft({ ...draft, geofencing: { ...draft.geofencing, rules: geofenceServer } })}
                disabled={!geofenceDirty || savingTab === 'geofencing'}
              >
                {t('adminSystemSettingsPage.discard')}
              </button>
              <button
                className="admin-btn admin-btn-primary admin-btn-sm"
                onClick={saveGeofencing}
                disabled={!geofenceDirty || savingTab === 'geofencing'}
              >
                {savingTab === 'geofencing' ? t('adminSystemSettingsPage.saving') : t('adminSystemSettingsPage.geofenceRules.save')}
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
                <span className="admin-settings-hero-chip-label">{t('adminSystemSettingsPage.chips.systemStatus')}</span>
                <span className="admin-settings-hero-chip-value" style={{ fontSize: 14 }}>
                  {generalDraft.maintenanceMode ? t('adminSystemSettingsPage.status.maintenance') : t('adminSystemSettingsPage.status.operational')}
                </span>
              </div>
            </div>
            <div className="admin-settings-hero-chip">
              <div className="admin-settings-hero-chip-icon"><TuneOutlinedIcon fontSize="inherit" /></div>
              <div className="admin-settings-hero-chip-body">
                <span className="admin-settings-hero-chip-label">{t('adminSystemSettingsPage.chips.autoApprove')}</span>
                <span className="admin-settings-hero-chip-value" style={{ fontSize: 14 }}>
                  {generalDraft.autoApprove ? t('adminSystemSettingsPage.autoApproveOn') : t('adminSystemSettingsPage.autoApproveOff')}
                </span>
              </div>
            </div>
            <div className="admin-settings-hero-chip">
              <div className="admin-settings-hero-chip-icon"><BuildOutlinedIcon fontSize="inherit" /></div>
              <div className="admin-settings-hero-chip-body">
                <span className="admin-settings-hero-chip-label">{t('adminSystemSettingsPage.chips.apiRateLimit')}</span>
                <span className="admin-settings-hero-chip-value">{generalDraft.apiRateLimitPerMin}<span style={{ fontSize: 10, color: 'var(--admin-text-muted)', fontWeight: 500 }}> /min</span></span>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="admin-card">
              <div className="admin-card-header">
                <div>
                  <h3 className="admin-card-title">{t('adminSystemSettingsPage.systemControls.title')}</h3>
                  <p className="admin-card-subtitle">{t('adminSystemSettingsPage.systemControls.subtitle')}</p>
                </div>
              </div>
              <div style={{ marginTop: 4 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 0', borderBottom: '1px solid var(--admin-border)' }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{t('adminSystemSettingsPage.systemControls.autoApproveTitle')}</div>
                    <div style={{ fontSize: 11, color: 'var(--admin-text-muted)', marginTop: 2 }}>{t('adminSystemSettingsPage.systemControls.autoApproveDesc')}</div>
                  </div>
                  <ToggleSwitch
                    checked={Boolean(generalDraft.autoApprove)}
                    onChange={(checked) => updateGeneral({ autoApprove: checked })}
                    ariaLabel={t('adminSystemSettingsPage.ariaToggleAutoApprove')}
                  />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 0' }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{t('adminSystemSettingsPage.systemControls.maintenanceModeTitle')}</div>
                    <div style={{ fontSize: 11, color: 'var(--admin-text-muted)', marginTop: 2 }}>{t('adminSystemSettingsPage.systemControls.maintenanceModeDesc')}</div>
                  </div>
                  <ToggleSwitch
                    checked={Boolean(generalDraft.maintenanceMode)}
                    onChange={(checked) => updateGeneral({ maintenanceMode: checked })}
                    ariaLabel={t('adminSystemSettingsPage.ariaToggleMaintenanceMode')}
                  />
                </div>
              </div>
            </div>

            <div className="admin-card">
              <div className="admin-card-header">
                <div>
                  <h3 className="admin-card-title">{t('adminSystemSettingsPage.dataRetention.title')}</h3>
                  <p className="admin-card-subtitle">{t('adminSystemSettingsPage.dataRetention.subtitle')}</p>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginTop: 4 }}>
                <div>
                  <label className="admin-form-label">{t('adminSystemSettingsPage.dataRetention.incidentArchiveAfter')}</label>
                  <FancySelect
                    value={String(generalDraft.incidentArchiveDays ?? 90)}
                    onChange={(value) => updateGeneral({ incidentArchiveDays: Number(value) })}
                    options={ARCHIVE_OPTIONS.map((opt) => ({ value: String(opt.value), label: opt.label }))}
                    menuAlign="left"
                  />
                </div>
                <div>
                  <label className="admin-form-label">{t('adminSystemSettingsPage.dataRetention.auditLogRetention')}</label>
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
                  <h3 className="admin-card-title">{t('adminSystemSettingsPage.apiConfig.title')}</h3>
                  <p className="admin-card-subtitle">{t('adminSystemSettingsPage.apiConfig.subtitle')}</p>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginTop: 4 }}>
                <div>
                  <label className="admin-form-label">{t('adminSystemSettingsPage.apiConfig.rateLimit')}</label>
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
                  <label className="admin-form-label">{t('adminSystemSettingsPage.apiConfig.maxUploadSize')}</label>
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
                {generalDirty && <span className="dirty-hint">{t('adminSystemSettingsPage.unsavedChangesHint')}</span>}
                <button
                  className="admin-btn admin-btn-ghost admin-btn-sm"
                  onClick={() => setDraft({ ...draft, general: generalServer })}
                  disabled={!generalDirty || savingTab === 'general'}
                >
                  {t('adminSystemSettingsPage.discard')}
                </button>
                <button
                  className="admin-btn admin-btn-primary admin-btn-sm"
                  onClick={saveGeneral}
                  disabled={!generalDirty || savingTab === 'general'}
                >
                  {savingTab === 'general' ? t('adminSystemSettingsPage.saving') : t('adminSystemSettingsPage.generalSettings.save')}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  )
}

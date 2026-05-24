import React, { useCallback, useEffect, useState } from 'react'
import CampaignOutlinedIcon from '@mui/icons-material/CampaignOutlined'
import FancySelect from '../../components/ui/FancySelect'
import AssignmentOutlinedIcon from '@mui/icons-material/AssignmentOutlined'
import NotificationsOffOutlinedIcon from '@mui/icons-material/NotificationsOffOutlined'
import CheckRoundedIcon from '@mui/icons-material/CheckRounded'
import TipsAndUpdatesOutlinedIcon from '@mui/icons-material/TipsAndUpdatesOutlined'
import NotificationsActiveOutlinedIcon from '@mui/icons-material/NotificationsActiveOutlined'
import WarningAmberOutlinedIcon from '@mui/icons-material/WarningAmberOutlined'
import RecordVoiceOverOutlinedIcon from '@mui/icons-material/RecordVoiceOverOutlined'

import PoliceShell from '../../components/layout/PoliceShell'
import {
  createSupervisorAlertApi,
  getPoliceWorkZoneOptions,
  listPoliceAlerts,
} from '../../services/policeService'
import '../../styles/SupervisorMode.css'

const SEVERITIES = ['low', 'medium', 'high']
const ALERT_TYPES = ['advisory', 'emergency', 'incident', 'weather', 'roadwork', 'closure']
const TARGET_TYPES = [
  { value: 'zone', label: 'All Officers in Zone' },
  { value: 'role', label: 'All Police Officers' },
]

function formatRelative(value) {
  if (!value) return '—'
  const diff = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 60000))
  if (diff < 1) return 'Just now'
  if (diff < 60) return `${diff}m ago`
  const h = Math.floor(diff / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

function severityClass(sev) {
  return `sv-badge-${sev || 'medium'}`
}

const INITIAL_FORM = {
  title: '',
  description: '',
  severity: 'medium',
  alertType: 'advisory',
  targetType: 'zone',
  adminAreaId: '',
  startsAt: '',
  endsAt: '',
}

export default function SupervisorAlertCenterPage() {
  const [form, setForm] = useState(INITIAL_FORM)
  const [errors, setErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [toast, setToast] = useState(null)

  const [wilayas, setWilayas] = useState([])
  const [pastAlerts, setPastAlerts] = useState([])
  const [loadingAlerts, setLoadingAlerts] = useState(true)

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 4000)
  }

  const loadData = useCallback(async () => {
    try {
      const [zoneOpts, alertsResult] = await Promise.all([
        getPoliceWorkZoneOptions(),
        listPoliceAlerts({ pageSize: 20 }),
      ])
      setWilayas(zoneOpts.wilayas || [])
      setPastAlerts(alertsResult.items || [])
    } catch {
      // non-critical
    } finally {
      setLoadingAlerts(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  const validate = () => {
    const next = {}
    if (!form.title.trim()) next.title = 'Title is required'
    if (!form.description.trim()) next.description = 'Message is required'
    if (!form.adminAreaId) next.adminAreaId = 'Zone is required'
    if (!form.endsAt) next.endsAt = 'End time is required'
    if (form.endsAt && form.startsAt && new Date(form.endsAt) <= new Date(form.startsAt)) {
      next.endsAt = 'End time must be after start time'
    }
    setErrors(next)
    return Object.keys(next).length === 0
  }

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }))
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: '' }))
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!validate()) return

    setSubmitting(true)
    try {
      await createSupervisorAlertApi({
        title: form.title.trim(),
        description: form.description.trim(),
        severity: form.severity,
        alertType: form.alertType,
        targetType: form.targetType,
        adminAreaId: Number(form.adminAreaId),
        targetRole: form.targetType === 'role' ? 'police' : undefined,
        startsAt: form.startsAt || undefined,
        endsAt: form.endsAt,
      })
      showToast('Alert sent to officers successfully', 'success')
      setForm(INITIAL_FORM)
      await loadData()
    } catch (err) {
      showToast(err.message || 'Failed to send alert', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const nowLocalIso = () => {
    const now = new Date()
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset())
    return now.toISOString().slice(0, 16)
  }

  return (
    <PoliceShell activeKey="supervisor-alerts" rightPanelCollapsed>
      <div className="supervisor-page">
        <div className="sv-page-header">
          <div className="sv-page-title-block">
            <span className="sv-page-eyebrow">Supervisor — Alert Center</span>
            <h1 className="sv-page-title">Supervisor Alerts</h1>
            <p className="sv-page-subtitle">Broadcast operational alerts and warnings to field officers</p>
          </div>
        </div>

        <div className="sv-grid-2">
          {/* Alert Creation Form */}
          <div className="sv-section">
            <div className="sv-section-head">
              <h2 className="sv-section-title">
                <span className="sv-section-title-icon"><CampaignOutlinedIcon fontSize="inherit" /></span>
                Create Alert
              </h2>
            </div>
            <div className="sv-section-body">
              <form onSubmit={handleSubmit} noValidate>
                <div className="sv-form-group">
                  <label className="sv-form-label">Alert Title</label>
                  <input
                    className="sv-form-input"
                    placeholder="e.g., Avoid Zone A — severe congestion"
                    value={form.title}
                    onChange={(e) => handleChange('title', e.target.value)}
                    maxLength={200}
                  />
                  {errors.title && <span className="sv-form-error">{errors.title}</span>}
                </div>

                <div className="sv-form-group">
                  <label className="sv-form-label">Message</label>
                  <textarea
                    className="sv-form-textarea"
                    rows={4}
                    placeholder="Provide detailed instructions or context for field officers..."
                    value={form.description}
                    onChange={(e) => handleChange('description', e.target.value)}
                    maxLength={2000}
                  />
                  {errors.description && <span className="sv-form-error">{errors.description}</span>}
                </div>

                <div className="sv-form-group">
                  <label className="sv-form-label">Severity</label>
                  <div className="sv-severity-selector">
                    {SEVERITIES.map((sev) => (
                      <button
                        key={sev}
                        type="button"
                        className={`sv-severity-btn sev-${sev} ${form.severity === sev ? 'selected' : ''}`}
                        onClick={() => handleChange('severity', sev)}
                      >
                        {sev.charAt(0).toUpperCase() + sev.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="sv-grid-2" style={{ gap: 12 }}>
                  <div className="sv-form-group">
                    <label className="sv-form-label">Alert Type</label>
                    <FancySelect
                      value={form.alertType}
                      onChange={(value) => handleChange('alertType', value)}
                      menuAlign="left"
                      options={ALERT_TYPES.map((t) => ({
                        value: t,
                        label: t.charAt(0).toUpperCase() + t.slice(1),
                      }))}
                    />
                  </div>
                  <div className="sv-form-group">
                    <label className="sv-form-label">Target Audience</label>
                    <FancySelect
                      value={form.targetType}
                      onChange={(value) => handleChange('targetType', value)}
                      menuAlign="left"
                      options={TARGET_TYPES}
                    />
                  </div>
                </div>

                <div className="sv-form-group">
                  <label className="sv-form-label">Zone (Wilaya)</label>
                  <FancySelect
                    value={form.adminAreaId}
                    onChange={(value) => handleChange('adminAreaId', value)}
                    menuAlign="left"
                    options={[
                      { value: '', label: 'Select wilaya...' },
                      ...wilayas.map((w) => ({ value: w.id, label: w.name })),
                    ]}
                  />
                  {errors.adminAreaId && <span className="sv-form-error">{errors.adminAreaId}</span>}
                </div>

                <div className="sv-grid-2" style={{ gap: 12 }}>
                  <div className="sv-form-group">
                    <label className="sv-form-label">Active From</label>
                    <input
                      type="datetime-local"
                      className="sv-form-input"
                      value={form.startsAt}
                      min={nowLocalIso()}
                      onChange={(e) => handleChange('startsAt', e.target.value)}
                    />
                    <span className="sv-form-hint">Leave blank to start immediately</span>
                  </div>
                  <div className="sv-form-group">
                    <label className="sv-form-label">Active Until *</label>
                    <input
                      type="datetime-local"
                      className="sv-form-input"
                      value={form.endsAt}
                      min={nowLocalIso()}
                      onChange={(e) => handleChange('endsAt', e.target.value)}
                    />
                    {errors.endsAt && <span className="sv-form-error">{errors.endsAt}</span>}
                  </div>
                </div>

                <div style={{ marginTop: 8 }}>
                  <button
                    type="submit"
                    className="sv-btn sv-btn-primary"
                    disabled={submitting}
                    style={{ width: '100%', justifyContent: 'center', padding: '12px' }}
                  >
                    {submitting ? 'Sending...' : <><CampaignOutlinedIcon fontSize="inherit" /> Broadcast Alert to Officers</>}
                  </button>
                </div>
              </form>
            </div>
          </div>

          {/* Recent Alerts */}
          <div className="sv-section">
            <div className="sv-section-head">
              <h2 className="sv-section-title">
                <span className="sv-section-title-icon"><AssignmentOutlinedIcon fontSize="inherit" /></span>
                Recent Alerts Received
              </h2>
            </div>
            <div className="sv-section-body">
              {loadingAlerts ? (
                <div className="sv-loading"><div className="sv-loading-spinner" /></div>
              ) : pastAlerts.length === 0 ? (
                <div className="sv-empty">
                  <span className="sv-empty-icon"><NotificationsOffOutlinedIcon fontSize="inherit" /></span>
                  No recent alerts
                </div>
              ) : (
                <div className="sv-incident-list">
                  {pastAlerts.map((alert) => (
                    <div key={alert.id} className="sv-incident-row" style={{ cursor: 'default' }}>
                      <div className={`sv-incident-severity-dot sev-${alert.severity || 'medium'}`} />
                      <div className="sv-incident-main">
                        <div className="sv-incident-title">{alert.title}</div>
                        <div className="sv-incident-meta">
                          {alert.description?.slice(0, 80)}{alert.description?.length > 80 ? '...' : ''}
                        </div>
                      </div>
                      <div className="sv-incident-right">
                        <span className={`sv-badge ${severityClass(alert.severity)}`}>
                          {(alert.severity || 'medium').charAt(0).toUpperCase() + (alert.severity || '').slice(1)}
                        </span>
                        <span style={{ fontSize: 11, color: 'var(--sv-text-muted)' }}>
                          {formatRelative(alert.createdAt)}
                        </span>
                        {alert.read && (
                          <span style={{ fontSize: 10, color: 'var(--sv-low)', display: 'inline-flex', alignItems: 'center', gap: 2 }}><CheckRoundedIcon fontSize="inherit" /> Read</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Alert examples info panel */}
        <div className="sv-section" style={{ marginTop: 20 }}>
          <div className="sv-section-head">
            <h2 className="sv-section-title">
              <span className="sv-section-title-icon"><TipsAndUpdatesOutlinedIcon fontSize="inherit" className="icon-info" /></span>
              Alert Guidelines
            </h2>
          </div>
          <div className="sv-section-body">
            <div className="sv-grid-3">
              {[
                { icon: <NotificationsActiveOutlinedIcon fontSize="inherit" className="icon-danger" />, label: 'High', desc: 'Immediate threat, major accident, danger zone active. Requires urgent response.' },
                { icon: <WarningAmberOutlinedIcon fontSize="inherit" className="icon-warning" />, label: 'Medium', desc: 'Significant risk, accident probability near a specific route.' },
                { icon: <RecordVoiceOverOutlinedIcon fontSize="inherit" className="icon-info" />, label: 'Advisory', desc: 'General guidance, zone updates, traffic congestion, roadwork.' },
              ].map((g) => (
                <div key={g.label} style={{
                  padding: '16px',
                  background: 'var(--sv-bg)',
                  borderRadius: 'var(--sv-radius-sm)',
                  border: '1px solid var(--sv-border)',
                }}>
                  <div style={{ fontSize: 24, marginBottom: 8 }}>{g.icon}</div>
                  <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>{g.label}</div>
                  <div style={{ fontSize: 12, color: 'var(--sv-text-muted)', lineHeight: 1.5 }}>{g.desc}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {toast && (
          <div className={`sv-toast sv-toast-${toast.type}`}>{toast.msg}</div>
        )}
      </div>
    </PoliceShell>
  )
}

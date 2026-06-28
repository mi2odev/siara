import React, { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import CampaignOutlinedIcon from '@mui/icons-material/CampaignOutlined'
import FancySelect from '../../components/ui/FancySelect'
import SiaraDatePicker from '../../components/ui/SiaraDatePicker'
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
import { fetchCommunes } from '../../services/alertService'
import '../../styles/SupervisorMode.css'

const SEVERITIES = ['low', 'medium', 'high']
const ALERT_TYPES = ['advisory', 'emergency', 'incident', 'weather', 'roadwork', 'closure']

function formatRelative(value, t) {
  if (!value) return '—'
  const diff = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 60000))
  if (diff < 1) return t('supervisorAlertCenterPage.timeJustNow')
  if (diff < 60) return t('supervisorAlertCenterPage.timeMinutesAgo', { count: diff })
  const h = Math.floor(diff / 60)
  if (h < 24) return t('supervisorAlertCenterPage.timeHoursAgo', { count: h })
  return t('supervisorAlertCenterPage.timeDaysAgo', { count: Math.floor(h / 24) })
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
  const { t } = useTranslation(['supervisor', 'common'])
  const [form, setForm] = useState(INITIAL_FORM)
  const [errors, setErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [toast, setToast] = useState(null)

  // Communes of the supervisor's own wilaya — the zone options for a broadcast.
  const [communes, setCommunes] = useState([])
  const [workWilaya, setWorkWilaya] = useState({ id: null, name: '' })
  const [pastAlerts, setPastAlerts] = useState([])
  const [loadingAlerts, setLoadingAlerts] = useState(true)

  const TARGET_TYPES = [
    { value: 'zone', label: t('supervisorAlertCenterPage.targetAllOfficersInZone') },
    { value: 'role', label: t('supervisorAlertCenterPage.targetAllPoliceOfficers') },
  ]

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 4000)
  }

  const loadData = useCallback(async () => {
    // Each source is resolved independently so one failure never blanks the form.
    const [zoneOpts, alertsResult] = await Promise.all([
      getPoliceWorkZoneOptions().catch(() => null),
      listPoliceAlerts({ pageSize: 20 }).catch(() => ({ items: [] })),
    ])
    setPastAlerts(alertsResult.items || [])

    // The supervisor broadcasts within the wilaya they work in, so the zone
    // dropdown lists that wilaya's communes (e.g. all communes of Constantine).
    const workWilayaId = zoneOpts?.selectedWilayaId || null
    const workWilayaName = workWilayaId
      ? ((zoneOpts?.wilayas || []).find((w) => Number(w.id) === Number(workWilayaId))?.name || '')
      : ''
    setWorkWilaya({ id: workWilayaId, name: workWilayaName })

    let communeOptions = zoneOpts?.communes || []
    if (workWilayaId && communeOptions.length === 0) {
      communeOptions = await fetchCommunes(workWilayaId).catch(() => [])
    }
    setCommunes(communeOptions)

    // Default the zone to the commune this supervisor is assigned to, if any.
    const workCommuneId = zoneOpts?.selectedCommuneId
    if (workCommuneId && communeOptions.some((c) => Number(c.id) === Number(workCommuneId))) {
      setForm((prev) => (prev.adminAreaId ? prev : { ...prev, adminAreaId: Number(workCommuneId) }))
    }

    setLoadingAlerts(false)
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  const validate = () => {
    const next = {}
    if (!form.title.trim()) next.title = t('supervisorAlertCenterPage.errorTitleRequired')
    if (!form.description.trim()) next.description = t('supervisorAlertCenterPage.errorMessageRequired')
    if (!form.adminAreaId) next.adminAreaId = t('supervisorAlertCenterPage.errorZoneRequired')
    if (!form.endsAt) next.endsAt = t('supervisorAlertCenterPage.errorEndTimeRequired')
    if (form.endsAt && form.startsAt && new Date(form.endsAt) <= new Date(form.startsAt)) {
      next.endsAt = t('supervisorAlertCenterPage.errorEndTimeAfterStart')
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
      showToast(t('supervisorAlertCenterPage.toastAlertSent'), 'success')
      setForm(INITIAL_FORM)
      await loadData()
    } catch (err) {
      showToast(err.message || t('supervisorAlertCenterPage.toastAlertFailed'), 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const nowLocalIso = () => {
    const now = new Date()
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset())
    return now.toISOString().slice(0, 16)
  }

  const guidelines = [
    {
      icon: <NotificationsActiveOutlinedIcon fontSize="inherit" className="icon-danger" />,
      label: t('supervisorAlertCenterPage.guidelineHighLabel'),
      desc: t('supervisorAlertCenterPage.guidelineHighDesc'),
    },
    {
      icon: <WarningAmberOutlinedIcon fontSize="inherit" className="icon-warning" />,
      label: t('supervisorAlertCenterPage.guidelineMediumLabel'),
      desc: t('supervisorAlertCenterPage.guidelineMediumDesc'),
    },
    {
      icon: <RecordVoiceOverOutlinedIcon fontSize="inherit" className="icon-info" />,
      label: t('supervisorAlertCenterPage.guidelineAdvisoryLabel'),
      desc: t('supervisorAlertCenterPage.guidelineAdvisoryDesc'),
    },
  ]

  return (
    <PoliceShell activeKey="supervisor-alerts" rightPanelCollapsed>
      <div className="supervisor-page">
        <div className="sv-page-header">
          <div className="sv-page-title-block">
            <span className="sv-page-eyebrow">{t('supervisorAlertCenterPage.eyebrow')}</span>
            <h1 className="sv-page-title">{t('supervisorAlertCenterPage.title')}</h1>
            <p className="sv-page-subtitle">{t('supervisorAlertCenterPage.subtitle')}</p>
          </div>
        </div>

        <div className="sv-grid-2">
          {/* Alert Creation Form */}
          <div className="sv-section">
            <div className="sv-section-head">
              <h2 className="sv-section-title">
                <span className="sv-section-title-icon"><CampaignOutlinedIcon fontSize="inherit" /></span>
                {t('supervisorAlertCenterPage.createAlertTitle')}
              </h2>
            </div>
            <div className="sv-section-body">
              <form onSubmit={handleSubmit} noValidate>
                <div className="sv-form-group">
                  <label className="sv-form-label">{t('supervisorAlertCenterPage.labelAlertTitle')}</label>
                  <input
                    className="sv-form-input"
                    placeholder={t('supervisorAlertCenterPage.placeholderAlertTitle')}
                    value={form.title}
                    onChange={(e) => handleChange('title', e.target.value)}
                    maxLength={200}
                  />
                  {errors.title && <span className="sv-form-error">{errors.title}</span>}
                </div>

                <div className="sv-form-group">
                  <label className="sv-form-label">{t('supervisorAlertCenterPage.labelMessage')}</label>
                  <textarea
                    className="sv-form-textarea"
                    rows={4}
                    placeholder={t('supervisorAlertCenterPage.placeholderMessage')}
                    value={form.description}
                    onChange={(e) => handleChange('description', e.target.value)}
                    maxLength={2000}
                  />
                  {errors.description && <span className="sv-form-error">{errors.description}</span>}
                </div>

                <div className="sv-form-group">
                  <label className="sv-form-label">{t('supervisorAlertCenterPage.labelSeverity')}</label>
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
                    <label className="sv-form-label">{t('supervisorAlertCenterPage.labelAlertType')}</label>
                    <FancySelect
                      value={form.alertType}
                      onChange={(value) => handleChange('alertType', value)}
                      menuAlign="left"
                      options={ALERT_TYPES.map((tp) => ({
                        value: tp,
                        label: tp.charAt(0).toUpperCase() + tp.slice(1),
                      }))}
                    />
                  </div>
                  <div className="sv-form-group">
                    <label className="sv-form-label">{t('supervisorAlertCenterPage.labelTargetAudience')}</label>
                    <FancySelect
                      value={form.targetType}
                      onChange={(value) => handleChange('targetType', value)}
                      menuAlign="left"
                      options={TARGET_TYPES}
                    />
                  </div>
                </div>

                <div className="sv-form-group">
                  <label className="sv-form-label">
                    {workWilaya.name
                      ? t('supervisorAlertCenterPage.labelZoneWithWilaya', { wilaya: workWilaya.name })
                      : t('supervisorAlertCenterPage.labelZone')}
                  </label>
                  <FancySelect
                    value={form.adminAreaId}
                    onChange={(value) => handleChange('adminAreaId', value)}
                    menuAlign="left"
                    options={[
                      { value: '', label: t('supervisorAlertCenterPage.optionSelectCommune') },
                      ...(workWilaya.id
                        ? [{ value: workWilaya.id, label: t('supervisorAlertCenterPage.optionAllOfWilaya', { wilaya: workWilaya.name }) }]
                        : []),
                      ...communes.map((c) => ({ value: c.id, label: c.name })),
                    ]}
                  />
                  {errors.adminAreaId && <span className="sv-form-error">{errors.adminAreaId}</span>}
                </div>

                <div className="sv-grid-2" style={{ gap: 12 }}>
                  <div className="sv-form-group">
                    <label className="sv-form-label">{t('supervisorAlertCenterPage.labelActiveFrom')}</label>
                    <SiaraDatePicker
                      type="datetime-local"
                      value={form.startsAt}
                      min={nowLocalIso()}
                      placeholder={t('supervisorAlertCenterPage.placeholderStartImmediately')}
                      onChange={(v) => handleChange('startsAt', v)}
                    />
                    <span className="sv-form-hint">{t('supervisorAlertCenterPage.hintStartImmediately')}</span>
                  </div>
                  <div className="sv-form-group">
                    <label className="sv-form-label">{t('supervisorAlertCenterPage.labelActiveUntil')}</label>
                    <SiaraDatePicker
                      type="datetime-local"
                      value={form.endsAt}
                      min={nowLocalIso()}
                      placeholder={t('supervisorAlertCenterPage.placeholderSelectDateTime')}
                      onChange={(v) => handleChange('endsAt', v)}
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
                    {submitting ? t('supervisorAlertCenterPage.btnSending') : <><CampaignOutlinedIcon fontSize="inherit" /> {t('supervisorAlertCenterPage.btnBroadcast')}</>}
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
                {t('supervisorAlertCenterPage.recentAlertsTitle')}
              </h2>
            </div>
            <div className="sv-section-body">
              {loadingAlerts ? (
                <div className="sv-loading"><div className="sv-loading-spinner" /></div>
              ) : pastAlerts.length === 0 ? (
                <div className="sv-empty">
                  <span className="sv-empty-icon"><NotificationsOffOutlinedIcon fontSize="inherit" /></span>
                  {t('supervisorAlertCenterPage.noRecentAlerts')}
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
                          {formatRelative(alert.createdAt, t)}
                        </span>
                        {alert.read && (
                          <span style={{ fontSize: 10, color: 'var(--sv-low)', display: 'inline-flex', alignItems: 'center', gap: 2 }}><CheckRoundedIcon fontSize="inherit" /> {t('supervisorAlertCenterPage.badgeRead')}</span>
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
              {t('supervisorAlertCenterPage.guidelinesTitle')}
            </h2>
          </div>
          <div className="sv-section-body">
            <div className="sv-grid-3">
              {guidelines.map((g) => (
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

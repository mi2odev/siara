import React, { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router-dom'

import FancySelect from '../../components/ui/FancySelect'
import { fetchCommunes, fetchWilayas } from '../../services/alertService'

import {
  cancelAdminOperationalAlert,
  createAdminOperationalAlert,
  createAdminOperationalAlertFromTemplate,
  deleteAdminOperationalAlert,
  fetchAdminOperationalAlert,
  fetchAdminOperationalAlerts,
  fetchOperationalAlertTemplates,
  normalizeOperationalAlertTab,
  updateAdminOperationalAlert,
} from '../../services/adminOperationalAlertsService'

const EMPTY_TEXT = '—'
const DEFAULT_PAGE_SIZE = 20

function addMinutes(date, minutes) {
  return new Date(date.getTime() + (minutes * 60 * 1000))
}

function toLocalInputValue(value) {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) {
    return ''
  }

  const local = new Date(date.getTime() - (date.getTimezoneOffset() * 60000))
  return local.toISOString().slice(0, 16)
}

function toIsoFromLocal(value) {
  if (!value) {
    return null
  }

  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

function formatAlertType(value) {
  return String(value || 'advisory')
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (match) => match.toUpperCase())
}

function buildBlankFormState({ template = null, emergencyMode = false } = {}) {
  const startsAt = new Date()
  const durationMinutes = template?.defaultDurationMinutes || (emergencyMode ? 720 : 240)
  const endsAt = addMinutes(startsAt, durationMinutes)

  return {
    title: template?.defaultTitle || '',
    description: template?.defaultMessage || '',
    alertType: template?.alertType || (emergencyMode ? 'emergency' : 'incident'),
    severity: template?.defaultSeverity || (emergencyMode ? 'high' : 'medium'),
    wilayaId: '',
    communeId: '',
    startsAtLocal: toLocalInputValue(startsAt),
    endsAtLocal: toLocalInputValue(endsAt),
    audienceScope: 'users_in_zone',
    notifyOnStart: true,
    notifyOnExpire: false,
    sendPush: template?.sendPush ?? true,
    sendEmail: template?.sendEmail ?? false,
    sendSms: template?.sendSms ?? false,
    templateId: template?.id || null,
  }
}

function buildFormStateFromAlert(alert) {
  const adminAreaLevel = alert?.adminArea?.level || null
  const wilayaId = adminAreaLevel === 'commune'
    ? String(alert?.adminArea?.wilayaId || '')
    : String(alert?.adminAreaId || '')

  return {
    title: alert?.title || '',
    description: alert?.description || '',
    alertType: alert?.type || 'advisory',
    severity: alert?.severity || 'medium',
    wilayaId,
    communeId: adminAreaLevel === 'commune' ? String(alert?.adminAreaId || '') : '',
    startsAtLocal: toLocalInputValue(alert?.startsAt),
    endsAtLocal: toLocalInputValue(alert?.endsAt),
    audienceScope: alert?.audienceScope || 'users_in_zone',
    notifyOnStart: Boolean(alert?.notifyOnStart),
    notifyOnExpire: Boolean(alert?.notifyOnExpire),
    sendPush: Boolean(alert?.sendPush),
    sendEmail: Boolean(alert?.sendEmail),
    sendSms: Boolean(alert?.sendSms),
    templateId: alert?.templateId || null,
  }
}

function matchesTemplateSearch(template, search) {
  const needle = String(search || '').trim().toLowerCase()
  if (!needle) {
    return true
  }

  return [
    template.name,
    template.description,
    template.alertType,
  ].some((value) => String(value || '').toLowerCase().includes(needle))
}

function getAudienceText(alert) {
  return typeof alert?.audience === 'number' ? alert.audience.toLocaleString() : EMPTY_TEXT
}

export default function AdminAlertsPage() {
  const { t } = useTranslation(['admin', 'common'])
  const [searchParams, setSearchParams] = useSearchParams()
  const currentTab = normalizeOperationalAlertTab(searchParams.get('tab') || 'all')

  const TAB_DEFINITIONS = [
    { key: 'all', label: t('adminAlertsPage.tabs.all') },
    { key: 'active', label: t('adminAlertsPage.tabs.active') },
    { key: 'scheduled', label: t('adminAlertsPage.tabs.scheduled') },
    { key: 'expired', label: t('adminAlertsPage.tabs.expired') },
    { key: 'emergency', label: t('adminAlertsPage.tabs.emergency') },
    { key: 'templates', label: t('adminAlertsPage.tabs.templates') },
  ]

  const ALERT_SEVERITY_OPTIONS = [
    { value: 'low', label: t('adminAlertsPage.severity.low') },
    { value: 'medium', label: t('adminAlertsPage.severity.medium') },
    { value: 'high', label: t('adminAlertsPage.severity.high') },
  ]

  const ALERT_AUDIENCE_OPTIONS = [
    { value: 'users_in_zone', label: t('adminAlertsPage.audience.usersInZone') },
    { value: 'all_users', label: t('adminAlertsPage.audience.allUsers') },
    { value: 'subscribed_users_only', label: t('adminAlertsPage.audience.subscribedOnly') },
  ]

  const ALERT_TYPE_OPTIONS = [
    { value: 'incident', label: t('adminAlertsPage.alertType.incident') },
    { value: 'weather', label: t('adminAlertsPage.alertType.weather') },
    { value: 'roadwork', label: t('adminAlertsPage.alertType.roadwork') },
    { value: 'closure', label: t('adminAlertsPage.alertType.closure') },
    { value: 'emergency', label: t('adminAlertsPage.alertType.emergency') },
    { value: 'advisory', label: t('adminAlertsPage.alertType.advisory') },
  ]

  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [emergencyMode, setEmergencyMode] = useState(false)
  const [emergencyConfirm, setEmergencyConfirm] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [formMode, setFormMode] = useState('create')
  const [editingAlertId, setEditingAlertId] = useState(null)
  const [formData, setFormData] = useState(() => buildBlankFormState())
  const [alerts, setAlerts] = useState([])
  const [counts, setCounts] = useState({
    all: 0,
    active: 0,
    scheduled: 0,
    expired: 0,
    emergency: 0,
    templates: 0,
  })
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: DEFAULT_PAGE_SIZE,
    total: 0,
    totalPages: 1,
    returned: 0,
  })
  const [templates, setTemplates] = useState([])
  const [loading, setLoading] = useState(currentTab !== 'templates')
  const [templatesLoading, setTemplatesLoading] = useState(true)
  const [loadingWilayas, setLoadingWilayas] = useState(true)
  const [loadingCommunes, setLoadingCommunes] = useState(false)
  const [wilayas, setWilayas] = useState([])
  const [communes, setCommunes] = useState([])
  const [error, setError] = useState(null)
  const [formError, setFormError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [cancelTarget, setCancelTarget] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [reloadToken, setReloadToken] = useState(0)

  const templateTabActive = currentTab === 'templates'
  const filteredTemplates = useMemo(
    () => templates.filter((template) => matchesTemplateSearch(template, search)),
    [templates, search],
  )
  const tabCounts = {
    ...counts,
    templates: counts.templates || templates.length,
  }

  useEffect(() => {
    setPage(1)
  }, [currentTab, search])

  useEffect(() => {
    const controller = new AbortController()

    async function loadTemplates() {
      try {
        const items = await fetchOperationalAlertTemplates({ signal: controller.signal })
        if (!controller.signal.aborted) {
          setTemplates(items)
          setCounts((current) => ({ ...current, templates: items.length }))
        }
      } catch (requestError) {
        if (!controller.signal.aborted) {
          setError(requestError)
        }
      } finally {
        if (!controller.signal.aborted) {
          setTemplatesLoading(false)
        }
      }
    }

    async function loadWilayas() {
      try {
        const items = await fetchWilayas()
        if (!controller.signal.aborted) {
          setWilayas(items)
        }
      } catch (requestError) {
        if (!controller.signal.aborted) {
          setError(requestError)
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoadingWilayas(false)
        }
      }
    }

    loadTemplates()
    loadWilayas()

    return () => controller.abort()
  }, [reloadToken])

  useEffect(() => {
    if (!showCreate || !formData.wilayaId) {
      setCommunes([])
      return
    }

    let ignore = false
    setLoadingCommunes(true)

    ;(async () => {
      try {
        const items = await fetchCommunes(formData.wilayaId)
        if (!ignore) {
          setCommunes(items)
        }
      } catch (requestError) {
        if (!ignore) {
          setError(requestError)
        }
      } finally {
        if (!ignore) {
          setLoadingCommunes(false)
        }
      }
    })()

    return () => {
      ignore = true
    }
  }, [formData.wilayaId, showCreate])

  useEffect(() => {
    if (templateTabActive) {
      setAlerts([])
      setPagination((current) => ({ ...current, total: 0, returned: 0 }))
      setLoading(false)
      return
    }

    const controller = new AbortController()

    async function loadAlerts() {
      setLoading(true)
      setError(null)

      try {
        const payload = await fetchAdminOperationalAlerts(
          {
            tab: currentTab,
            search,
            page,
            pageSize: DEFAULT_PAGE_SIZE,
          },
          { signal: controller.signal },
        )

        if (!controller.signal.aborted) {
          setAlerts(payload.items)
          setCounts(payload.counts)
          setPagination(payload.pagination)
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

    loadAlerts()

    return () => controller.abort()
  }, [currentTab, page, reloadToken, search, templateTabActive])

  function openCreateForm({ template = null, emergency = false } = {}) {
    setFormMode('create')
    setEditingAlertId(null)
    setFormError('')
    setFormData(buildBlankFormState({ template, emergencyMode: emergency }))
    setShowCreate(true)
  }

  async function openEditForm(alertId) {
    setFormError('')
    setIsSubmitting(true)

    try {
      const alert = await fetchAdminOperationalAlert(alertId)
      setFormMode('edit')
      setEditingAlertId(alert.id)
      setFormData(buildFormStateFromAlert(alert))
      setShowCreate(true)
    } catch (requestError) {
      setError(requestError)
    } finally {
      setIsSubmitting(false)
    }
  }

  function handleEmergencyToggle() {
    if (emergencyMode) {
      setEmergencyMode(false)
      return
    }

    setEmergencyConfirm(true)
  }

  function activateEmergencyMode() {
    const emergencyTemplate = templates.find((template) => template.alertType === 'emergency') || null
    setEmergencyMode(true)
    setEmergencyConfirm(false)
    openCreateForm({ template: emergencyTemplate, emergency: true })
  }

  function handleUseTemplate(template) {
    setEmergencyMode(template.alertType === 'emergency')
    openCreateForm({ template, emergency: template.alertType === 'emergency' })
  }

  async function refreshAlerts(nextPage = page) {
    if (templateTabActive) {
      return
    }

    const payload = await fetchAdminOperationalAlerts({
      tab: currentTab,
      search,
      page: nextPage,
      pageSize: DEFAULT_PAGE_SIZE,
    })

    setAlerts(payload.items)
    setCounts(payload.counts)
    setPagination(payload.pagination)
  }

  async function handleSubmitAlert() {
    const title = formData.title.trim()
    const adminAreaId = formData.communeId || formData.wilayaId
    const startsAt = toIsoFromLocal(formData.startsAtLocal)
    const endsAt = toIsoFromLocal(formData.endsAtLocal)

    if (!title) {
      setFormError(t('adminAlertsPage.validation.titleRequired'))
      return
    }

    if (!adminAreaId) {
      setFormError(t('adminAlertsPage.validation.selectZone'))
      return
    }

    if (!startsAt || !endsAt) {
      setFormError(t('adminAlertsPage.validation.datetimeRequired'))
      return
    }

    if (new Date(endsAt) <= new Date(startsAt)) {
      setFormError(t('adminAlertsPage.validation.endAfterStart'))
      return
    }

    setIsSubmitting(true)
    setFormError('')

    const payload = {
      title,
      description: formData.description.trim() || null,
      alertType: formData.alertType,
      severity: formData.severity,
      startsAt,
      endsAt,
      zoneType: 'admin_area',
      adminAreaId: Number(adminAreaId),
      audienceScope: formData.audienceScope,
      notifyOnStart: formData.notifyOnStart,
      notifyOnExpire: formData.notifyOnExpire,
      sendPush: formData.sendPush,
      sendEmail: formData.sendEmail,
      sendSms: formData.sendSms,
    }

    try {
      if (formMode === 'edit' && editingAlertId) {
        await updateAdminOperationalAlert(editingAlertId, payload)
      } else if (formData.templateId) {
        await createAdminOperationalAlertFromTemplate({
          templateId: formData.templateId,
          title,
          description: formData.description.trim() || null,
          startsAt,
          endsAt,
          adminAreaId: Number(adminAreaId),
          audienceScope: formData.audienceScope,
          notifyOnStart: formData.notifyOnStart,
          notifyOnExpire: formData.notifyOnExpire,
        })
      } else {
        await createAdminOperationalAlert(payload)
      }

      setShowCreate(false)
      setEditingAlertId(null)
      setFormData(buildBlankFormState({ emergencyMode }))
      setError(null)
      setPage(1)
      if (templateTabActive) {
        setSearchParams({ tab: 'all' })
      } else {
        await refreshAlerts(1)
      }
    } catch (requestError) {
      setFormError(requestError.message || t('adminAlertsPage.error.saveFailed'))
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleCancelAlert() {
    if (!cancelTarget) {
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      await cancelAdminOperationalAlert(cancelTarget.id)
      setCancelTarget(null)
      await refreshAlerts(page)
    } catch (requestError) {
      setError(requestError)
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleDeleteAlert() {
    if (!deleteTarget) {
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      await deleteAdminOperationalAlert(deleteTarget.id)
      setDeleteTarget(null)
      await refreshAlerts(page)
    } catch (requestError) {
      setError(requestError)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <>
      {emergencyMode && (
        <div
          className="admin-high-bar"
          style={{
            background: 'rgba(239, 68, 68, 0.15)',
            borderColor: 'var(--admin-danger)',
          }}
        >
          <span className="high-dot"></span>
          <span
            className="high-text"
            style={{ color: 'var(--admin-danger)', fontWeight: 700 }}
          >
            {t('adminAlertsPage.emergencyBanner')}
          </span>
          <button
            className="high-action"
            onClick={() => setEmergencyMode(false)}
            type="button"
          >
            {t('adminAlertsPage.resetComposer')}
          </button>
        </div>
      )}

      {error && (
        <div
          className="admin-card"
          style={{
            marginBottom: 14,
            borderColor: 'rgba(239, 68, 68, 0.35)',
            background: 'rgba(239, 68, 68, 0.05)',
          }}
        >
          <div className="admin-card-header">
            <div>
              <h2 className="admin-card-title">{t('adminAlertsPage.error.unavailable')}</h2>
              <p className="admin-card-subtitle">
                {error.message || t('adminAlertsPage.error.loadFailed')}
              </p>
            </div>
            <button
              className="admin-btn admin-btn-primary"
              onClick={() => {
                setError(null)
                setTemplatesLoading(true)
                setLoadingWilayas(true)
                setLoading(currentTab !== 'templates')
                setReloadToken((value) => value + 1)
              }}
              type="button"
            >
              {t('common:actions.retry')}
            </button>
          </div>
        </div>
      )}

      {emergencyConfirm && (
        <div className="admin-modal-overlay">
          <div className="admin-modal">
            <h3 className="admin-modal-title" style={{ color: 'var(--admin-danger)' }}>
              {'⚠'} {t('adminAlertsPage.emergencyConfirm.title')}
            </h3>
            <p className="admin-modal-desc">
              {t('adminAlertsPage.emergencyConfirm.description')}
            </p>
            <div className="admin-modal-actions">
              <button
                className="admin-btn admin-btn-ghost"
                onClick={() => setEmergencyConfirm(false)}
                type="button"
              >
                {t('common:actions.cancel')}
              </button>
              <button
                className="admin-btn admin-btn-danger"
                onClick={activateEmergencyMode}
                type="button"
              >
                {t('adminAlertsPage.emergencyConfirm.confirm')}
              </button>
            </div>
          </div>
        </div>
      )}

      {cancelTarget && (
        <div className="admin-modal-overlay">
          <div className="admin-modal">
            <h3 className="admin-modal-title">{t('adminAlertsPage.cancelModal.title')}</h3>
            <p className="admin-modal-desc">
              <strong>{cancelTarget.title}</strong> {t('adminAlertsPage.cancelModal.description')}
            </p>
            <div className="admin-modal-actions">
              <button
                className="admin-btn admin-btn-ghost"
                onClick={() => setCancelTarget(null)}
                type="button"
              >
                {t('adminAlertsPage.keepAlert')}
              </button>
              <button
                className="admin-btn admin-btn-danger"
                onClick={handleCancelAlert}
                disabled={isSubmitting}
                type="button"
              >
                {isSubmitting ? t('adminAlertsPage.cancelModal.cancelling') : t('adminAlertsPage.cancelModal.confirm')}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="admin-modal-overlay">
          <div className="admin-modal">
            <h3 className="admin-modal-title">{t('adminAlertsPage.deleteModal.title')}</h3>
            <p className="admin-modal-desc">
              <strong>{deleteTarget.title}</strong> {t('adminAlertsPage.deleteModal.description')}
            </p>
            <div className="admin-modal-actions">
              <button
                className="admin-btn admin-btn-ghost"
                onClick={() => setDeleteTarget(null)}
                type="button"
              >
                {t('adminAlertsPage.keepAlert')}
              </button>
              <button
                className="admin-btn admin-btn-danger"
                onClick={handleDeleteAlert}
                disabled={isSubmitting}
                type="button"
              >
                {isSubmitting ? t('adminAlertsPage.deleteModal.deleting') : t('adminAlertsPage.deleteModal.confirm')}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="admin-page-header">
        <div>
          <h1 className="admin-page-title">{t('adminAlertsPage.pageTitle')}</h1>
          <p className="admin-page-subtitle">
            {t('adminAlertsPage.pageSubtitle')}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            className="admin-input"
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t('adminAlertsPage.searchPlaceholder')}
            style={{ minWidth: 240 }}
          />
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '6px 12px',
              borderRadius: 6,
              background: emergencyMode ? 'rgba(239, 68, 68, 0.12)' : 'var(--admin-surface-alt)',
              border: `1px solid ${emergencyMode ? 'var(--admin-danger)' : 'var(--admin-border)'}`,
            }}
          >
            <span
              style={{
                fontSize: 11,
                color: emergencyMode ? 'var(--admin-danger)' : 'var(--admin-text-muted)',
                fontWeight: 600,
              }}
            >
              {t('adminAlertsPage.emergencyModeLabel')}
            </span>
            <button
              className={`admin-toggle ${emergencyMode ? 'active' : ''}`}
              onClick={handleEmergencyToggle}
              type="button"
              aria-pressed={emergencyMode}
            >
              <div className="admin-toggle-thumb"></div>
            </button>
          </div>
          <button
            className="admin-btn admin-btn-primary"
            onClick={() => openCreateForm({ emergency: emergencyMode })}
            type="button"
          >
            {t('adminAlertsPage.newAlert')}
          </button>
        </div>
      </div>

      {showCreate && (
        <div className="admin-card" style={{ marginBottom: 14 }}>
          <div className="admin-card-header">
            <div>
              <h3 className="admin-card-title">
                {formMode === 'edit'
                  ? t('adminAlertsPage.form.titleEdit')
                  : formData.templateId
                    ? t('adminAlertsPage.form.titleFromTemplate')
                    : t('adminAlertsPage.form.titleCreate')}
              </h3>
              <p className="admin-card-subtitle">
                {formData.templateId
                  ? t('adminAlertsPage.form.subtitleFromTemplate')
                  : t('adminAlertsPage.form.subtitleCreate')}
              </p>
            </div>
            <button
              className="admin-btn admin-btn-ghost"
              onClick={() => {
                setShowCreate(false)
                setFormError('')
                setFormMode('create')
                setEditingAlertId(null)
              }}
              type="button"
            >
              {t('common:actions.close')}
            </button>
          </div>

          {formError && (
            <div
              style={{
                marginBottom: 12,
                padding: '10px 12px',
                borderRadius: 8,
                background: 'rgba(239, 68, 68, 0.06)',
                border: '1px solid rgba(239, 68, 68, 0.12)',
                color: 'var(--admin-danger)',
                fontSize: 11.5,
                fontWeight: 500,
              }}
            >
              {formError}
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
            <div>
              <label className="admin-form-label">{t('adminAlertsPage.form.fieldTitle')}</label>
              <input
                className="admin-input"
                type="text"
                value={formData.title}
                onChange={(event) => setFormData((current) => ({
                  ...current,
                  title: event.target.value,
                }))}
                placeholder={t('adminAlertsPage.form.titlePlaceholder')}
              />
            </div>

            <div>
              <label className="admin-form-label">{t('adminAlertsPage.form.wilayaLabel')}</label>
              <FancySelect
                value={formData.wilayaId}
                onChange={(value) => setFormData((current) => ({
                  ...current,
                  wilayaId: value,
                  communeId: '',
                }))}
                disabled={loadingWilayas}
                placeholder={loadingWilayas ? t('adminAlertsPage.form.loadingWilayas') : t('adminAlertsPage.form.selectWilaya')}
                menuAlign="left"
                options={[
                  { value: '', label: loadingWilayas ? t('adminAlertsPage.form.loadingWilayas') : t('adminAlertsPage.form.selectWilaya') },
                  ...wilayas.map((w) => ({ value: w.id, label: w.name })),
                ]}
              />
            </div>

            <div>
              <label className="admin-form-label">{t('adminAlertsPage.form.communeLabel')}</label>
              <FancySelect
                value={formData.communeId}
                onChange={(value) => setFormData((current) => ({
                  ...current,
                  communeId: value,
                }))}
                disabled={!formData.wilayaId || loadingCommunes}
                menuAlign="left"
                options={[
                  {
                    value: '',
                    label: !formData.wilayaId
                      ? t('adminAlertsPage.form.selectWilayaFirst')
                      : loadingCommunes
                        ? t('adminAlertsPage.form.loadingCommunes')
                        : t('adminAlertsPage.form.wilayaWideAlert'),
                  },
                  ...communes.map((c) => ({ value: c.id, label: c.name })),
                ]}
              />
            </div>

            <div>
              <label className="admin-form-label">{t('adminAlertsPage.form.severityLabel')}</label>
              <FancySelect
                value={formData.severity}
                onChange={(value) => setFormData((current) => ({
                  ...current,
                  severity: value,
                }))}
                options={ALERT_SEVERITY_OPTIONS}
                menuAlign="left"
              />
            </div>

            <div>
              <label className="admin-form-label">{t('adminAlertsPage.form.typeLabel')}</label>
              <FancySelect
                value={formData.alertType}
                onChange={(value) => setFormData((current) => ({
                  ...current,
                  alertType: value,
                }))}
                disabled={formMode === 'edit'}
                options={ALERT_TYPE_OPTIONS}
                menuAlign="left"
              />
            </div>

            <div>
              <label className="admin-form-label">{t('adminAlertsPage.form.audienceLabel')}</label>
              <FancySelect
                value={formData.audienceScope}
                onChange={(value) => setFormData((current) => ({
                  ...current,
                  audienceScope: value,
                }))}
                options={ALERT_AUDIENCE_OPTIONS}
                menuAlign="left"
              />
            </div>

            <div>
              <label className="admin-form-label">{t('adminAlertsPage.form.startsAtLabel')}</label>
              <input
                className="admin-input"
                type="datetime-local"
                value={formData.startsAtLocal}
                onChange={(event) => setFormData((current) => ({
                  ...current,
                  startsAtLocal: event.target.value,
                }))}
              />
            </div>

            <div>
              <label className="admin-form-label">{t('adminAlertsPage.form.endsAtLabel')}</label>
              <input
                className="admin-input"
                type="datetime-local"
                value={formData.endsAtLocal}
                onChange={(event) => setFormData((current) => ({
                  ...current,
                  endsAtLocal: event.target.value,
                }))}
              />
            </div>

            <div>
              <label className="admin-form-label">{t('adminAlertsPage.form.deliveryChannels')}</label>
              <div
                style={{
                  display: 'flex',
                  gap: 8,
                  flexWrap: 'wrap',
                  minHeight: 34,
                  alignItems: 'center',
                }}
              >
                {[
                  { key: 'sendPush', label: t('adminAlertsPage.form.channelPush') },
                  { key: 'sendEmail', label: t('adminAlertsPage.form.channelEmail') },
                  { key: 'sendSms', label: t('adminAlertsPage.form.channelSms') },
                ].map((channel) => (
                  <label
                    key={channel.key}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      fontSize: 11,
                      color: 'var(--admin-text-secondary)',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={Boolean(formData[channel.key])}
                      onChange={(event) => setFormData((current) => ({
                        ...current,
                        [channel.key]: event.target.checked,
                      }))}
                    />
                    {channel.label}
                  </label>
                ))}
              </div>
            </div>
          </div>

          <div style={{ marginTop: 12 }}>
            <label className="admin-form-label">{t('adminAlertsPage.form.descriptionLabel')}</label>
            <textarea
              className="admin-textarea"
              rows={3}
              value={formData.description}
              onChange={(event) => setFormData((current) => ({
                ...current,
                description: event.target.value,
              }))}
              placeholder={t('adminAlertsPage.form.descriptionPlaceholder')}
            />
          </div>

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 12,
              flexWrap: 'wrap',
              marginTop: 14,
            }}
          >
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <label
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  fontSize: 11,
                  color: 'var(--admin-text-secondary)',
                }}
              >
                <input
                  type="checkbox"
                  checked={formData.notifyOnStart}
                  onChange={(event) => setFormData((current) => ({
                    ...current,
                    notifyOnStart: event.target.checked,
                  }))}
                />
                {t('adminAlertsPage.form.notifyOnStart')}
              </label>
              <label
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  fontSize: 11,
                  color: 'var(--admin-text-secondary)',
                }}
              >
                <input
                  type="checkbox"
                  checked={formData.notifyOnExpire}
                  onChange={(event) => setFormData((current) => ({
                    ...current,
                    notifyOnExpire: event.target.checked,
                  }))}
                />
                {t('adminAlertsPage.form.notifyOnExpire')}
              </label>
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button
                className="admin-btn admin-btn-ghost"
                onClick={() => setShowCreate(false)}
                disabled={isSubmitting}
                type="button"
              >
                {t('common:actions.close')}
              </button>
              <button
                className="admin-btn admin-btn-primary"
                onClick={handleSubmitAlert}
                disabled={isSubmitting}
                type="button"
              >
                {isSubmitting
                  ? formMode === 'edit'
                    ? t('adminAlertsPage.form.saving')
                    : t('adminAlertsPage.form.publishing')
                  : formMode === 'edit'
                    ? t('adminAlertsPage.form.saveChanges')
                    : t('adminAlertsPage.form.publishAlert')}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="admin-tabs" style={{ marginBottom: 12 }}>
        {TAB_DEFINITIONS.map((tab) => (
          <button
            key={tab.key}
            className={`admin-tab ${currentTab === tab.key ? 'active' : ''}`}
            onClick={() => setSearchParams({ tab: tab.key })}
            type="button"
          >
            {tab.label}
            <span className="tab-count">
              {tab.key === 'templates' ? tabCounts.templates : tabCounts[tab.key] ?? 0}
            </span>
          </button>
        ))}
      </div>

      {templateTabActive ? (
        templatesLoading ? (
          <div className="admin-card">
              <div className="admin-empty">
              <div className="admin-empty-icon">{'◈'}</div>
              <div className="admin-empty-text">{t('adminAlertsPage.templates.loading')}</div>
            </div>
          </div>
        ) : filteredTemplates.length === 0 ? (
          <div className="admin-card">
            <div className="admin-empty">
              <div className="admin-empty-icon">{'◈'}</div>
              <div className="admin-empty-text">
                {search
                  ? t('adminAlertsPage.templates.noMatch')
                  : t('adminAlertsPage.templates.empty')}
              </div>
            </div>
          </div>
        ) : (
          <div className="admin-grid-3">
            {filteredTemplates.map((template) => (
              <div className="admin-card" key={template.id}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <h3 className="admin-card-title">{template.name}</h3>
                  <span className={`admin-pill ${template.defaultSeverity}`}>
                    {template.defaultSeverity}
                  </span>
                </div>
                <p
                  style={{
                    fontSize: 11,
                    color: 'var(--admin-text-muted)',
                    marginTop: 6,
                    lineHeight: 1.5,
                  }}
                >
                  {template.description}
                </p>
                <div style={{ marginTop: 10, fontSize: 10.5, color: 'var(--admin-text-secondary)' }}>
                  {t('adminAlertsPage.templates.defaultDuration', { duration: template.defaultDuration })}
                </div>
                <div style={{ marginTop: 6, fontSize: 10.5, color: 'var(--admin-text-secondary)' }}>
                  {t('adminAlertsPage.templates.type', { type: formatAlertType(template.alertType) })}
                </div>
                <button
                  className="admin-btn admin-btn-ghost admin-btn-full"
                  style={{ marginTop: 10 }}
                  onClick={() => handleUseTemplate(template)}
                  type="button"
                >
                  {t('adminAlertsPage.templates.useTemplate')}
                </button>
              </div>
            ))}
          </div>
        )
      ) : (
        <>
          <div className="admin-card">
            <div className="admin-card-header">
              <div>
                <h2 className="admin-card-title">{t('adminAlertsPage.table.heading')}</h2>
                <p className="admin-card-subtitle">
                  {loading
                    ? t('adminAlertsPage.table.refreshing')
                    : t('adminAlertsPage.table.countSummary', { count: pagination.total, total: pagination.total.toLocaleString() })}
                </p>
              </div>
            </div>

            <div className="admin-table-wrapper">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>{t('adminAlertsPage.table.colId')}</th>
                    <th>{t('adminAlertsPage.table.colTitle')}</th>
                    <th>{t('adminAlertsPage.table.colZone')}</th>
                    <th>{t('adminAlertsPage.table.colSeverity')}</th>
                    <th>{t('adminAlertsPage.table.colType')}</th>
                    <th>{t('adminAlertsPage.table.colTrigger')}</th>
                    <th>{t('adminAlertsPage.table.colDuration')}</th>
                    <th>{t('adminAlertsPage.table.colAudience')}</th>
                    <th>{t('adminAlertsPage.table.colStatus')}</th>
                    <th>{t('adminAlertsPage.table.colActions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {alerts.map((alert) => (
                    <tr key={alert.id}>
                      <td style={{ fontWeight: 600, fontSize: 11, fontVariantNumeric: 'tabular-nums' }}>
                        {alert.displayId}
                      </td>
                      <td
                        style={{
                          maxWidth: 240,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          fontSize: 11.5,
                        }}
                        title={alert.title}
                      >
                        {alert.title}
                      </td>
                      <td style={{ fontSize: 11 }}>{alert.zone}</td>
                      <td><span className={`admin-pill ${alert.severity}`}>{alert.severity}</span></td>
                      <td style={{ fontSize: 11 }}>{formatAlertType(alert.type)}</td>
                      <td><span className={`admin-pill ${alert.trigger}`}>{alert.trigger}</span></td>
                      <td style={{ fontSize: 11, fontVariantNumeric: 'tabular-nums' }}>{alert.duration}</td>
                      <td style={{ fontSize: 11, fontVariantNumeric: 'tabular-nums' }}>
                        {getAudienceText(alert)}
                      </td>
                      <td><span className={`admin-pill ${alert.status}`}>{alert.status}</span></td>
                      <td>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button
                            className="admin-btn admin-btn-sm admin-btn-ghost"
                            onClick={() => openEditForm(alert.id)}
                            disabled={isSubmitting}
                            type="button"
                          >
                            {t('common:actions.edit')}
                          </button>
                          {(alert.status === 'active' || alert.status === 'scheduled') && (
                            <button
                              className="admin-btn admin-btn-sm admin-btn-danger"
                              onClick={() => setCancelTarget(alert)}
                              disabled={isSubmitting}
                              type="button"
                            >
                              {t('common:actions.cancel')}
                            </button>
                          )}
                          <button
                            className="admin-btn admin-btn-sm admin-btn-danger"
                            onClick={() => setDeleteTarget(alert)}
                            disabled={isSubmitting}
                            type="button"
                          >
                            {t('common:actions.delete')}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}

                  {!loading && alerts.length === 0 && (
                    <tr>
                      <td colSpan={10} style={{ textAlign: 'center', padding: 32, color: 'var(--admin-text-muted)' }}>
                        {currentTab === 'emergency'
                          ? t('adminAlertsPage.table.emptyEmergency')
                          : t('adminAlertsPage.table.emptyGeneric')}
                      </td>
                    </tr>
                  )}

                  {loading && alerts.length === 0 && (
                    <tr>
                      <td colSpan={10} style={{ textAlign: 'center', padding: 32, color: 'var(--admin-text-muted)' }}>
                        {t('adminAlertsPage.table.loadingAlerts')}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div
            className="admin-card"
            style={{
              marginTop: 12,
              padding: 14,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 12,
              flexWrap: 'wrap',
            }}
          >
            <div className="admin-card-subtitle" style={{ marginTop: 0 }}>
              {t('adminAlertsPage.pagination.showing', { returned: pagination.returned, total: pagination.total.toLocaleString() })}
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <button
                className="admin-btn admin-btn-ghost"
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                disabled={page <= 1 || loading}
                type="button"
              >
                {t('adminAlertsPage.pagination.previous')}
              </button>
              <span
                style={{
                  fontSize: 11,
                  color: 'var(--admin-text-secondary)',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {t('adminAlertsPage.pagination.pageOf', { page: pagination.page, totalPages: pagination.totalPages })}
              </span>
              <button
                className="admin-btn admin-btn-ghost"
                onClick={() => setPage((current) => Math.min(pagination.totalPages, current + 1))}
                disabled={page >= pagination.totalPages || loading}
                type="button"
              >
                {t('adminAlertsPage.pagination.next')}
              </button>
            </div>
          </div>
        </>
      )}
    </>
  )
}

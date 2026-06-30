import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import BuildOutlinedIcon from '@mui/icons-material/BuildOutlined'
import AddOutlinedIcon from '@mui/icons-material/AddOutlined'
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'

import PoliceShell from '../../components/layout/PoliceShell'
import {
  listInterventions,
  createInterventionApi,
  updateInterventionStatusApi,
} from '../../services/policeService'
import '../../styles/SupervisorMode.css'

const TYPES = ['speed_control', 'signage', 'roadwork', 'lighting', 'police_patrol', 'ambulance_response', 'other']
const STATUSES = ['planned', 'in_progress', 'completed', 'cancelled']
const STATUS_BADGE = {
  planned: 'sv-badge-medium',
  in_progress: 'sv-badge-accent',
  completed: 'sv-badge-low',
  cancelled: 'sv-badge-high',
}

const VISIBILITIES = ['', 'public', 'internal'] // '' = auto (default by type on the server)
const EMPTY_FORM = { type: 'speed_control', title: '', description: '', locationLabel: '', severityBefore: '', status: 'planned', visibility: '', roadSegmentId: null }

function formatDate(iso) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
  } catch {
    return '—'
  }
}

export default function SupervisorInterventionsPage() {
  const { t } = useTranslation(['supervisor', 'common'])
  const location = useLocation()
  const [data, setData] = useState({ items: [], stats: null })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [filters, setFilters] = useState({ status: '', type: '' })

  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState('')

  const [editTarget, setEditTarget] = useState(null)
  const [editForm, setEditForm] = useState({ status: 'in_progress', outcomeNote: '', severityAfter: '' })
  const [editSubmitting, setEditSubmitting] = useState(false)

  const queryParams = useMemo(() => {
    const p = {}
    if (filters.status) p.status = filters.status
    if (filters.type) p.type = filters.type
    return p
  }, [filters])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const result = await listInterventions(queryParams)
      setData(result)
      setError(null)
    } catch (err) {
      setError(err.message || t('supervisorInterventionsPage.errorLoad'))
    } finally {
      setLoading(false)
    }
  }, [queryParams, t])

  useEffect(() => {
    load()
  }, [load])

  // Prefill the create form when arriving from a Pilot Dashboard segment
  // ("Log intervention" → carries the road segment + label so the new
  // intervention is linked to it and plots on the operations map).
  useEffect(() => {
    const seg = location.state?.prefillSegment
    if (!seg) return
    setForm((prev) => ({
      ...EMPTY_FORM,
      type: prev.type,
      locationLabel: seg.locationLabel || '',
      roadSegmentId: seg.roadSegmentId ?? null,
    }))
    setShowForm(true)
  }, [location.state])

  const onFormChange = (e) => {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
    if (formError) setFormError('')
  }

  const submitForm = async (e) => {
    e.preventDefault()
    if (form.title.trim().length < 3) {
      setFormError(t('supervisorInterventionsPage.form.errorTitle'))
      return
    }
    setSubmitting(true)
    try {
      await createInterventionApi({
        type: form.type,
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        locationLabel: form.locationLabel.trim() || undefined,
        severityBefore: form.severityBefore ? Number(form.severityBefore) : undefined,
        status: form.status,
        visibility: form.visibility || undefined,
        roadSegmentId: form.roadSegmentId ?? undefined,
      })
      setForm(EMPTY_FORM)
      setShowForm(false)
      await load()
    } catch (err) {
      setFormError(err.message || t('supervisorInterventionsPage.form.errorSubmit'))
    } finally {
      setSubmitting(false)
    }
  }

  const openEdit = (item) => {
    setEditTarget(item)
    setEditForm({
      status: item.status === 'completed' ? 'completed' : item.status === 'cancelled' ? 'cancelled' : 'in_progress',
      outcomeNote: item.outcomeNote || '',
      severityAfter: item.severityAfter != null ? String(item.severityAfter) : '',
    })
  }

  const submitEdit = async (e) => {
    e.preventDefault()
    if (!editTarget) return
    setEditSubmitting(true)
    try {
      await updateInterventionStatusApi(editTarget.id, {
        status: editForm.status,
        outcomeNote: editForm.outcomeNote.trim() || undefined,
        severityAfter: editForm.severityAfter ? Number(editForm.severityAfter) : undefined,
      })
      setEditTarget(null)
      await load()
    } catch (err) {
      setError(err.message || t('supervisorInterventionsPage.errorUpdate'))
    } finally {
      setEditSubmitting(false)
    }
  }

  const stats = data.stats || {}

  return (
    <PoliceShell activeKey="interventions" rightPanelCollapsed>
      <div className="supervisor-page">
        <div className="sv-page-header">
          <div className="sv-page-title-block">
            <span className="sv-page-eyebrow">{t('supervisorInterventionsPage.eyebrow')}</span>
            <h1 className="sv-page-title">{t('supervisorInterventionsPage.title')}</h1>
            <p className="sv-page-subtitle">{t('supervisorInterventionsPage.subtitle')}</p>
          </div>
          <div className="sv-page-actions">
            <button className="sv-btn sv-btn-primary" onClick={() => setShowForm((v) => !v)}>
              <AddOutlinedIcon fontSize="small" /> {t('supervisorInterventionsPage.logIntervention')}
            </button>
            <button className="sv-btn sv-btn-ghost sv-btn-refresh" onClick={load} disabled={loading} aria-label={t('common:actions.retry')}><RefreshRoundedIcon fontSize="small" /></button>
          </div>
        </div>

        {error && <div className="sv-error" style={{ marginBottom: 20 }}>{error}</div>}

        {/* KPI bar */}
        <div className="sv-kpi-bar">
          <div className="sv-kpi-card kpi-primary">
            <div className="sv-kpi-label">{t('supervisorInterventionsPage.kpi.total')}</div>
            <div className="sv-kpi-value">{stats.total ?? 0}</div>
          </div>
          <div className="sv-kpi-card kpi-warning">
            <div className="sv-kpi-label">{t('supervisorInterventionsPage.kpi.planned')}</div>
            <div className="sv-kpi-value">{stats.planned ?? 0}</div>
          </div>
          <div className="sv-kpi-card kpi-accent">
            <div className="sv-kpi-label">{t('supervisorInterventionsPage.kpi.inProgress')}</div>
            <div className="sv-kpi-value">{stats.inProgress ?? 0}</div>
          </div>
          <div className="sv-kpi-card kpi-good">
            <div className="sv-kpi-label">{t('supervisorInterventionsPage.kpi.completed')}</div>
            <div className="sv-kpi-value">{stats.completed ?? 0}</div>
          </div>
        </div>

        {/* Create form */}
        {showForm && (
          <div className="sv-section" style={{ marginBottom: 20 }}>
            <div className="sv-section-head">
              <h2 className="sv-section-title">
                <span className="sv-section-title-icon"><BuildOutlinedIcon fontSize="inherit" /></span>
                {t('supervisorInterventionsPage.form.title')}
              </h2>
            </div>
            <div className="sv-section-body">
              <form onSubmit={submitForm}>
                <div className="sv-grid-2">
                  <div className="sv-form-group">
                    <label className="sv-form-label">{t('supervisorInterventionsPage.form.type')}</label>
                    <select className="sv-form-select" name="type" value={form.type} onChange={onFormChange}>
                      {TYPES.map((ty) => (
                        <option key={ty} value={ty}>{t(`supervisorInterventionsPage.types.${ty}`)}</option>
                      ))}
                    </select>
                  </div>
                  <div className="sv-form-group">
                    <label className="sv-form-label">{t('supervisorInterventionsPage.form.status')}</label>
                    <select className="sv-form-select" name="status" value={form.status} onChange={onFormChange}>
                      {['planned', 'in_progress'].map((s) => (
                        <option key={s} value={s}>{t(`supervisorInterventionsPage.statuses.${s}`)}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="sv-form-group">
                  <label className="sv-form-label">{t('supervisorInterventionsPage.form.titleLabel')}</label>
                  <input className="sv-form-input" name="title" value={form.title} onChange={onFormChange} placeholder={t('supervisorInterventionsPage.form.titlePlaceholder')} />
                </div>
                <div className="sv-grid-2">
                  <div className="sv-form-group">
                    <label className="sv-form-label">{t('supervisorInterventionsPage.form.location')}</label>
                    <input className="sv-form-input" name="locationLabel" value={form.locationLabel} onChange={onFormChange} placeholder={t('supervisorInterventionsPage.form.locationPlaceholder')} />
                  </div>
                  <div className="sv-form-group">
                    <label className="sv-form-label">{t('supervisorInterventionsPage.form.severityBefore')}</label>
                    <select className="sv-form-select" name="severityBefore" value={form.severityBefore} onChange={onFormChange}>
                      <option value="">{t('supervisorInterventionsPage.form.severityNone')}</option>
                      <option value="1">{t('supervisorInterventionsPage.severity.low')}</option>
                      <option value="2">{t('supervisorInterventionsPage.severity.medium')}</option>
                      <option value="3">{t('supervisorInterventionsPage.severity.high')}</option>
                    </select>
                  </div>
                </div>
                <div className="sv-grid-2">
                  <div className="sv-form-group">
                    <label className="sv-form-label">{t('supervisorInterventionsPage.form.visibility')}</label>
                    <select className="sv-form-select" name="visibility" value={form.visibility} onChange={onFormChange}>
                      <option value="">{t('supervisorInterventionsPage.form.visibilityAuto')}</option>
                      <option value="public">{t('supervisorInterventionsPage.visibility.public')}</option>
                      <option value="internal">{t('supervisorInterventionsPage.visibility.internal')}</option>
                    </select>
                    <p className="sv-form-hint">{t('supervisorInterventionsPage.form.visibilityHint')}</p>
                  </div>
                  {form.roadSegmentId ? (
                    <div className="sv-form-group">
                      <label className="sv-form-label">{t('supervisorInterventionsPage.form.linkedSegment')}</label>
                      <div><span className="sv-badge sv-badge-accent">#{form.roadSegmentId}{form.locationLabel ? ` · ${form.locationLabel}` : ''}</span></div>
                    </div>
                  ) : <div />}
                </div>
                <div className="sv-form-group">
                  <label className="sv-form-label">{t('supervisorInterventionsPage.form.description')}</label>
                  <textarea className="sv-form-textarea" name="description" rows={3} value={form.description} onChange={onFormChange} placeholder={t('supervisorInterventionsPage.form.descriptionPlaceholder')} />
                </div>
                {formError && <p className="sv-form-error">{formError}</p>}
                <div style={{ display: 'flex', gap: 8 }}>
                  <button type="submit" className="sv-btn sv-btn-primary" disabled={submitting}>
                    {submitting ? t('supervisorInterventionsPage.form.saving') : t('supervisorInterventionsPage.form.save')}
                  </button>
                  <button type="button" className="sv-btn sv-btn-ghost" onClick={() => { setShowForm(false); setForm(EMPTY_FORM); setFormError('') }}>
                    {t('common:actions.cancel')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Filters + table */}
        <div className="sv-section">
          <div className="sv-section-head">
            <h2 className="sv-section-title">
              <span className="sv-section-title-icon"><BuildOutlinedIcon fontSize="inherit" /></span>
              {t('supervisorInterventionsPage.sections.log')}
            </h2>
            <div style={{ display: 'flex', gap: 8 }}>
              <select className="sv-form-select" style={{ width: 'auto' }} value={filters.status} onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}>
                <option value="">{t('supervisorInterventionsPage.filters.allStatuses')}</option>
                {STATUSES.map((s) => <option key={s} value={s}>{t(`supervisorInterventionsPage.statuses.${s}`)}</option>)}
              </select>
              <select className="sv-form-select" style={{ width: 'auto' }} value={filters.type} onChange={(e) => setFilters((f) => ({ ...f, type: e.target.value }))}>
                <option value="">{t('supervisorInterventionsPage.filters.allTypes')}</option>
                {TYPES.map((ty) => <option key={ty} value={ty}>{t(`supervisorInterventionsPage.types.${ty}`)}</option>)}
              </select>
            </div>
          </div>
          <div className="sv-section-body">
            {loading ? (
              <div className="sv-loading" style={{ padding: 48 }}>
                <div className="sv-loading-spinner" />
                <span>{t('supervisorInterventionsPage.loading')}</span>
              </div>
            ) : data.items.length === 0 ? (
              <div className="sv-empty"><span className="sv-empty-icon"><BuildOutlinedIcon fontSize="inherit" /></span>{t('supervisorInterventionsPage.empty')}</div>
            ) : (
              <div className="sv-table-wrap">
                <table className="sv-table">
                  <thead>
                    <tr>
                      <th>{t('supervisorInterventionsPage.table.type')}</th>
                      <th>{t('supervisorInterventionsPage.table.titleCol')}</th>
                      <th>{t('supervisorInterventionsPage.table.location')}</th>
                      <th>{t('supervisorInterventionsPage.table.status')}</th>
                      <th>{t('supervisorInterventionsPage.table.outcome')}</th>
                      <th>{t('supervisorInterventionsPage.table.created')}</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.items.map((item) => (
                      <tr key={item.id}>
                        <td>{t(`supervisorInterventionsPage.types.${item.type}`)}</td>
                        <td style={{ fontWeight: 600 }}>{item.title}</td>
                        <td style={{ color: 'var(--sv-text-muted)' }}>{item.roadName || item.locationLabel || '—'}</td>
                        <td>
                          <span className={`sv-badge ${STATUS_BADGE[item.status] || 'sv-badge-low'}`}>
                            {t(`supervisorInterventionsPage.statuses.${item.status}`)}
                          </span>
                        </td>
                        <td style={{ color: 'var(--sv-text-muted)', maxWidth: 200 }}>{item.outcomeNote || '—'}</td>
                        <td style={{ color: 'var(--sv-text-muted)', fontSize: 12 }}>{formatDate(item.createdAt)}</td>
                        <td>
                          <button className="sv-btn sv-btn-ghost" style={{ padding: '4px 8px' }} onClick={() => openEdit(item)} aria-label={t('supervisorInterventionsPage.updateStatus')}>
                            <EditOutlinedIcon fontSize="small" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Update status modal */}
        {editTarget && (
          <div className="sv-modal-backdrop" onClick={() => setEditTarget(null)}>
            <div className="sv-modal" onClick={(e) => e.stopPropagation()}>
              <div className="sv-modal-head">
                <h3 className="sv-modal-title">{t('supervisorInterventionsPage.updateModal.title')}</h3>
                <button className="sv-modal-close" onClick={() => setEditTarget(null)} aria-label={t('common:actions.cancel')}>×</button>
              </div>
              <form onSubmit={submitEdit} style={{ padding: '4px 4px 0' }}>
                <p style={{ marginTop: 0, color: 'var(--sv-text-muted)' }}>{editTarget.title}</p>
                <div className="sv-form-group">
                  <label className="sv-form-label">{t('supervisorInterventionsPage.form.status')}</label>
                  <select className="sv-form-select" value={editForm.status} onChange={(e) => setEditForm((f) => ({ ...f, status: e.target.value }))}>
                    {STATUSES.map((s) => <option key={s} value={s}>{t(`supervisorInterventionsPage.statuses.${s}`)}</option>)}
                  </select>
                </div>
                <div className="sv-form-group">
                  <label className="sv-form-label">{t('supervisorInterventionsPage.updateModal.outcome')}</label>
                  <textarea className="sv-form-textarea" rows={3} value={editForm.outcomeNote} onChange={(e) => setEditForm((f) => ({ ...f, outcomeNote: e.target.value }))} placeholder={t('supervisorInterventionsPage.updateModal.outcomePlaceholder')} />
                </div>
                <div className="sv-form-group">
                  <label className="sv-form-label">{t('supervisorInterventionsPage.updateModal.severityAfter')}</label>
                  <select className="sv-form-select" value={editForm.severityAfter} onChange={(e) => setEditForm((f) => ({ ...f, severityAfter: e.target.value }))}>
                    <option value="">{t('supervisorInterventionsPage.form.severityNone')}</option>
                    <option value="1">{t('supervisorInterventionsPage.severity.low')}</option>
                    <option value="2">{t('supervisorInterventionsPage.severity.medium')}</option>
                    <option value="3">{t('supervisorInterventionsPage.severity.high')}</option>
                  </select>
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  <button type="submit" className="sv-btn sv-btn-primary" disabled={editSubmitting}>
                    {editSubmitting ? t('supervisorInterventionsPage.form.saving') : t('supervisorInterventionsPage.updateModal.save')}
                  </button>
                  <button type="button" className="sv-btn sv-btn-ghost" onClick={() => setEditTarget(null)}>{t('common:actions.cancel')}</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </PoliceShell>
  )
}

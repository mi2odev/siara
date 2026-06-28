import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import {
  createDangerSubscription,
  deleteDangerSubscription,
  listMyDangerSubscriptions,
  updateDangerSubscription,
} from '../../services/dangerSubscriptionsService'
import DangerSubscriptionForm from '../../components/alerts/DangerSubscriptionForm'
import LeftNavLayout from '../../components/layout/LeftNavLayout'
import '../../styles/DangerSubscriptions.css'

function thresholdLabel(value, t) {
  switch (value) {
    case 'low':
      return t('dangerSubscriptionsPage.threshold.low')
    case 'moderate':
      return t('dangerSubscriptionsPage.threshold.moderate')
    case 'high':
      return t('dangerSubscriptionsPage.threshold.high')
    case 'extreme':
      return t('dangerSubscriptionsPage.threshold.extreme')
    default:
      return value
  }
}

function locationSummary(item, t) {
  if (item.type === 'route') {
    const points = Array.isArray(item.geometry?.path) ? item.geometry.path.length : 0
    return points
      ? t('dangerSubscriptionsPage.location.routePoints', { count: points })
      : t('dangerSubscriptionsPage.location.routeSubscription')
  }
  if (item.centerLat == null || item.centerLng == null) return '—'
  return `${Number(item.centerLat).toFixed(3)}, ${Number(item.centerLng).toFixed(3)} · ${
    item.radiusMeters != null
      ? t('dangerSubscriptionsPage.location.radius', { meters: Math.round(item.radiusMeters) })
      : t('dangerSubscriptionsPage.location.radiusNA')
  }`
}

export default function DangerSubscriptionsPage() {
  const { t } = useTranslation(['alerts', 'common'])
  const [items, setItems] = useState([])
  const [state, setState] = useState('loading')
  const [error, setError] = useState('')
  const [editing, setEditing] = useState(null)
  const [creating, setCreating] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const load = useCallback(async () => {
    setState('loading')
    setError('')
    try {
      const data = await listMyDangerSubscriptions()
      setItems(data)
      setState('success')
    } catch (err) {
      setError(err?.message || t('dangerSubscriptionsPage.errors.loadFailed'))
      setState('error')
    }
  }, [t])

  useEffect(() => {
    load()
  }, [load])

  const handleSave = async (payload) => {
    setSubmitting(true)
    try {
      if (editing?.id) {
        const updated = await updateDangerSubscription(editing.id, payload)
        setItems((prev) => prev.map((it) => (it.id === editing.id ? updated : it)))
      } else {
        const created = await createDangerSubscription(payload)
        setItems((prev) => [created, ...prev])
      }
      setEditing(null)
      setCreating(false)
    } catch (err) {
      setError(err?.message || t('dangerSubscriptionsPage.errors.saveFailed'))
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (item) => {
    if (typeof window !== 'undefined' && !window.confirm(t('dangerSubscriptionsPage.confirmDelete', { name: item.name }))) {
      return
    }
    try {
      await deleteDangerSubscription(item.id)
      setItems((prev) => prev.filter((it) => it.id !== item.id))
    } catch (err) {
      setError(err?.message || t('dangerSubscriptionsPage.errors.deleteFailed'))
    }
  }

  return (
    <LeftNavLayout activeKey="alerts">
    <div className="siara-ds-page">
      <div className="siara-ds-page__header">
        <div>
          <h1 className="siara-ds-page__title">{t('dangerSubscriptionsPage.title')}</h1>
          <p className="siara-ds-page__sub">
            {t('dangerSubscriptionsPage.subtitle')}
          </p>
        </div>
        {!creating && !editing ? (
          <button
            type="button"
            className="siara-ds-page__btn"
            onClick={() => setCreating(true)}
          >
            {t('dangerSubscriptionsPage.newSubscription')}
          </button>
        ) : null}
      </div>

      {error ? <p className="siara-ds-error">{error}</p> : null}

      {creating ? (
        <DangerSubscriptionForm
          onSubmit={handleSave}
          onCancel={() => setCreating(false)}
          busy={submitting}
        />
      ) : null}

      {editing ? (
        <DangerSubscriptionForm
          initial={editing}
          onSubmit={handleSave}
          onCancel={() => setEditing(null)}
          busy={submitting}
        />
      ) : null}

      {state === 'loading' ? (
        <p className="siara-ds-empty">{t('dangerSubscriptionsPage.loading')}</p>
      ) : null}

      {state === 'success' && items.length === 0 && !creating ? (
        <p className="siara-ds-empty">
          {t('dangerSubscriptionsPage.emptyState')}
        </p>
      ) : null}

      {state === 'success' && items.length > 0 ? (
        <div className="siara-ds-list">
          {items.map((item) => (
            <div key={item.id} className="siara-ds-card">
              <div className="siara-ds-card__header">
                <h3 className="siara-ds-card__title">{item.name}</h3>
                <span className="siara-ds-card__type">{item.type}</span>
              </div>
              <div className="siara-ds-card__meta">
                <span>{locationSummary(item, t)}</span>
                <span>•</span>
                <span>{t('dangerSubscriptionsPage.thresholdLabel', { label: thresholdLabel(item.riskThreshold, t) })}</span>
                {item.notifyOnReports ? <span>• {t('dangerSubscriptionsPage.notify.reports')}</span> : null}
                {item.notifyOnHighRisk ? <span>• {t('dangerSubscriptionsPage.notify.risk')}</span> : null}
                {item.notifyOnPoliceVerified ? <span>• {t('dangerSubscriptionsPage.notify.policeVerified')}</span> : null}
                <span
                  className={`siara-ds-card__pill ${item.isActive ? 'is-active' : 'is-inactive'}`}
                >
                  {item.isActive ? t('dangerSubscriptionsPage.status.active') : t('dangerSubscriptionsPage.status.paused')}
                </span>
              </div>
              <div className="siara-ds-card__actions">
                <button
                  type="button"
                  className="siara-ds-page__btn siara-ds-page__btn--ghost"
                  onClick={() => setEditing(item)}
                >
                  {t('common:actions.edit')}
                </button>
                <button
                  type="button"
                  className="siara-ds-page__btn siara-ds-page__btn--danger"
                  onClick={() => handleDelete(item)}
                >
                  {t('common:actions.delete')}
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
    </LeftNavLayout>
  )
}

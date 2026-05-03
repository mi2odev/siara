import { useCallback, useEffect, useState } from 'react'

import {
  createDangerSubscription,
  deleteDangerSubscription,
  listMyDangerSubscriptions,
  updateDangerSubscription,
} from '../../services/dangerSubscriptionsService'
import DangerSubscriptionForm from '../../components/alerts/DangerSubscriptionForm'
import '../../styles/DangerSubscriptions.css'

function thresholdLabel(value) {
  switch (value) {
    case 'low':
      return 'Any risk'
    case 'moderate':
      return 'Moderate+'
    case 'high':
      return 'High+'
    case 'extreme':
      return 'Extreme only'
    default:
      return value
  }
}

function locationSummary(item) {
  if (item.type === 'route') {
    const points = Array.isArray(item.geometry?.path) ? item.geometry.path.length : 0
    return points ? `${points} route points` : 'route subscription'
  }
  if (item.centerLat == null || item.centerLng == null) return '—'
  return `${Number(item.centerLat).toFixed(3)}, ${Number(item.centerLng).toFixed(3)} · ${
    item.radiusMeters != null ? `${Math.round(item.radiusMeters)} m radius` : 'radius n/a'
  }`
}

export default function DangerSubscriptionsPage() {
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
      setError(err?.message || 'Failed to load subscriptions')
      setState('error')
    }
  }, [])

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
      setError(err?.message || 'Failed to save subscription')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (item) => {
    if (typeof window !== 'undefined' && !window.confirm(`Delete subscription "${item.name}"?`)) {
      return
    }
    try {
      await deleteDangerSubscription(item.id)
      setItems((prev) => prev.filter((it) => it.id !== item.id))
    } catch (err) {
      setError(err?.message || 'Failed to delete subscription')
    }
  }

  return (
    <div className="siara-ds-page">
      <div className="siara-ds-page__header">
        <div>
          <h1 className="siara-ds-page__title">Danger subscriptions</h1>
          <p className="siara-ds-page__sub">
            Get alerted when accidents are reported or risk rises in zones,
            points, or routes you care about.
          </p>
        </div>
        {!creating && !editing ? (
          <button
            type="button"
            className="siara-ds-page__btn"
            onClick={() => setCreating(true)}
          >
            + New subscription
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
        <p className="siara-ds-empty">Loading your subscriptions…</p>
      ) : null}

      {state === 'success' && items.length === 0 && !creating ? (
        <p className="siara-ds-empty">
          You don't have any danger subscriptions yet. Click <strong>+ New
          subscription</strong> to get alerts for a zone, point, or route.
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
                <span>{locationSummary(item)}</span>
                <span>•</span>
                <span>Threshold: {thresholdLabel(item.riskThreshold)}</span>
                {item.notifyOnReports ? <span>• reports</span> : null}
                {item.notifyOnHighRisk ? <span>• risk</span> : null}
                {item.notifyOnPoliceVerified ? <span>• police-verified</span> : null}
                <span
                  className={`siara-ds-card__pill ${item.isActive ? 'is-active' : 'is-inactive'}`}
                >
                  {item.isActive ? 'Active' : 'Paused'}
                </span>
              </div>
              <div className="siara-ds-card__actions">
                <button
                  type="button"
                  className="siara-ds-page__btn siara-ds-page__btn--ghost"
                  onClick={() => setEditing(item)}
                >
                  Edit
                </button>
                <button
                  type="button"
                  className="siara-ds-page__btn siara-ds-page__btn--danger"
                  onClick={() => handleDelete(item)}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}

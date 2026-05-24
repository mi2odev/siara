import { useEffect, useState } from 'react'
import FancySelect from '../ui/FancySelect'

const DEFAULT_FORM = {
  name: '',
  type: 'zone',
  centerLat: '',
  centerLng: '',
  radiusMeters: 1500,
  riskThreshold: 'high',
  notifyOnReports: true,
  notifyOnHighRisk: true,
  notifyOnPoliceVerified: true,
  isActive: true,
}

export default function DangerSubscriptionForm({ initial, onSubmit, onCancel, busy = false }) {
  const [form, setForm] = useState(DEFAULT_FORM)
  const [error, setError] = useState('')

  useEffect(() => {
    if (initial) {
      setForm({
        name: initial.name || '',
        type: initial.type || 'zone',
        centerLat: initial.centerLat ?? '',
        centerLng: initial.centerLng ?? '',
        radiusMeters: initial.radiusMeters ?? 1500,
        riskThreshold: initial.riskThreshold || 'high',
        notifyOnReports: initial.notifyOnReports !== false,
        notifyOnHighRisk: initial.notifyOnHighRisk !== false,
        notifyOnPoliceVerified: initial.notifyOnPoliceVerified !== false,
        isActive: initial.isActive !== false,
      })
    } else {
      setForm(DEFAULT_FORM)
    }
    setError('')
  }, [initial])

  const update = (patch) => setForm((prev) => ({ ...prev, ...patch }))

  const handleSubmit = (event) => {
    event.preventDefault()
    setError('')
    const trimmed = String(form.name || '').trim()
    if (!trimmed) {
      setError('Give this subscription a short name (e.g. Home, Work, Route to office).')
      return
    }
    if ((form.type === 'zone' || form.type === 'point') &&
        (!Number.isFinite(Number(form.centerLat)) || !Number.isFinite(Number(form.centerLng)))) {
      setError('Centre lat/lng are required for zone and point subscriptions.')
      return
    }
    onSubmit?.({
      ...form,
      name: trimmed.slice(0, 80),
      centerLat: form.centerLat === '' ? null : Number(form.centerLat),
      centerLng: form.centerLng === '' ? null : Number(form.centerLng),
      radiusMeters: form.radiusMeters === '' ? null : Number(form.radiusMeters),
    })
  }

  return (
    <form className="siara-ds-form" onSubmit={handleSubmit}>
      <div className="siara-ds-form__row">
        <span className="siara-ds-form__label">Name</span>
        <input
          className="siara-ds-form__input"
          value={form.name}
          onChange={(e) => update({ name: e.target.value })}
          placeholder="Home, Work, University, …"
          maxLength={80}
        />
      </div>

      <div className="siara-ds-form__row siara-ds-form__row--two">
        <div>
          <span className="siara-ds-form__label">Type</span>
          <FancySelect
            value={form.type}
            onChange={(value) => update({ type: value })}
            menuAlign="left"
            options={[
              { value: 'zone',  label: 'Zone (centre + radius)' },
              { value: 'point', label: 'Point (small area around a place)' },
              { value: 'route', label: 'Route — set up from the map (coming soon)' },
            ]}
          />
        </div>
        <div>
          <span className="siara-ds-form__label">Risk threshold</span>
          <FancySelect
            value={form.riskThreshold}
            onChange={(value) => update({ riskThreshold: value })}
            menuAlign="left"
            options={[
              { value: 'low',      label: 'Notify on any risk' },
              { value: 'moderate', label: 'Notify on moderate or higher' },
              { value: 'high',     label: 'Notify on high or higher' },
              { value: 'extreme',  label: 'Notify on extreme only' },
            ]}
          />
        </div>
      </div>

      <div className="siara-ds-form__row siara-ds-form__row--two">
        <div>
          <span className="siara-ds-form__label">Centre latitude</span>
          <input
            className="siara-ds-form__input"
            type="number"
            step="0.0001"
            value={form.centerLat}
            onChange={(e) => update({ centerLat: e.target.value })}
            placeholder="36.7538"
          />
        </div>
        <div>
          <span className="siara-ds-form__label">Centre longitude</span>
          <input
            className="siara-ds-form__input"
            type="number"
            step="0.0001"
            value={form.centerLng}
            onChange={(e) => update({ centerLng: e.target.value })}
            placeholder="3.0588"
          />
        </div>
      </div>

      <div className="siara-ds-form__row">
        <span className="siara-ds-form__label">Radius (meters)</span>
        <input
          className="siara-ds-form__input"
          type="number"
          min={100}
          max={50000}
          step={100}
          value={form.radiusMeters}
          onChange={(e) => update({ radiusMeters: e.target.value })}
        />
        <span className="siara-ds-form__hint">
          Between 100 m and 50 km. Default 1500 m for zones, 500 m for points.
        </span>
      </div>

      <div className="siara-ds-form__row">
        <label className="siara-ds-form__checkbox">
          <input
            type="checkbox"
            checked={form.notifyOnReports}
            onChange={(e) => update({ notifyOnReports: e.target.checked })}
          />
          Notify me about new accident reports
        </label>
        <label className="siara-ds-form__checkbox">
          <input
            type="checkbox"
            checked={form.notifyOnHighRisk}
            onChange={(e) => update({ notifyOnHighRisk: e.target.checked })}
          />
          Notify me when overall risk crosses my threshold
        </label>
        <label className="siara-ds-form__checkbox">
          <input
            type="checkbox"
            checked={form.notifyOnPoliceVerified}
            onChange={(e) => update({ notifyOnPoliceVerified: e.target.checked })}
          />
          Notify me about police-verified incidents
        </label>
        <label className="siara-ds-form__checkbox">
          <input
            type="checkbox"
            checked={form.isActive}
            onChange={(e) => update({ isActive: e.target.checked })}
          />
          Active
        </label>
      </div>

      {error ? (
        <p style={{
          color: '#B91C1C',
          background: '#FEF2F2',
          border: '1px solid #FECACA',
          borderRadius: 8,
          padding: 8,
          fontSize: 12,
          margin: 0,
        }}>
          {error}
        </p>
      ) : null}

      <div className="siara-ds-form__actions">
        {typeof onCancel === 'function' ? (
          <button
            type="button"
            className="siara-ds-page__btn siara-ds-page__btn--ghost"
            onClick={onCancel}
            disabled={busy}
          >
            Cancel
          </button>
        ) : null}
        <button
          type="submit"
          className="siara-ds-page__btn"
          disabled={busy}
        >
          {busy ? 'Saving…' : initial?.id ? 'Save changes' : 'Create subscription'}
        </button>
      </div>
    </form>
  )
}

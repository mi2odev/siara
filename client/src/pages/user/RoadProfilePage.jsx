import { useEffect, useState, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'

import RoadSafetyProfileCard from '../../components/road/RoadSafetyProfileCard'
import { getZoneProfile } from '../../services/zoneProfileService'
import '../../styles/RoadSafetyProfile.css'

export default function RoadProfilePage() {
  const [params, setParams] = useSearchParams()
  const [lat, setLat] = useState(() => params.get('lat') || '')
  const [lng, setLng] = useState(() => params.get('lng') || '')
  const [radius, setRadius] = useState(() => params.get('radiusMeters') || '500')

  const [profile, setProfile] = useState(null)
  const [state, setState] = useState('idle')
  const [error, setError] = useState('')

  const load = useCallback(
    async (latVal, lngVal, radiusVal) => {
      const latNum = Number(latVal)
      const lngNum = Number(lngVal)
      if (!Number.isFinite(latNum) || !Number.isFinite(lngNum)) {
        setError('Enter valid latitude and longitude.')
        setState('error')
        return
      }
      setState('loading')
      setError('')
      try {
        const data = await getZoneProfile({
          lat: latNum,
          lng: lngNum,
          radiusMeters: Number(radiusVal) || 500,
        })
        setProfile(data)
        setState('success')
      } catch (err) {
        setError(err?.message || 'Failed to load profile')
        setState('error')
      }
    },
    [],
  )

  useEffect(() => {
    if (lat && lng) {
      load(lat, lng, radius)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleSubmit = (event) => {
    event.preventDefault()
    setParams({ lat, lng, radiusMeters: radius })
    load(lat, lng, radius)
  }

  return (
    <div className="siara-zp__page">
      <div className="siara-zp__page-header">
        <h1 className="siara-zp__page-title">Road / zone safety profile</h1>
        <p className="siara-zp__page-sub">
          Look up the accident-history fingerprint of any zone — peak hours,
          common report types, recent activity, and trend.
        </p>
      </div>

      <form className="siara-zp__form" onSubmit={handleSubmit}>
        <div>
          <label htmlFor="zp-lat" style={{ fontSize: 11, fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>
            Latitude
          </label>
          <input
            id="zp-lat"
            type="number"
            step="0.0001"
            value={lat}
            onChange={(e) => setLat(e.target.value)}
            placeholder="36.7538"
          />
        </div>
        <div>
          <label htmlFor="zp-lng" style={{ fontSize: 11, fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>
            Longitude
          </label>
          <input
            id="zp-lng"
            type="number"
            step="0.0001"
            value={lng}
            onChange={(e) => setLng(e.target.value)}
            placeholder="3.0588"
          />
        </div>
        <div>
          <label htmlFor="zp-radius" style={{ fontSize: 11, fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>
            Radius (m)
          </label>
          <input
            id="zp-radius"
            type="number"
            min={100}
            max={5000}
            step={50}
            value={radius}
            onChange={(e) => setRadius(e.target.value)}
          />
        </div>
        <button type="submit" disabled={state === 'loading'}>
          {state === 'loading' ? 'Loading…' : 'Load profile'}
        </button>
      </form>

      {state === 'loading' ? (
        <p className="siara-zp__loading">Loading profile…</p>
      ) : null}

      {state === 'error' ? <p className="siara-zp__error">{error}</p> : null}

      {state === 'success' && profile ? (
        <RoadSafetyProfileCard profile={profile} />
      ) : null}

      {state === 'success' && profile && profile.reportCount === 0 ? (
        <p className="siara-zp__empty">
          No accident reports recorded in this area. Try a larger radius or a
          different point.
        </p>
      ) : null}
    </div>
  )
}

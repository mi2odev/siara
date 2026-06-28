import { useEffect, useState, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

import RoadSafetyProfileCard from '../../components/road/RoadSafetyProfileCard'
import { getZoneProfile } from '../../services/zoneProfileService'
import LeftNavLayout from '../../components/layout/LeftNavLayout'
import '../../styles/RoadSafetyProfile.css'

export default function RoadProfilePage() {
  const { t } = useTranslation(['pages', 'common'])
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
        setError(t('roadProfilePage.errors.invalidCoords'))
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
        setError(err?.message || t('roadProfilePage.errors.loadFailed'))
        setState('error')
      }
    },
    [t],
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
    <LeftNavLayout activeKey="map">
    <div className="siara-zp__page">
      <div className="siara-zp__page-header">
        <h1 className="siara-zp__page-title">{t('roadProfilePage.title')}</h1>
        <p className="siara-zp__page-sub">
          {t('roadProfilePage.subtitle')}
        </p>
      </div>

      <form className="siara-zp__form" onSubmit={handleSubmit}>
        <div>
          <label htmlFor="zp-lat" style={{ fontSize: 11, fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>
            {t('roadProfilePage.fields.latitude')}
          </label>
          <input
            id="zp-lat"
            type="number"
            step="0.0001"
            value={lat}
            onChange={(e) => setLat(e.target.value)}
            placeholder={t('roadProfilePage.fields.latitudePlaceholder')}
          />
        </div>
        <div>
          <label htmlFor="zp-lng" style={{ fontSize: 11, fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>
            {t('roadProfilePage.fields.longitude')}
          </label>
          <input
            id="zp-lng"
            type="number"
            step="0.0001"
            value={lng}
            onChange={(e) => setLng(e.target.value)}
            placeholder={t('roadProfilePage.fields.longitudePlaceholder')}
          />
        </div>
        <div>
          <label htmlFor="zp-radius" style={{ fontSize: 11, fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>
            {t('roadProfilePage.fields.radius')}
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
          {state === 'loading' ? t('common:actions.loading') : t('roadProfilePage.actions.loadProfile')}
        </button>
      </form>

      {state === 'loading' ? (
        <p className="siara-zp__loading">{t('roadProfilePage.status.loadingProfile')}</p>
      ) : null}

      {state === 'error' ? <p className="siara-zp__error">{error}</p> : null}

      {state === 'success' && profile ? (
        <RoadSafetyProfileCard profile={profile} />
      ) : null}

      {state === 'success' && profile && profile.reportCount === 0 ? (
        <p className="siara-zp__empty">
          {t('roadProfilePage.status.noReports')}
        </p>
      ) : null}
    </div>
    </LeftNavLayout>
  )
}

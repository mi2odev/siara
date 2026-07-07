import React, { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import LocationOnOutlinedIcon from '@mui/icons-material/LocationOnOutlined'
import SearchOutlinedIcon from '@mui/icons-material/SearchOutlined'
import MyLocationOutlinedIcon from '@mui/icons-material/MyLocationOutlined'
import CloseRoundedIcon from '@mui/icons-material/CloseRounded'
import './ManualLocationControl.css'

const NOMINATIM_SEARCH_URL = 'https://nominatim.openstreetmap.org/search'
const SEARCH_DEBOUNCE_MS = 400

function normalizeResult(item) {
  const lat = Number(item?.lat)
  const lng = Number(item?.lon)
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
  const parts = String(item?.display_name || '').split(',').map((p) => p.trim()).filter(Boolean)
  const label = parts.slice(0, 3).join(', ') || String(item?.display_name || '').trim()
  return {
    id: String(item?.place_id || `${lat}:${lng}`),
    label: label || `${lat.toFixed(4)}, ${lng.toFixed(4)}`,
    fullLabel: String(item?.display_name || label),
    lat,
    lng,
  }
}

/**
 * Lets the user set their location by searching a place, for when the browser's
 * GPS is unavailable (common on desktop). The chosen point drives risk, weather,
 * and the safety overlay just like a real GPS fix. Persistence + application to
 * the map is handled by the parent (MapPage).
 */
export default function ManualLocationControl({ currentLocation, locationStatus, onSet, onClear }) {
  const { t } = useTranslation(['map', 'common'])
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [open, setOpen] = useState(false)
  const [error, setError] = useState('')
  const boxRef = useRef(null)
  const inputRef = useRef(null)
  const focusedOnDenialRef = useRef(false)

  const isManual = locationStatus === 'manual' && currentLocation
  // GPS was blocked/denied and no manual point is set yet — surface the search
  // as the obvious next step instead of leaving the user stuck on a dead map.
  const isDenied = locationStatus === 'denied' && !isManual

  // When location first gets denied, draw attention to the search box once
  // (without hijacking scroll) so the recovery path is impossible to miss.
  useEffect(() => {
    if (isDenied && !focusedOnDenialRef.current) {
      focusedOnDenialRef.current = true
      inputRef.current?.focus?.({ preventScroll: true })
    }
    if (!isDenied) {
      focusedOnDenialRef.current = false
    }
  }, [isDenied])

  // Debounced geocoding search (Algeria-biased).
  useEffect(() => {
    const trimmed = query.trim()
    if (trimmed.length < 3) {
      setResults([])
      setSearching(false)
      return undefined
    }

    const controller = new AbortController()
    const timer = setTimeout(async () => {
      setSearching(true)
      setError('')
      try {
        const url = `${NOMINATIM_SEARCH_URL}?format=jsonv2&addressdetails=1&limit=6&countrycodes=dz&q=${encodeURIComponent(trimmed)}`
        const response = await fetch(url, { signal: controller.signal, headers: { Accept: 'application/json' } })
        if (!response.ok) throw new Error('search failed')
        const data = await response.json()
        if (controller.signal.aborted) return
        setResults((Array.isArray(data) ? data : []).map(normalizeResult).filter(Boolean))
        setOpen(true)
      } catch (searchError) {
        if (controller.signal.aborted || searchError.name === 'AbortError') return
        setError(t('mapPage.manualLocation.searchError'))
        setResults([])
      } finally {
        if (!controller.signal.aborted) setSearching(false)
      }
    }, SEARCH_DEBOUNCE_MS)

    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [query, t])

  // Close the suggestions dropdown on outside click.
  useEffect(() => {
    if (!open) return undefined
    const onDocClick = (event) => {
      if (boxRef.current && !boxRef.current.contains(event.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [open])

  function handlePick(result) {
    onSet?.({ lat: result.lat, lng: result.lng, label: result.label })
    setQuery('')
    setResults([])
    setOpen(false)
    setError('')
  }

  return (
    <div className={`siara-manual-loc${isDenied ? ' is-denied' : ''}`} ref={boxRef}>
      <div className="siara-manual-loc__head">
        <span className="siara-manual-loc__title">
          <LocationOnOutlinedIcon fontSize="inherit" /> {t('mapPage.manualLocation.title')}
        </span>
      </div>

      {isManual ? (
        <div className="siara-manual-loc__current">
          <span className="siara-manual-loc__pin"><LocationOnOutlinedIcon fontSize="inherit" /></span>
          <span className="siara-manual-loc__label" title={currentLocation.label}>
            {currentLocation.label || `${currentLocation.lat.toFixed(4)}, ${currentLocation.lng.toFixed(4)}`}
          </span>
          <button
            type="button"
            className="siara-manual-loc__reset"
            onClick={() => onClear?.()}
            title={t('mapPage.manualLocation.useGps')}
          >
            <MyLocationOutlinedIcon fontSize="inherit" /> {t('mapPage.manualLocation.useGps')}
          </button>
        </div>
      ) : isDenied ? (
        <p className="siara-manual-loc__hint is-denied" role="status">
          {t('mapPage.manualLocation.deniedPrompt')}
        </p>
      ) : (
        <p className="siara-manual-loc__hint">{t('mapPage.manualLocation.hint')}</p>
      )}

      <div className="siara-manual-loc__search">
        <span className="siara-manual-loc__search-icon"><SearchOutlinedIcon fontSize="inherit" /></span>
        <input
          ref={inputRef}
          className="siara-manual-loc__input"
          type="text"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onFocus={() => results.length > 0 && setOpen(true)}
          placeholder={t('mapPage.manualLocation.searchPlaceholder')}
          aria-label={t('mapPage.manualLocation.searchPlaceholder')}
        />
        {query && (
          <button
            type="button"
            className="siara-manual-loc__clear"
            onClick={() => { setQuery(''); setResults([]); setOpen(false) }}
            aria-label={t('common:actions.clear', { defaultValue: 'Clear' })}
          >
            <CloseRoundedIcon fontSize="inherit" />
          </button>
        )}

        {open && (results.length > 0 || searching || error) && (
          <ul className="siara-manual-loc__results">
            {searching && <li className="siara-manual-loc__status">{t('mapPage.manualLocation.searching')}</li>}
            {!searching && error && <li className="siara-manual-loc__status is-error">{error}</li>}
            {!searching && !error && results.length === 0 && (
              <li className="siara-manual-loc__status">{t('mapPage.manualLocation.noResults')}</li>
            )}
            {results.map((result) => (
              <li key={result.id}>
                <button type="button" className="siara-manual-loc__result" onClick={() => handlePick(result)}>
                  <LocationOnOutlinedIcon fontSize="inherit" />
                  <span>{result.label}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

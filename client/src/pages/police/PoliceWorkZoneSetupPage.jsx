import React from 'react'

import { usePoliceAccess } from '../../components/police/PoliceAccessGate'
import { getPoliceWorkZoneOptions, updatePoliceWorkZone } from '../../services/policeService'
import '../../styles/PoliceMode.css'
import '../../styles/PoliceWorkZoneSetup.css'

function PoliceSetupSelect({
  label,
  value,
  options,
  onChange,
  placeholder,
  disabled,
  loadingLabel,
  emptyLabel,
  searchPlaceholder,
}) {
  const [isOpen, setIsOpen] = React.useState(false)
  const [searchValue, setSearchValue] = React.useState('')
  const rootRef = React.useRef(null)
  const searchInputRef = React.useRef(null)

  const selectedOption = React.useMemo(
    () => options.find((item) => String(item.id) === String(value)) || null,
    [options, value],
  )

  const filteredOptions = React.useMemo(() => {
    const normalizedQuery = searchValue.trim().toLocaleLowerCase()
    if (!normalizedQuery) {
      return options
    }

    return options.filter((item) => String(item.name || '').toLocaleLowerCase().includes(normalizedQuery))
  }, [options, searchValue])

  React.useEffect(() => {
    if (disabled) {
      setIsOpen(false)
      setSearchValue('')
    }
  }, [disabled])

  React.useEffect(() => {
    if (!isOpen) {
      return undefined
    }

    const handlePointerDown = (event) => {
      if (rootRef.current && !rootRef.current.contains(event.target)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
    }
  }, [isOpen])

  React.useEffect(() => {
    if (!isOpen) {
      setSearchValue('')
      return undefined
    }

    const focusTimer = setTimeout(() => {
      searchInputRef.current?.focus()
    }, 10)

    return () => {
      clearTimeout(focusTimer)
    }
  }, [isOpen])

  const handleSelect = (nextValue) => {
    onChange(nextValue)
    setIsOpen(false)
    setSearchValue('')
  }

  const triggerLabel = selectedOption?.name || loadingLabel || placeholder

  return (
    <div className="pzs-field">
      <label className="pzs-field-label">{label}</label>
      <div
        ref={rootRef}
        className={`pzs-select ${isOpen ? 'open' : ''} ${disabled ? 'disabled' : ''}`}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            setIsOpen(false)
          }
        }}
      >
        <button
          type="button"
          className="pzs-select-trigger"
          onClick={() => setIsOpen((current) => !current)}
          disabled={disabled}
          aria-expanded={isOpen}
          aria-haspopup="listbox"
        >
          <span className={`pzs-select-value ${selectedOption ? 'has-value' : ''}`}>{triggerLabel}</span>
          <svg className="pzs-select-chevron" viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <path d="M5 8l5 5 5-5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        {isOpen ? (
          <div className="pzs-select-menu" role="listbox" tabIndex={-1}>
            <div className="pzs-select-search">
              <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
                <circle cx="8.5" cy="8.5" r="5.25" stroke="currentColor" strokeWidth="1.5" />
                <path d="M12.5 12.5l3.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              <input
                ref={searchInputRef}
                type="text"
                value={searchValue}
                onChange={(event) => setSearchValue(event.target.value)}
                placeholder={searchPlaceholder}
                aria-label={`${label} search`}
              />
            </div>

            <div className="pzs-select-options">
              <button
                type="button"
                className={`pzs-select-option pzs-select-option-clear ${value ? '' : 'selected'}`}
                onClick={() => handleSelect('')}
              >
                {placeholder}
              </button>

              {filteredOptions.map((item) => {
                const optionValue = String(item.id)
                const isSelected = String(value) === optionValue

                return (
                  <button
                    key={item.id}
                    type="button"
                    className={`pzs-select-option ${isSelected ? 'selected' : ''}`}
                    onClick={() => handleSelect(optionValue)}
                  >
                    {isSelected && (
                      <svg className="pzs-select-option-check" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                        <path d="M3 8l3.5 3.5L13 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                    {item.name}
                  </button>
                )
              })}

              {!filteredOptions.length ? (
                <p className="pzs-select-empty">{emptyLabel}</p>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}

function ShieldIcon() {
  return (
    <svg viewBox="0 0 40 46" fill="none" aria-hidden="true" className="pzs-shield-icon">
      <path
        d="M20 2L4 9v12c0 10.5 6.9 19.8 16 22.7C29.1 40.8 36 31.5 36 21V9L20 2z"
        fill="url(#shield-grad)"
        stroke="rgba(255,255,255,0.25)"
        strokeWidth="0.8"
      />
      <path
        d="M14 23l4 4 8-9"
        stroke="#ffffff"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <defs>
        <linearGradient id="shield-grad" x1="4" y1="2" x2="36" y2="44" gradientUnits="userSpaceOnUse">
          <stop stopColor="#2563eb" />
          <stop offset="1" stopColor="#1d4ed8" />
        </linearGradient>
      </defs>
    </svg>
  )
}

function MapPinIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M10 2a6 6 0 0 1 6 6c0 4-6 10-6 10S4 12 4 8a6 6 0 0 1 6-6z" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="10" cy="8" r="2" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  )
}

function BuildingIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <rect x="3" y="5" width="14" height="12" rx="1" stroke="currentColor" strokeWidth="1.5" />
      <path d="M3 8h14M7 8v9M13 8v9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M7 3h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M10 3v2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

function UserIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <circle cx="10" cy="7" r="3.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M3 17c0-3.3 3.1-6 7-6s7 2.7 7 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

function BadgeIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <rect x="4" y="2" width="12" height="16" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M7 7h6M7 10h6M7 13h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M10 2v2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

export default function PoliceWorkZoneSetupPage() {
  const { policeMe, refreshPoliceMe } = usePoliceAccess()
  const [wilayas, setWilayas] = React.useState([])
  const [communes, setCommunes] = React.useState([])
  const [wilayaId, setWilayaId] = React.useState(() => policeMe?.workZone?.wilaya?.id ? String(policeMe.workZone.wilaya.id) : '')
  const [communeId, setCommuneId] = React.useState(() => policeMe?.workZone?.commune?.id ? String(policeMe.workZone.commune.id) : '')
  const [isLoading, setIsLoading] = React.useState(true)
  const [isSaving, setIsSaving] = React.useState(false)
  const [error, setError] = React.useState('')

  React.useEffect(() => {
    let isCancelled = false

    async function loadOptions() {
      setIsLoading(true)
      setError('')

      try {
        const response = await getPoliceWorkZoneOptions(wilayaId || null)
        if (isCancelled) {
          return
        }

        setWilayas(response.wilayas)
        setCommunes(response.communes)

        if (!wilayaId && response.selectedWilayaId) {
          setWilayaId(String(response.selectedWilayaId))
        }

        if (!communeId && response.selectedCommuneId) {
          setCommuneId(String(response.selectedCommuneId))
        }
      } catch (loadError) {
        if (!isCancelled) {
          setError(loadError.message || 'Failed to load work-zone options.')
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false)
        }
      }
    }

    loadOptions()
    return () => {
      isCancelled = true
    }
  }, [wilayaId])

  const handleWilayaChange = async (nextWilayaId) => {
    setWilayaId(nextWilayaId)
    setCommuneId('')
    setError('')

    if (!nextWilayaId) {
      setCommunes([])
      return
    }

    setIsLoading(true)
    try {
      const response = await getPoliceWorkZoneOptions(nextWilayaId)
      setWilayas(response.wilayas)
      setCommunes(response.communes)
    } catch (loadError) {
      setError(loadError.message || 'Failed to load communes.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')

    if (!wilayaId || !communeId) {
      setError('Please choose both a Wilaya and a Commune before continuing.')
      return
    }

    setIsSaving(true)
    try {
      await updatePoliceWorkZone({
        wilayaId: Number(wilayaId),
        communeId: Number(communeId),
      })
      await refreshPoliceMe()
    } catch (saveError) {
      setError(saveError.message || 'Failed to save work zone.')
    } finally {
      setIsSaving(false)
    }
  }

  const officerName = policeMe?.officer?.name || 'Officer'
  const wilayaName = policeMe?.workZone?.wilaya?.name
  const communeName = policeMe?.workZone?.commune?.name
  const badgeNumber = policeMe?.officer?.badgeNumber
  const rank = policeMe?.officer?.rank || 'Police Officer'

  return (
    <div className="pzs-root">
      <div className="pzs-bg-pattern" aria-hidden="true" />

      <main className="pzs-center">
        <div className="pzs-card">

          {/* ── Header ── */}
          <div className="pzs-card-header">
            <div className="pzs-header-left">
              <ShieldIcon />
              <div>
                <p className="pzs-eyebrow">Police Workspace Setup</p>
                <h1 className="pzs-title">Select Your Working Zone</h1>
                <p className="pzs-subtitle">First login configuration for <strong>{officerName}</strong></p>
              </div>
            </div>
            <div className="pzs-step-badge">
              <span className="pzs-step-dot active" />
              <span className="pzs-step-label">Step 1 of 1</span>
            </div>
          </div>

          {/* ── Divider ── */}
          <div className="pzs-divider" />

          {/* ── Form body ── */}
          <div className="pzs-body">
            <p className="pzs-description">
              Choose your active <strong>Wilaya</strong> and <strong>Commune</strong> before entering police mode.
              You can update your active zone later if your assignment changes.
            </p>

            <form onSubmit={handleSubmit} className="pzs-form" noValidate>
              <div className="pzs-fields-row">
                <PoliceSetupSelect
                  label="Wilaya"
                  value={wilayaId}
                  options={wilayas}
                  onChange={handleWilayaChange}
                  placeholder="Select Wilaya"
                  disabled={isSaving || isLoading}
                  loadingLabel={isLoading && !wilayas.length ? 'Loading…' : ''}
                  emptyLabel="No wilaya found"
                  searchPlaceholder="Search wilaya…"
                />

                <PoliceSetupSelect
                  label="Commune"
                  value={communeId}
                  options={communes}
                  onChange={setCommuneId}
                  placeholder={!wilayaId ? 'Select Wilaya first' : 'Select Commune'}
                  disabled={!wilayaId || isLoading || isSaving}
                  loadingLabel={isLoading && wilayaId ? 'Loading…' : ''}
                  emptyLabel={!wilayaId ? 'Choose a wilaya first' : 'No commune found'}
                  searchPlaceholder="Search commune…"
                />
              </div>

              {error ? (
                <div className="pzs-alert pzs-alert-error" role="alert">
                  <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
                    <circle cx="10" cy="10" r="7.5" stroke="currentColor" strokeWidth="1.5" />
                    <path d="M10 6.5v4M10 13h.01" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                  </svg>
                  {error}
                </div>
              ) : null}

              {isLoading && !error ? (
                <div className="pzs-loading-row" aria-live="polite">
                  <span className="pzs-spinner" />
                  <span>Loading zone options…</span>
                </div>
              ) : null}

              <div className="pzs-form-footer">
                <p className="pzs-form-hint">Both fields are required to activate your workspace.</p>
                <button
                  type="submit"
                  className="pzs-submit-btn"
                  disabled={isSaving || isLoading}
                >
                  {isSaving ? (
                    <>
                      <span className="pzs-spinner pzs-spinner-white" />
                      Saving…
                    </>
                  ) : (
                    <>
                      <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
                        <path d="M4 10h12M11 5l5 5-5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      Save Working Zone
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>

          {/* ── Divider ── */}
          <div className="pzs-divider" />

          {/* ── Officer info cards ── */}
          <div className="pzs-info-section">
            <p className="pzs-info-section-label">Current Assignment Summary</p>
            <div className="pzs-info-grid">
              <div className={`pzs-info-card ${wilayaName ? 'active' : ''}`}>
                <div className="pzs-info-card-icon pzs-icon-map">
                  <MapPinIcon />
                </div>
                <div className="pzs-info-card-body">
                  <span className="pzs-info-card-category">Wilaya</span>
                  <strong className="pzs-info-card-value">{wilayaName || 'Not selected'}</strong>
                  <span className="pzs-info-card-sub">Active Wilaya</span>
                </div>
                {wilayaName && <span className="pzs-info-card-badge">Active</span>}
              </div>

              <div className={`pzs-info-card ${communeName ? 'active' : ''}`}>
                <div className="pzs-info-card-icon pzs-icon-building">
                  <BuildingIcon />
                </div>
                <div className="pzs-info-card-body">
                  <span className="pzs-info-card-category">Commune</span>
                  <strong className="pzs-info-card-value">{communeName || 'Not selected'}</strong>
                  <span className="pzs-info-card-sub">Active Commune</span>
                </div>
                {communeName && <span className="pzs-info-card-badge">Active</span>}
              </div>

              <div className="pzs-info-card pzs-info-card-officer">
                <div className="pzs-info-card-icon pzs-icon-user">
                  <UserIcon />
                </div>
                <div className="pzs-info-card-body">
                  <span className="pzs-info-card-category">Officer</span>
                  <strong className="pzs-info-card-value">{officerName}</strong>
                  <span className="pzs-info-card-sub">{rank}</span>
                </div>
              </div>

              <div className={`pzs-info-card ${badgeNumber ? 'active' : 'pzs-info-card-pending'}`}>
                <div className="pzs-info-card-icon pzs-icon-badge">
                  <BadgeIcon />
                </div>
                <div className="pzs-info-card-body">
                  <span className="pzs-info-card-category">Badge</span>
                  <strong className="pzs-info-card-value">{badgeNumber || 'Pending'}</strong>
                  <span className="pzs-info-card-sub">Identification</span>
                </div>
                {!badgeNumber && <span className="pzs-info-card-badge pzs-badge-pending">Pending</span>}
              </div>
            </div>
          </div>

        </div>
      </main>
    </div>
  )
}

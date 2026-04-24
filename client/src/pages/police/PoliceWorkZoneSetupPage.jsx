import React from 'react'

import { usePoliceAccess } from '../../components/police/PoliceAccessGate'
import { getPoliceWorkZoneOptions, updatePoliceWorkZone } from '../../services/policeService'
import '../../styles/PoliceMode.css'

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
    <label className="police-filter-field police-setup-zone-field">
      <span>{label}</span>
      <div
        ref={rootRef}
        className={`police-setup-select ${isOpen ? 'open' : ''} ${disabled ? 'disabled' : ''}`}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            setIsOpen(false)
          }
        }}
      >
        <button
          type="button"
          className="police-setup-select-trigger"
          onClick={() => setIsOpen((current) => !current)}
          disabled={disabled}
          aria-expanded={isOpen}
          aria-haspopup="listbox"
        >
          <span className={`police-setup-select-label ${selectedOption ? '' : 'placeholder'}`}>{triggerLabel}</span>
          <span className="police-setup-select-chevron" aria-hidden="true">▾</span>
        </button>

        {isOpen ? (
          <div className="police-setup-select-menu" role="listbox" tabIndex={-1}>
            <div className="police-setup-select-search">
              <input
                ref={searchInputRef}
                type="text"
                value={searchValue}
                onChange={(event) => setSearchValue(event.target.value)}
                placeholder={searchPlaceholder}
                aria-label={`${label} search`}
              />
            </div>

            <div className="police-setup-select-options">
              <button
                type="button"
                className={`police-setup-select-option police-setup-select-option-clear ${value ? '' : 'selected'}`}
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
                    className={`police-setup-select-option ${isSelected ? 'selected' : ''}`}
                    onClick={() => handleSelect(optionValue)}
                  >
                    {item.name}
                  </button>
                )
              })}

              {!filteredOptions.length ? (
                <p className="police-setup-select-empty">{emptyLabel}</p>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
    </label>
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
      setError('Please choose both Wilaya and Commune.')
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

  return (
    <div className="police-root police-setup-zone-root">
      <main className="police-center police-setup-zone-main">
        <section className="police-section police-setup-zone-shell">
          <div className="police-setup-zone-header">
            <div>
              <span className="police-setup-zone-eyebrow">Police Workspace Setup</span>
              <h2>Select Your Working Zone</h2>
              <p className="police-shortcuts-hint">
                First login setup for {policeMe?.officer?.name || 'Officer'}.
              </p>
            </div>
            <span className="police-setup-zone-step">Step 1 of 1</span>
          </div>

          <p className="police-meta police-setup-zone-description">
            Choose your active Wilaya and Commune before entering police mode. You can update the active zone later if your assignment changes.
          </p>

          <form onSubmit={handleSubmit} className="police-setup-zone-form">
            <div className="police-setup-zone-fields">
              <PoliceSetupSelect
                label="Wilaya"
                value={wilayaId}
                options={wilayas}
                onChange={handleWilayaChange}
                placeholder="Select Wilaya"
                disabled={isSaving || isLoading}
                loadingLabel={isLoading && !wilayas.length ? 'Loading wilayas...' : ''}
                emptyLabel="No wilaya found"
                searchPlaceholder="Search wilaya"
              />

              <PoliceSetupSelect
                label="Commune"
                value={communeId}
                options={communes}
                onChange={setCommuneId}
                placeholder={!wilayaId ? 'Select Wilaya first' : 'Select Commune'}
                disabled={!wilayaId || isLoading || isSaving}
                loadingLabel={isLoading && wilayaId ? 'Loading communes...' : ''}
                emptyLabel={!wilayaId ? 'Choose a wilaya first' : 'No commune found'}
                searchPlaceholder="Search commune"
              />
            </div>

            <button
              type="submit"
              className="police-action police-action-verify police-setup-zone-submit"
              disabled={isSaving || isLoading}
            >
              {isSaving ? 'Saving...' : 'Save Working Zone'}
            </button>
          </form>

          {error ? <p className="police-setup-zone-message police-setup-zone-message-error">{error}</p> : null}
          {isLoading ? <p className="police-setup-zone-message">Loading work-zone options...</p> : null}

          <div className="police-stats-grid police-setup-zone-stats">
            <div className="police-stat police-setup-zone-stat">
              <span>Wilaya</span>
              <strong>{policeMe?.workZone?.wilaya?.name || 'Not selected'}</strong>
              <em>Active Wilaya</em>
            </div>
            <div className="police-stat police-setup-zone-stat">
              <span>Commune</span>
              <strong>{policeMe?.workZone?.commune?.name || 'Not selected'}</strong>
              <em>Active Commune</em>
            </div>
            <div className="police-stat police-setup-zone-stat">
              <span>Officer</span>
              <strong>{policeMe?.officer?.name || 'Officer'}</strong>
              <em>{policeMe?.officer?.rank || 'Police role'}</em>
            </div>
            <div className="police-stat police-setup-zone-stat">
              <span>Badge</span>
              <strong>{policeMe?.officer?.badgeNumber || 'Pending'}</strong>
              <em>Identification</em>
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}

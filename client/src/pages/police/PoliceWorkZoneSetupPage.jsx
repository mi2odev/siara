import React from 'react'

import { usePoliceAccess } from '../../components/police/PoliceAccessGate'
import { getPoliceWorkZoneOptions, updatePoliceWorkZone } from '../../services/policeService'
import '../../styles/PoliceMode.css'

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

  const handleWilayaChange = async (event) => {
    const nextWilayaId = event.target.value
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
    <div className="police-root">
      <main className="police-center" style={{ maxWidth: 920, margin: '0 auto', padding: '48px 20px' }}>
        <section className="police-section">
          <div className="police-command-section-head">
            <div>
              <h2>Select Your Working Zone</h2>
              <p className="police-shortcuts-hint">
                First login setup for {policeMe?.officer?.name || 'Officer'}.
              </p>
            </div>
          </div>

          <p className="police-meta">
            Choose your active Wilaya and Commune before entering police mode. You can update the active zone later if your assignment changes.
          </p>

          <form onSubmit={handleSubmit} className="police-history-filters" style={{ alignItems: 'flex-end' }}>
            <label className="police-filter-field">
              <span>Wilaya</span>
              <select value={wilayaId} onChange={handleWilayaChange} disabled={isLoading || isSaving}>
                <option value="">Select Wilaya</option>
                {wilayas.map((item) => (
                  <option key={item.id} value={String(item.id)}>{item.name}</option>
                ))}
              </select>
            </label>

            <label className="police-filter-field">
              <span>Commune</span>
              <select
                value={communeId}
                onChange={(event) => setCommuneId(event.target.value)}
                disabled={!wilayaId || isLoading || isSaving}
              >
                <option value="">Select Commune</option>
                {communes.map((item) => (
                  <option key={item.id} value={String(item.id)}>{item.name}</option>
                ))}
              </select>
            </label>

            <button type="submit" className="police-action police-action-verify" disabled={isSaving || isLoading}>
              {isSaving ? 'Saving...' : 'Save Working Zone'}
            </button>
          </form>

          {error ? <p className="police-meta" style={{ color: '#b91c1c' }}>{error}</p> : null}
          {isLoading ? <p className="police-meta">Loading work-zone options...</p> : null}

          <div className="police-stats-grid">
            <div className="police-stat">
              <span>Officer</span>
              <strong>{policeMe?.officer?.name || 'Officer'}</strong>
              <em>{policeMe?.officer?.rank || 'Police role'}</em>
            </div>
            <div className="police-stat">
              <span>Badge</span>
              <strong>{policeMe?.officer?.badgeNumber || 'Pending'}</strong>
              <em>Identification</em>
            </div>
            <div className="police-stat">
              <span>Current Wilaya</span>
              <strong>{policeMe?.workZone?.wilaya?.name || 'Not selected'}</strong>
              <em>Active zone</em>
            </div>
            <div className="police-stat">
              <span>Current Commune</span>
              <strong>{policeMe?.workZone?.commune?.name || 'Not selected'}</strong>
              <em>Active zone</em>
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}

import React from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined'
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded'
import AssignmentIndOutlinedIcon from '@mui/icons-material/AssignmentIndOutlined'
import PriorityHighRoundedIcon from '@mui/icons-material/PriorityHighRounded'
import ReportProblemOutlinedIcon from '@mui/icons-material/ReportProblemOutlined'
import CheckCircleOutlinedIcon from '@mui/icons-material/CheckCircleOutlined'
import LocationOnOutlinedIcon from '@mui/icons-material/LocationOnOutlined'
import AccessTimeOutlinedIcon from '@mui/icons-material/AccessTimeOutlined'
import BadgeOutlinedIcon from '@mui/icons-material/BadgeOutlined'
import PlaceOutlinedIcon from '@mui/icons-material/PlaceOutlined'

import PoliceShell from '../../components/layout/PoliceShell'
import PoliceSortControl from '../../components/police/PoliceSortControl'
import { usePoliceAccess } from '../../components/police/PoliceAccessGate'
import { listPoliceIncidents } from '../../services/policeService'
import { usePoliceSort, INCIDENT_SORT_ACCESSORS, INCIDENT_SORT_OPTIONS } from '../../utils/policeSort'

function displayLabel(value) {
  return String(value || '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

function SeverityIcon({ severity }) {
  const p = { fontSize: 'inherit' }
  if (severity === 'high') return <PriorityHighRoundedIcon {...p} />
  if (severity === 'medium') return <ReportProblemOutlinedIcon {...p} />
  return <CheckCircleOutlinedIcon {...p} />
}

function getInitials(name) {
  return String(name || 'O')
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

export default function PoliceAssignedIncidentsPage() {
  const navigate = useNavigate()
  const { t } = useTranslation(['police', 'common'])
  const { policeMe } = usePoliceAccess()
  const officer  = policeMe?.officer
  const workZone = policeMe?.workZone

  const FILTERS = [
    { value: 'all',          label: t('policeAssignedIncidentsPage.filters.all') },
    { value: 'pending',      label: t('policeAssignedIncidentsPage.filters.pending') },
    { value: 'under_review', label: t('policeAssignedIncidentsPage.filters.underReview') },
    { value: 'verified',     label: t('policeAssignedIncidentsPage.filters.verified') },
    { value: 'dispatched',   label: t('policeAssignedIncidentsPage.filters.dispatched') },
    { value: 'resolved',     label: t('policeAssignedIncidentsPage.filters.resolved') },
  ]

  const [allIncidents, setAllIncidents]   = React.useState([])
  const [statusFilter, setStatusFilter]   = React.useState('all')
  const [isLoading, setIsLoading]         = React.useState(true)
  const [error, setError]                 = React.useState('')

  const load = React.useCallback(async () => {
    setIsLoading(true)
    setError('')
    try {
      const res = await listPoliceIncidents({ scope: 'assigned', page: 1, pageSize: 50 })
      setAllIncidents(res.items)
    } catch (e) {
      setError(e.message || t('policeAssignedIncidentsPage.errorLoad'))
    } finally {
      setIsLoading(false)
    }
  }, [t])

  React.useEffect(() => { load() }, [load])

  const displayed = statusFilter === 'all'
    ? allIncidents
    : allIncidents.filter((i) => i.status === statusFilter)

  const { sorted: sortedDisplayed, sortKey, setSortKey, sortDir, toggleDir } = usePoliceSort(displayed, INCIDENT_SORT_ACCESSORS)

  const count = (status) =>
    status === 'all'
      ? allIncidents.length
      : allIncidents.filter((i) => i.status === status).length

  const rightPanel = (
    <div className="pmi-right">

      {/* Officer card */}
      <div className="pmi-right-card">
        <div className="pmi-right-card-head">
          <span className="pmi-right-card-title">{t('policeAssignedIncidentsPage.officerCard.title')}</span>
          <span className={`pmi-duty-badge pmi-duty-badge--${officer?.isOnDuty ? 'on' : 'off'}`}>
            <span className="pmi-duty-dot" />
            {officer?.isOnDuty ? t('policeAssignedIncidentsPage.officerCard.onDuty') : t('policeAssignedIncidentsPage.officerCard.offDuty')}
          </span>
        </div>
        <div className="pmi-officer-row">
          {officer?.avatarUrl
            ? <img src={officer.avatarUrl} alt={officer.name} className="pmi-officer-avatar-img" />
            : <span className="pmi-officer-avatar">{getInitials(officer?.name)}</span>
          }
          <div className="pmi-officer-meta">
            <strong>{officer?.name || t('policeAssignedIncidentsPage.officerCard.defaultName')}</strong>
            <span>{officer?.rank || t('policeAssignedIncidentsPage.officerCard.defaultRank')}</span>
          </div>
        </div>
        <div className="pmi-detail-rows">
          <div className="pmi-detail-row">
            <BadgeOutlinedIcon fontSize="inherit" />
            <span>{t('policeAssignedIncidentsPage.officerCard.badge')}</span>
            <strong>{officer?.badgeNumber || t('policeAssignedIncidentsPage.officerCard.badgePending')}</strong>
          </div>
        </div>
      </div>

      {/* Work zone card */}
      <div className="pmi-right-card">
        <div className="pmi-right-card-head">
          <span className="pmi-right-card-title">{t('policeAssignedIncidentsPage.workZoneCard.title')}</span>
        </div>
        <div className="pmi-detail-rows">
          <div className="pmi-detail-row">
            <PlaceOutlinedIcon fontSize="inherit" />
            <span>{t('policeAssignedIncidentsPage.workZoneCard.wilaya')}</span>
            <strong>{workZone?.wilaya?.name || t('policeAssignedIncidentsPage.workZoneCard.notSet')}</strong>
          </div>
          <div className="pmi-detail-row">
            <PlaceOutlinedIcon fontSize="inherit" />
            <span>{t('policeAssignedIncidentsPage.workZoneCard.commune')}</span>
            <strong>{workZone?.commune?.name || t('policeAssignedIncidentsPage.workZoneCard.notSet')}</strong>
          </div>
        </div>
      </div>

      {/* Status summary */}
      <div className="pmi-right-card pmi-right-card--summary">
        <div className="pmi-right-card-head">
          <span className="pmi-right-card-title">{t('policeAssignedIncidentsPage.summaryCard.title')}</span>
          <span className="pmi-right-total">{t('policeAssignedIncidentsPage.summaryCard.total', { count: allIncidents.length })}</span>
        </div>
        {FILTERS.filter((f) => f.value !== 'all').map((f) => (
          <button
            key={f.value}
            type="button"
            className={`pmi-summary-row${statusFilter === f.value ? ' pmi-summary-row--active' : ''}`}
            onClick={() => setStatusFilter(f.value)}
          >
            <span className={`pmi-summary-dot pmi-summary-dot--${f.value}`} />
            <span className="pmi-summary-name">{f.label}</span>
            <strong className="pmi-summary-num">{count(f.value)}</strong>
          </button>
        ))}
      </div>

    </div>
  )

  return (
    <PoliceShell
      activeKey="assigned-incidents"
      rightPanel={rightPanel}
    >
      <div className="pmi-page">

        {/* ── Header ── */}
        <div className="pmi-head">
          <div>
            <h2 className="pmi-heading">{t('policeAssignedIncidentsPage.heading')}</h2>
            <p className="pmi-sub">{t('policeAssignedIncidentsPage.subheading')}</p>
          </div>
          <button
            type="button"
            className="pmi-refresh"
            onClick={load}
            disabled={isLoading}
            title={t('policeAssignedIncidentsPage.refreshTitle')}
            aria-label={t('policeAssignedIncidentsPage.refreshTitle')}
          >
            <RefreshRoundedIcon fontSize="inherit" className={isLoading ? 'is-spinning' : ''} />
            <span>{t('policeAssignedIncidentsPage.refreshLabel')}</span>
          </button>
        </div>

        {/* ── Status tabs + sort ── */}
        <div className="police-tabs-row">
          <div className="pmi-tabs" role="tablist">
            {FILTERS.map((f) => (
              <button
                key={f.value}
                type="button"
                role="tab"
                aria-selected={statusFilter === f.value}
                className={`pmi-tab${statusFilter === f.value ? ' pmi-tab--on' : ''}`}
                onClick={() => setStatusFilter(f.value)}
              >
                {f.label}
                <span className="pmi-tab-count">{count(f.value)}</span>
              </button>
            ))}
          </div>
          {!isLoading && displayed.length > 0 && (
            <PoliceSortControl
              options={INCIDENT_SORT_OPTIONS}
              value={sortKey}
              direction={sortDir}
              onChange={setSortKey}
              onToggleDirection={toggleDir}
            />
          )}
        </div>

        {/* ── Body ── */}
        <div className="pmi-body">
          {error && <p className="pmi-error">{error}</p>}

          {isLoading && (
            <p className="pmi-loading">{t('policeAssignedIncidentsPage.loading')}</p>
          )}

          {!isLoading && !error && displayed.length === 0 && (
            <div className="pmi-empty">
              <span className="pmi-empty-icon"><AssignmentIndOutlinedIcon fontSize="inherit" /></span>
              <p>{t('policeAssignedIncidentsPage.empty')}</p>
            </div>
          )}

          {!isLoading && displayed.length > 0 && (
            <div className="pmi-list">
              {sortedDisplayed.map((incident) => (
                <div
                  key={incident.id}
                  className={`pmi-row pmi-row--${incident.severity || 'low'}`}
                  onClick={() => navigate(`/police/incident/${incident.id}`)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && navigate(`/police/incident/${incident.id}`)}
                >
                  <div className="pmi-info">
                    <div className="pmi-badges">
                      <code className="pmi-id">{incident.displayId}</code>
                      <span className={`pmi-sev pmi-sev--${incident.severity || 'low'}`}>
                        <SeverityIcon severity={incident.severity} />
                        {displayLabel(incident.severity)}
                      </span>
                      <span className={`pmi-status pmi-status--${incident.status}`}>
                        {displayLabel(incident.status)}
                      </span>
                    </div>

                    <p className="pmi-title">{incident.title || t('policeAssignedIncidentsPage.untitledIncident')}</p>

                    <div className="pmi-meta">
                      {incident.locationText && (
                        <span className="pmi-loc">
                          <LocationOnOutlinedIcon fontSize="inherit" />
                          {incident.locationText}
                        </span>
                      )}
                      <span className="pmi-time">
                        <AccessTimeOutlinedIcon fontSize="inherit" />
                        {incident.timeAgo || '—'}
                      </span>
                      {incident.reportedBy?.name && (
                        <span className="pmi-reporter">{t('policeAssignedIncidentsPage.reportedBy', { name: incident.reportedBy.name })}</span>
                      )}
                    </div>
                  </div>

                  <button
                    type="button"
                    className="pmi-view"
                    onClick={(e) => { e.stopPropagation(); navigate(`/police/incident/${incident.id}`) }}
                    aria-label={t('policeAssignedIncidentsPage.viewAriaLabel', { id: incident.displayId })}
                  >
                    <VisibilityOutlinedIcon fontSize="inherit" />
                    {t('policeAssignedIncidentsPage.viewButton')}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </PoliceShell>
  )
}

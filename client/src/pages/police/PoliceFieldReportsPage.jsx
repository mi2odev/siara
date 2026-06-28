import React from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined'
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded'
import ArticleOutlinedIcon from '@mui/icons-material/ArticleOutlined'
import PriorityHighRoundedIcon from '@mui/icons-material/PriorityHighRounded'
import ReportProblemOutlinedIcon from '@mui/icons-material/ReportProblemOutlined'
import CheckCircleOutlinedIcon from '@mui/icons-material/CheckCircleOutlined'
import LocationOnOutlinedIcon from '@mui/icons-material/LocationOnOutlined'
import AccessTimeOutlinedIcon from '@mui/icons-material/AccessTimeOutlined'
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined'
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

export default function PoliceFieldReportsPage() {
  const navigate = useNavigate()
  const { t } = useTranslation(['police', 'common'])
  const { policeMe } = usePoliceAccess()
  const officer  = policeMe?.officer
  const workZone = policeMe?.workZone

  const FILTERS = [
    { value: 'all',          label: t('policeFieldReportsPage.filters.all') },
    { value: 'pending',      label: t('policeFieldReportsPage.filters.pending') },
    { value: 'under_review', label: t('policeFieldReportsPage.filters.underReview') },
    { value: 'verified',     label: t('policeFieldReportsPage.filters.verified') },
    { value: 'resolved',     label: t('policeFieldReportsPage.filters.resolved') },
  ]

  const [allReports, setAllReports]     = React.useState([])
  const [statusFilter, setStatusFilter] = React.useState('all')
  const [isLoading, setIsLoading]       = React.useState(true)
  const [error, setError]               = React.useState('')

  const load = React.useCallback(async () => {
    setIsLoading(true)
    setError('')
    try {
      const res = await listPoliceIncidents({ scope: 'field_reports', page: 1, pageSize: 50 })
      setAllReports(res.items)
    } catch (e) {
      setError(e.message || t('policeFieldReportsPage.errorLoad'))
    } finally {
      setIsLoading(false)
    }
  }, [t])

  React.useEffect(() => { load() }, [load])

  const displayed = statusFilter === 'all'
    ? allReports
    : allReports.filter((r) => r.status === statusFilter)

  const { sorted: sortedDisplayed, sortKey, setSortKey, sortDir, toggleDir } = usePoliceSort(displayed, INCIDENT_SORT_ACCESSORS)

  const count = (status) =>
    status === 'all'
      ? allReports.length
      : allReports.filter((r) => r.status === status).length

  const totalNotes = allReports.reduce((sum, r) => sum + Number(r.fieldNoteCount || 0), 0)

  const rightPanel = (
    <div className="pfr-right">

      {/* Officer card */}
      <div className="pfr-right-card">
        <div className="pfr-right-card-head">
          <span className="pfr-right-card-title">{t('policeFieldReportsPage.officer.title')}</span>
          <span className={`pfr-duty-badge pfr-duty-badge--${officer?.isOnDuty ? 'on' : 'off'}`}>
            <span className="pfr-duty-dot" />
            {officer?.isOnDuty ? t('policeFieldReportsPage.officer.onDuty') : t('policeFieldReportsPage.officer.offDuty')}
          </span>
        </div>
        <div className="pfr-officer-row">
          {officer?.avatarUrl
            ? <img src={officer.avatarUrl} alt={officer.name} className="pfr-officer-avatar-img" />
            : <span className="pfr-officer-avatar">{getInitials(officer?.name)}</span>
          }
          <div className="pfr-officer-meta">
            <strong>{officer?.name || t('policeFieldReportsPage.officer.defaultName')}</strong>
            <span>{officer?.rank || t('policeFieldReportsPage.officer.defaultRank')}</span>
          </div>
        </div>
        <div className="pfr-detail-rows">
          <div className="pfr-detail-row">
            <BadgeOutlinedIcon fontSize="inherit" />
            <span>{t('policeFieldReportsPage.officer.badge')}</span>
            <strong>{officer?.badgeNumber || t('policeFieldReportsPage.officer.badgePending')}</strong>
          </div>
        </div>
      </div>

      {/* Work zone card */}
      <div className="pfr-right-card">
        <div className="pfr-right-card-head">
          <span className="pfr-right-card-title">{t('policeFieldReportsPage.workZone.title')}</span>
        </div>
        <div className="pfr-detail-rows">
          <div className="pfr-detail-row">
            <PlaceOutlinedIcon fontSize="inherit" />
            <span>{t('policeFieldReportsPage.workZone.wilaya')}</span>
            <strong>{workZone?.wilaya?.name || t('policeFieldReportsPage.workZone.notSet')}</strong>
          </div>
          <div className="pfr-detail-row">
            <PlaceOutlinedIcon fontSize="inherit" />
            <span>{t('policeFieldReportsPage.workZone.commune')}</span>
            <strong>{workZone?.commune?.name || t('policeFieldReportsPage.workZone.notSet')}</strong>
          </div>
        </div>
      </div>

      {/* Status summary */}
      <div className="pfr-right-card pfr-right-card--summary">
        <div className="pfr-right-card-head">
          <span className="pfr-right-card-title">{t('policeFieldReportsPage.summary.title')}</span>
          <span className="pfr-right-total">{t('policeFieldReportsPage.summary.total', { count: allReports.length })}</span>
        </div>
        {FILTERS.filter((f) => f.value !== 'all').map((f) => (
          <button
            key={f.value}
            type="button"
            className={`pfr-summary-row${statusFilter === f.value ? ' pfr-summary-row--active' : ''}`}
            onClick={() => setStatusFilter(f.value)}
          >
            <span className={`pfr-summary-dot pfr-summary-dot--${f.value}`} />
            <span className="pfr-summary-name">{f.label}</span>
            <strong className="pfr-summary-num">{count(f.value)}</strong>
          </button>
        ))}
        {totalNotes > 0 && (
          <div className="pfr-summary-notes">
            <DescriptionOutlinedIcon fontSize="inherit" />
            {t('policeFieldReportsPage.summary.officerNotes', { count: totalNotes })}
          </div>
        )}
      </div>

    </div>
  )

  return (
    <PoliceShell activeKey="field-reports" rightPanel={rightPanel}>
      <div className="pfr-page">

        {/* ── Header ── */}
        <div className="pfr-head">
          <div>
            <h2 className="pfr-heading">{t('policeFieldReportsPage.heading')}</h2>
            <p className="pfr-sub">{t('policeFieldReportsPage.subheading')}</p>
          </div>
          <button
            type="button"
            className="pfr-refresh"
            onClick={load}
            disabled={isLoading}
            title={t('policeFieldReportsPage.refresh')}
            aria-label={t('policeFieldReportsPage.refresh')}
          >
            <RefreshRoundedIcon fontSize="inherit" className={isLoading ? 'is-spinning' : ''} />
            <span>{t('policeFieldReportsPage.refresh')}</span>
          </button>
        </div>

        {/* ── Status tabs + sort ── */}
        <div className="police-tabs-row">
          <div className="pfr-tabs" role="tablist">
            {FILTERS.map((f) => (
              <button
                key={f.value}
                type="button"
                role="tab"
                aria-selected={statusFilter === f.value}
                className={`pfr-tab${statusFilter === f.value ? ' pfr-tab--on' : ''}`}
                onClick={() => setStatusFilter(f.value)}
              >
                {f.label}
                <span className="pfr-tab-count">{count(f.value)}</span>
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
        <div className="pfr-body">
          {error && <p className="pfr-error">{error}</p>}

          {isLoading && <p className="pfr-loading">{t('policeFieldReportsPage.loading')}</p>}

          {!isLoading && !error && displayed.length === 0 && (
            <div className="pfr-empty">
              <span className="pfr-empty-icon"><ArticleOutlinedIcon fontSize="inherit" /></span>
              <p>{t('policeFieldReportsPage.emptyState')}</p>
            </div>
          )}

          {!isLoading && displayed.length > 0 && (
            <div className="pfr-list">
              {sortedDisplayed.map((report) => (
                <div
                  key={report.id}
                  className={`pfr-row pfr-row--${report.severity || 'low'}`}
                  onClick={() => navigate(`/police/incident/${report.id}`)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && navigate(`/police/incident/${report.id}`)}
                >
                  <span className={`pfr-strip pfr-strip--${report.severity || 'low'}`} />

                  <div className="pfr-info">
                    <div className="pfr-badges">
                      <code className="pfr-id">{report.displayId}</code>
                      <span className={`pfr-sev pfr-sev--${report.severity || 'low'}`}>
                        <SeverityIcon severity={report.severity} />
                        {displayLabel(report.severity)}
                      </span>
                      <span className={`pfr-status pfr-status--${report.status}`}>
                        {displayLabel(report.status)}
                      </span>
                      {report.sourceChannel && (
                        <span className="pfr-source">{displayLabel(report.sourceChannel)}</span>
                      )}
                    </div>

                    <p className="pfr-title">{report.title || t('policeFieldReportsPage.untitledReport')}</p>

                    {report.description && (
                      <p className="pfr-desc">{report.description}</p>
                    )}

                    <div className="pfr-meta">
                      {report.locationText && (
                        <span className="pfr-loc">
                          <LocationOnOutlinedIcon fontSize="inherit" />
                          {report.locationText}
                        </span>
                      )}
                      <span className="pfr-time">
                        <AccessTimeOutlinedIcon fontSize="inherit" />
                        {report.timeAgo || '—'}
                      </span>
                      {report.fieldNoteCount > 0 && (
                        <span className="pfr-notes">
                          <DescriptionOutlinedIcon fontSize="inherit" />
                          {t('policeFieldReportsPage.noteCount', { count: report.fieldNoteCount })}
                        </span>
                      )}
                    </div>
                  </div>

                  <button
                    type="button"
                    className="pfr-view"
                    onClick={(e) => { e.stopPropagation(); navigate(`/police/incident/${report.id}`) }}
                    aria-label={t('policeFieldReportsPage.viewAriaLabel', { id: report.displayId })}
                  >
                    <VisibilityOutlinedIcon fontSize="inherit" />
                    {t('policeFieldReportsPage.view')}
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

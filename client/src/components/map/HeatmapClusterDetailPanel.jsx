import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import LocalFireDepartmentOutlinedIcon from '@mui/icons-material/LocalFireDepartmentOutlined'
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded'
import { getHeatmapClusterDetail } from '../../services/heatmapClusterService'
import '../../styles/HeatmapClusterDetailPanel.css'

const SEVERITY_COLORS = {
  low: '#3B82F6',
  medium: '#FACC15',
  high: '#DC2626',
}

function formatDateTime(value) {
  if (!value) return '—'
  try {
    return new Date(value).toLocaleString()
  } catch {
    return '—'
  }
}

function severityClass(bucket) {
  const text = String(bucket || '').toLowerCase()
  if (text === 'high') return 'severity-high'
  if (text === 'medium') return 'severity-medium'
  return 'severity-low'
}

export default function HeatmapClusterDetailPanel({ open, cluster, onClose }) {
  const [state, setState] = useState('idle')
  const [error, setError] = useState('')
  const [detail, setDetail] = useState(null)
  const [showAllReports, setShowAllReports] = useState(false)

  useEffect(() => {
    if (!open || !cluster) {
      setState('idle')
      setDetail(null)
      setError('')
      setShowAllReports(false)
      return undefined
    }
    setShowAllReports(false)
    const lat = Number(cluster?.lat ?? cluster?.latitude)
    const lng = Number(cluster?.lng ?? cluster?.lon ?? cluster?.longitude)
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      setError('Invalid cluster location.')
      setState('error')
      return undefined
    }
    const radiusMeters = Math.max(80, Math.min(1500, Number(cluster?.radiusMeters) || 250))

    let cancelled = false
    setState('loading')
    setError('')
    setDetail(null)
    ;(async () => {
      try {
        const data = await getHeatmapClusterDetail({ lat, lng, radiusMeters, limit: 30 })
        if (cancelled) return
        setDetail(data)
        setState('success')
      } catch (err) {
        if (cancelled) return
        setError(err?.message || 'Could not load cluster details')
        setState('error')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [open, cluster])

  const severityCounts = detail?.severityCounts || cluster?.severityCounts || null
  const totalReports = detail?.reportCount ?? cluster?.reportCount ?? 0

  const severitySegments = useMemo(() => {
    if (!severityCounts || !totalReports) return []
    return ['high', 'medium', 'low']
      .map((key) => ({
        key,
        count: Number(severityCounts[key] || 0),
        color: SEVERITY_COLORS[key],
      }))
      .filter((seg) => seg.count > 0)
      .map((seg) => ({
        ...seg,
        widthPct: (seg.count / totalReports) * 100,
      }))
  }, [severityCounts, totalReports])

  if (!open) return null

  return (
    <div
      className="siara-cluster-panel-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Accident cluster details"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose?.()
      }}
    >
      <div className="siara-cluster-panel">
        <div className="siara-cluster-panel__header">
          <span className="siara-cluster-panel__icon" aria-hidden="true">
            <LocalFireDepartmentOutlinedIcon fontSize="inherit" className="icon-fire" />
          </span>
          <h3 className="siara-cluster-panel__title">Why is this place dangerous?</h3>
          <button
            type="button"
            className="siara-cluster-panel__close"
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {state === 'loading' ? (
          <>
            <div className="siara-cluster-panel__skeleton" />
            <div className="siara-cluster-panel__skeleton" style={{ width: '70%' }} />
            <div className="siara-cluster-panel__skeleton" />
          </>
        ) : null}

        {state === 'error' ? (
          <p className="siara-cluster-panel__error" role="alert">{error}</p>
        ) : null}

        {state === 'success' && detail ? (
          <>
            <p className="siara-cluster-panel__summary">{detail.explanation}</p>

            <div className="siara-cluster-panel__metrics">
              <div className="siara-cluster-panel__metric">
                <span className="siara-cluster-panel__metric-label">Reports</span>
                <span className="siara-cluster-panel__metric-value">{detail.reportCount}</span>
                <span className="siara-cluster-panel__metric-sub">in this zone</span>
              </div>
              <div className="siara-cluster-panel__metric">
                <span className="siara-cluster-panel__metric-label">Police-verified</span>
                <span className="siara-cluster-panel__metric-value">{detail.verifiedCount}</span>
                <span className="siara-cluster-panel__metric-sub">
                  {detail.reportCount > 0
                    ? `${Math.round((detail.verifiedCount / detail.reportCount) * 100)}% of reports`
                    : '—'}
                </span>
              </div>
              <div className="siara-cluster-panel__metric">
                <span className="siara-cluster-panel__metric-label">Peak window</span>
                <span className="siara-cluster-panel__metric-value">
                  {detail.peakHourRange
                    ? `${String(detail.peakHourRange.startHour).padStart(2, '0')}:00–${String(detail.peakHourRange.endHour).padStart(2, '0')}:00`
                    : '—'}
                </span>
                <span className="siara-cluster-panel__metric-sub">
                  {detail.peakHourRange
                    ? `${detail.peakHourRange.reportCount} reports in window`
                    : 'not enough data'}
                </span>
              </div>
              <div className="siara-cluster-panel__metric">
                <span className="siara-cluster-panel__metric-label">Latest</span>
                <span className="siara-cluster-panel__metric-value">
                  {detail.latestReportAt
                    ? new Date(detail.latestReportAt).toLocaleDateString()
                    : '—'}
                </span>
                <span className="siara-cluster-panel__metric-sub">most recent report</span>
              </div>
            </div>

            {severitySegments.length > 0 ? (
              <>
                <div className="siara-cluster-panel__severity-bar" aria-hidden="true">
                  {severitySegments.map((seg) => (
                    <span
                      key={seg.key}
                      className="siara-cluster-panel__severity-segment"
                      style={{ width: `${seg.widthPct}%`, background: seg.color }}
                    />
                  ))}
                </div>
                <div className="siara-cluster-panel__severity-legend">
                  {severitySegments.map((seg) => (
                    <span key={`legend-${seg.key}`}>
                      <span
                        className="siara-cluster-panel__severity-dot"
                        style={{ background: seg.color }}
                      />
                      {seg.count} {seg.key}
                    </span>
                  ))}
                </div>
              </>
            ) : null}

            {Array.isArray(detail.commonReportTypes) && detail.commonReportTypes.length > 0 ? (
              <div className="siara-cluster-panel__severity-legend">
                Common types:&nbsp;
                {detail.commonReportTypes.map((t, idx) => (
                  <span key={`type-${t.type}-${idx}`}>
                    {t.label || t.type} ({t.count}){idx < detail.commonReportTypes.length - 1 ? ',' : ''}
                  </span>
                ))}
              </div>
            ) : null}

            <Link
              to={`/zone-profile?lat=${encodeURIComponent(detail.center?.lat)}&lng=${encodeURIComponent(detail.center?.lng)}&radiusMeters=${encodeURIComponent(Math.max(detail.radiusMeters || 250, 500))}`}
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: '#007BFF',
                textDecoration: 'none',
              }}
            >
              View full zone safety profile <ArrowForwardRoundedIcon fontSize="inherit" sx={{ verticalAlign: 'middle', ml: 0.25 }} />
            </Link>

            <h4 className="siara-cluster-panel__reports-title">
              Reports in this zone ({detail.reports.length})
            </h4>
            {detail.reports.length === 0 ? (
              <p className="siara-cluster-panel__empty">
                No individual reports could be loaded for this cluster.
              </p>
            ) : (
              <>
                <ul className="siara-cluster-panel__reports">
                  {(showAllReports ? detail.reports : detail.reports.slice(0, 10)).map(
                    (report) => (
                      <li key={`cluster-report-${report.id}`}>
                        <Link
                          to={`/incident/${report.id}`}
                          className="siara-cluster-panel__report"
                        >
                          <span className="siara-cluster-panel__report-title">
                            {report.title || `Report #${report.id}`}
                          </span>
                          <span className="siara-cluster-panel__report-meta">
                            <span
                              className={`siara-cluster-panel__report-pill ${severityClass(report.severityBucket)}`}
                            >
                              {report.severityBucket || 'low'}
                            </span>
                            {report.verifiedByPolice ? (
                              <span className="siara-cluster-panel__report-pill siara-cluster-panel__report-pill--verified">
                                Police-verified
                              </span>
                            ) : null}
                            <span>{formatDateTime(report.createdAt)}</span>
                            {report.incidentType ? (
                              <span>{String(report.incidentType).replace(/_/g, ' ')}</span>
                            ) : null}
                          </span>
                          {report.descriptionSnippet ? (
                            <span className="siara-cluster-panel__report-snippet">
                              {report.descriptionSnippet}
                            </span>
                          ) : null}
                        </Link>
                      </li>
                    ),
                  )}
                </ul>
                {detail.reports.length > 10 ? (
                  <button
                    type="button"
                    className="siara-cluster-panel__close"
                    style={{
                      alignSelf: 'flex-start',
                      color: '#007BFF',
                      fontSize: 12,
                      fontWeight: 700,
                      padding: '6px 0',
                    }}
                    onClick={() => setShowAllReports((v) => !v)}
                  >
                    {showAllReports
                      ? 'Show fewer'
                      : `View all ${detail.reports.length} reports`}
                  </button>
                ) : null}
              </>
            )}
          </>
        ) : null}
      </div>
    </div>
  )
}

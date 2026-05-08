import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import RouteOutlinedIcon from '@mui/icons-material/RouteOutlined'
import TrendingUpRoundedIcon from '@mui/icons-material/TrendingUpRounded'
import TrendingDownRoundedIcon from '@mui/icons-material/TrendingDownRounded'
import '../../styles/RoadSafetyProfile.css'

function severityClass(bucket) {
  const text = String(bucket || '').toLowerCase()
  if (text === 'critical') return 'dominant-critical'
  if (text === 'high') return 'dominant-high'
  if (text === 'moderate' || text === 'medium') return 'dominant-moderate'
  return 'dominant-low'
}

function trendClass(trend) {
  return `trend-${trend || 'flat'}`
}

function TrendLabel({ profile }) {
  if (!profile) return null
  if (profile.trend === 'increasing') {
    return (
      <>
        <TrendingUpRoundedIcon fontSize="inherit" className="icon-warning" sx={{ verticalAlign: 'middle', mr: 0.25 }} />
        {profile.trendChangePercent}% vs prev 30d
      </>
    )
  }
  if (profile.trend === 'decreasing') {
    return (
      <>
        <TrendingDownRoundedIcon fontSize="inherit" className="icon-success" sx={{ verticalAlign: 'middle', mr: 0.25 }} />
        {Math.abs(profile.trendChangePercent)}% vs prev 30d
      </>
    )
  }
  return <>stable vs prev 30d</>
}

function formatHourRange(range) {
  if (!range || !Number.isFinite(Number(range.startHour))) return '—'
  return `${String(range.startHour).padStart(2, '0')}:00 – ${String(range.endHour).padStart(2, '0')}:00`
}

export default function RoadSafetyProfileCard({ profile, title = 'Road / zone safety profile' }) {
  const monthlyMax = useMemo(() => {
    if (!Array.isArray(profile?.monthlyTrend) || profile.monthlyTrend.length === 0) return 1
    return Math.max(1, ...profile.monthlyTrend.map((m) => Number(m.count) || 0))
  }, [profile])

  if (!profile) {
    return (
      <div className="siara-zp">
        <div className="siara-zp__header">
          <span className="siara-zp__icon" aria-hidden="true">
            <RouteOutlinedIcon fontSize="inherit" />
          </span>
          <h3 className="siara-zp__title">{title}</h3>
        </div>
        <div className="siara-zp__empty">No profile data available.</div>
      </div>
    )
  }

  return (
    <section className="siara-zp">
      <div className="siara-zp__header">
        <span className="siara-zp__icon" aria-hidden="true">
          <RouteOutlinedIcon fontSize="inherit" />
        </span>
        <h3 className="siara-zp__title">{title}</h3>
        <span className={`siara-zp__pill ${severityClass(profile.dominantSeverity)}`}>
          {profile.dominantSeverity || 'low'}
        </span>
        <span className={`siara-zp__pill ${trendClass(profile.trend)}`}>
          <TrendLabel profile={profile} />
        </span>
      </div>

      <div className="siara-zp__metrics">
        <div className="siara-zp__metric">
          <span className="siara-zp__metric-label">Reports</span>
          <span className="siara-zp__metric-value">{profile.reportCount}</span>
          <span className="siara-zp__metric-sub">in {Math.round(profile.radiusMeters)} m</span>
        </div>
        <div className="siara-zp__metric">
          <span className="siara-zp__metric-label">Avg risk</span>
          <span className="siara-zp__metric-value">{profile.avgRiskApprox}%</span>
          <span className="siara-zp__metric-sub">approximate</span>
        </div>
        <div className="siara-zp__metric">
          <span className="siara-zp__metric-label">Last 30 days</span>
          <span className="siara-zp__metric-value">{profile.reportsLast30Days}</span>
          <span className="siara-zp__metric-sub">vs {profile.reportsPrev30Days} prev</span>
        </div>
        <div className="siara-zp__metric">
          <span className="siara-zp__metric-label">Police-verified</span>
          <span className="siara-zp__metric-value">{profile.verifiedCount}</span>
          <span className="siara-zp__metric-sub">all-time</span>
        </div>
        <div className="siara-zp__metric">
          <span className="siara-zp__metric-label">Peak window</span>
          <span className="siara-zp__metric-value">{formatHourRange(profile.peakHourRange)}</span>
          <span className="siara-zp__metric-sub">most common hour</span>
        </div>
      </div>

      {Array.isArray(profile.monthlyTrend) && profile.monthlyTrend.length > 0 ? (
        <>
          <h4 className="siara-zp__list-title">Reports per month (last 6 months)</h4>
          <div className="siara-zp__chart" aria-hidden="true">
            {profile.monthlyTrend.map((m) => (
              <div className="siara-zp__chart-bar" key={`tm-${m.month}`}>
                <span
                  className="siara-zp__chart-fill"
                  style={{ height: `${Math.max(8, (Number(m.count) / monthlyMax) * 100)}%` }}
                />
                <span className="siara-zp__chart-label">{(m.month || '').slice(5)}</span>
                <span className="siara-zp__chart-label" style={{ fontWeight: 700, color: '#0F172A' }}>
                  {m.count}
                </span>
              </div>
            ))}
          </div>
        </>
      ) : null}

      {Array.isArray(profile.commonReportTypes) && profile.commonReportTypes.length > 0 ? (
        <>
          <h4 className="siara-zp__list-title">Most common types</h4>
          <div className="siara-zp__chips">
            {profile.commonReportTypes.map((t) => (
              <span className="siara-zp__chip" key={`type-${t.type}`}>
                {t.label} <strong>{t.count}</strong>
              </span>
            ))}
          </div>
        </>
      ) : null}

      {Array.isArray(profile.peakDays) && profile.peakDays.length > 0 ? (
        <>
          <h4 className="siara-zp__list-title">Peak days</h4>
          <div className="siara-zp__chips">
            {profile.peakDays.map((d, idx) => (
              <span className="siara-zp__chip" key={`dow-${d.label}-${idx}`}>
                {d.label} <strong>{d.count}</strong>
              </span>
            ))}
          </div>
        </>
      ) : null}

      {Array.isArray(profile.recentReports) && profile.recentReports.length > 0 ? (
        <>
          <h4 className="siara-zp__list-title">Recent reports in this zone</h4>
          <ul className="siara-zp__recent">
            {profile.recentReports.map((r) => (
              <li key={`recent-${r.reportId}`}>
                <Link to={`/incident/${r.reportId}`} className="siara-zp__recent-item">
                  <span className="siara-zp__recent-title">{r.title}</span>
                  <span>· {r.severityBucket}</span>
                  {r.verified ? <span>· verified</span> : null}
                  {r.createdAt ? (
                    <span>· {new Date(r.createdAt).toLocaleDateString()}</span>
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </section>
  )
}

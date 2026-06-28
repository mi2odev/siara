import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import RouteOutlinedIcon from '@mui/icons-material/RouteOutlined'
import TrendingUpRoundedIcon from '@mui/icons-material/TrendingUpRounded'
import TrendingDownRoundedIcon from '@mui/icons-material/TrendingDownRounded'
import '../../styles/RoadSafetyProfile.css'

function severityClass(bucket) {
  const text = String(bucket || '').toLowerCase()
  if (text === 'high') return 'dominant-high'
  if (text === 'medium') return 'dominant-medium'
  return 'dominant-low'
}

function trendClass(trend) {
  return `trend-${trend || 'flat'}`
}

function TrendLabel({ profile }) {
  const { t } = useTranslation(['pages', 'common'])
  if (!profile) return null
  if (profile.trend === 'increasing') {
    return (
      <>
        <TrendingUpRoundedIcon fontSize="inherit" className="icon-warning" sx={{ verticalAlign: 'middle', mr: 0.25 }} />
        {profile.trendChangePercent}% {t('roadSafetyProfileCard.vsPrev30d')}
      </>
    )
  }
  if (profile.trend === 'decreasing') {
    return (
      <>
        <TrendingDownRoundedIcon fontSize="inherit" className="icon-success" sx={{ verticalAlign: 'middle', mr: 0.25 }} />
        {Math.abs(profile.trendChangePercent)}% {t('roadSafetyProfileCard.vsPrev30d')}
      </>
    )
  }
  return <>{t('roadSafetyProfileCard.stableVsPrev30d')}</>
}

function formatHourRange(range) {
  if (!range || !Number.isFinite(Number(range.startHour))) return '—'
  return `${String(range.startHour).padStart(2, '0')}:00 – ${String(range.endHour).padStart(2, '0')}:00`
}

export default function RoadSafetyProfileCard({ profile, title }) {
  const { t } = useTranslation(['pages', 'common'])
  const resolvedTitle = title ?? t('roadSafetyProfileCard.title')

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
          <h3 className="siara-zp__title">{resolvedTitle}</h3>
        </div>
        <div className="siara-zp__empty">{t('roadSafetyProfileCard.noProfileData')}</div>
      </div>
    )
  }

  return (
    <section className="siara-zp">
      <div className="siara-zp__header">
        <span className="siara-zp__icon" aria-hidden="true">
          <RouteOutlinedIcon fontSize="inherit" />
        </span>
        <h3 className="siara-zp__title">{resolvedTitle}</h3>
        <span className={`siara-zp__pill ${severityClass(profile.dominantSeverity)}`}>
          {profile.dominantSeverity || t('roadSafetyProfileCard.severityLow')}
        </span>
        <span className={`siara-zp__pill ${trendClass(profile.trend)}`}>
          <TrendLabel profile={profile} />
        </span>
      </div>

      <div className="siara-zp__metrics">
        <div className="siara-zp__metric">
          <span className="siara-zp__metric-label">{t('roadSafetyProfileCard.metrics.reports')}</span>
          <span className="siara-zp__metric-value">{profile.reportCount}</span>
          <span className="siara-zp__metric-sub">{t('roadSafetyProfileCard.metrics.inRadius', { radius: Math.round(profile.radiusMeters) })}</span>
        </div>
        <div className="siara-zp__metric">
          <span className="siara-zp__metric-label">{t('roadSafetyProfileCard.metrics.avgRisk')}</span>
          <span className="siara-zp__metric-value">{profile.avgRiskApprox}%</span>
          <span className="siara-zp__metric-sub">{t('roadSafetyProfileCard.metrics.approximate')}</span>
        </div>
        <div className="siara-zp__metric">
          <span className="siara-zp__metric-label">{t('roadSafetyProfileCard.metrics.last30Days')}</span>
          <span className="siara-zp__metric-value">{profile.reportsLast30Days}</span>
          <span className="siara-zp__metric-sub">{t('roadSafetyProfileCard.metrics.vsPrev', { count: profile.reportsPrev30Days })}</span>
        </div>
        <div className="siara-zp__metric">
          <span className="siara-zp__metric-label">{t('roadSafetyProfileCard.metrics.policeVerified')}</span>
          <span className="siara-zp__metric-value">{profile.verifiedCount}</span>
          <span className="siara-zp__metric-sub">{t('roadSafetyProfileCard.metrics.allTime')}</span>
        </div>
        <div className="siara-zp__metric">
          <span className="siara-zp__metric-label">{t('roadSafetyProfileCard.metrics.peakWindow')}</span>
          <span className="siara-zp__metric-value">{formatHourRange(profile.peakHourRange)}</span>
          <span className="siara-zp__metric-sub">{t('roadSafetyProfileCard.metrics.mostCommonHour')}</span>
        </div>
      </div>

      {Array.isArray(profile.monthlyTrend) && profile.monthlyTrend.length > 0 ? (
        <>
          <h4 className="siara-zp__list-title">{t('roadSafetyProfileCard.reportsPerMonth')}</h4>
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
          <h4 className="siara-zp__list-title">{t('roadSafetyProfileCard.mostCommonTypes')}</h4>
          <div className="siara-zp__chips">
            {profile.commonReportTypes.map((rt) => (
              <span className="siara-zp__chip" key={`type-${rt.type}`}>
                {rt.label} <strong>{rt.count}</strong>
              </span>
            ))}
          </div>
        </>
      ) : null}

      {Array.isArray(profile.peakDays) && profile.peakDays.length > 0 ? (
        <>
          <h4 className="siara-zp__list-title">{t('roadSafetyProfileCard.peakDays')}</h4>
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
          <h4 className="siara-zp__list-title">{t('roadSafetyProfileCard.recentReports')}</h4>
          <ul className="siara-zp__recent">
            {profile.recentReports.map((r) => (
              <li key={`recent-${r.reportId}`}>
                <Link to={`/incident/${r.reportId}`} className="siara-zp__recent-item">
                  <span className="siara-zp__recent-title">{r.title}</span>
                  <span>· {r.severityBucket}</span>
                  {r.verified ? <span>· {t('roadSafetyProfileCard.verified')}</span> : null}
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

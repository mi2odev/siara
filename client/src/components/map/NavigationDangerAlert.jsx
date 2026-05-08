import NotificationsActiveOutlinedIcon from '@mui/icons-material/NotificationsActiveOutlined'
import WarningAmberOutlinedIcon from '@mui/icons-material/WarningAmberOutlined'
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'
import '../../styles/NavigationDangerAlert.css'

const SEVERITY_ICON = {
  extreme: { Icon: NotificationsActiveOutlinedIcon, color: 'icon-danger' },
  high:    { Icon: WarningAmberOutlinedIcon,       color: 'icon-warning' },
  moderate:{ Icon: WarningAmberOutlinedIcon,       color: 'icon-warning' },
  low:     { Icon: InfoOutlinedIcon,                color: 'icon-info' },
}

function severityClass(severity) {
  const text = String(severity || '').toLowerCase()
  if (text === 'extreme' || text === 'critical') return 'severity-extreme'
  if (text === 'high') return 'severity-high'
  if (text === 'moderate' || text === 'medium') return 'severity-moderate'
  return 'severity-low'
}

function severityLabel(severity) {
  const text = String(severity || '').toLowerCase()
  if (text === 'extreme' || text === 'critical') return 'Critical'
  if (text === 'high') return 'High'
  if (text === 'moderate' || text === 'medium') return 'Moderate'
  if (text === 'low') return 'Low'
  return 'Risk'
}

function formatDistance(meters) {
  const n = Number(meters)
  if (!Number.isFinite(n)) return ''
  if (n < 1000) return `${Math.round(n)} m ahead`
  return `${(n / 1000).toFixed(1)} km ahead`
}

export default function NavigationDangerAlert({
  alert,
  totalAlerts = 1,
  onDismiss,
  onFindSaferRoute,
  rerouting = false,
}) {
  if (!alert) return null

  const sevClass = severityClass(alert.severity)
  const sevConfig = SEVERITY_ICON[String(alert.severity || '').toLowerCase()] || { Icon: WarningAmberOutlinedIcon, color: 'icon-warning' }
  const { Icon, color: iconColor } = sevConfig
  const distanceLabel = formatDistance(alert.distanceAheadMeters)

  return (
    <div
      className={`siara-nav-alert ${sevClass}`}
      role="alert"
      aria-live="assertive"
    >
      <div className="siara-nav-alert__top">
        <span className="siara-nav-alert__icon" aria-hidden="true"><Icon fontSize="inherit" className={iconColor} /></span>
        <h5 className="siara-nav-alert__title">
          {alert.title || 'New incident reported ahead'}
        </h5>
        <span className={`siara-nav-alert__chip ${sevClass}`}>
          {severityLabel(alert.severity)}
        </span>
      </div>

      {alert.message ? (
        <p className="siara-nav-alert__message">{alert.message}</p>
      ) : null}

      <div className="siara-nav-alert__meta">
        {distanceLabel ? <span>{distanceLabel}</span> : null}
        {alert.verifiedByPolice ? <span>Police-verified</span> : null}
        {alert.createdAt ? (
          <span>{new Date(alert.createdAt).toLocaleTimeString().slice(0, 5)}</span>
        ) : null}
      </div>

      {totalAlerts > 1 ? (
        <div className="siara-nav-alert__more" aria-live="polite">
          + {totalAlerts - 1} more {totalAlerts - 1 === 1 ? 'alert' : 'alerts'} on the route
          ahead
        </div>
      ) : null}

      <div className="siara-nav-alert__actions">
        <button
          type="button"
          className="siara-nav-alert__btn siara-nav-alert__btn--secondary"
          onClick={() => {
            if (typeof onDismiss === 'function') onDismiss(alert)
          }}
        >
          Keep route
        </button>
        {typeof onFindSaferRoute === 'function' ? (
          <button
            type="button"
            className="siara-nav-alert__btn siara-nav-alert__btn--primary"
            onClick={() => onFindSaferRoute(alert)}
            disabled={rerouting}
          >
            {rerouting ? 'Recalculating…' : 'Find safer route'}
          </button>
        ) : null}
      </div>
    </div>
  )
}

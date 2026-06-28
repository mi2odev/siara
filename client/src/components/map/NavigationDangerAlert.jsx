import { useTranslation } from 'react-i18next'
import NotificationsActiveOutlinedIcon from '@mui/icons-material/NotificationsActiveOutlined'
import WarningAmberOutlinedIcon from '@mui/icons-material/WarningAmberOutlined'
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'
import '../../styles/NavigationDangerAlert.css'

const SEVERITY_ICON = {
  high:   { Icon: WarningAmberOutlinedIcon,       color: 'icon-warning' },
  medium: { Icon: WarningAmberOutlinedIcon,       color: 'icon-warning' },
  low:    { Icon: InfoOutlinedIcon,                color: 'icon-info' },
}

function severityClass(severity) {
  const text = String(severity || '').toLowerCase()
  if (text === 'high') return 'severity-high'
  if (text === 'medium') return 'severity-medium'
  return 'severity-low'
}

function getSeverityLabel(severity, t) {
  const text = String(severity || '').toLowerCase()
  if (text === 'high') return t('navigationDangerAlert.severity.high')
  if (text === 'medium') return t('navigationDangerAlert.severity.medium')
  if (text === 'low') return t('navigationDangerAlert.severity.low')
  return t('navigationDangerAlert.severity.risk')
}

function getDistanceLabel(meters, t) {
  const n = Number(meters)
  if (!Number.isFinite(n)) return ''
  if (n < 1000) return t('navigationDangerAlert.distance.meters', { distance: Math.round(n) })
  return t('navigationDangerAlert.distance.kilometers', { distance: (n / 1000).toFixed(1) })
}

export default function NavigationDangerAlert({
  alert,
  totalAlerts = 1,
  onDismiss,
  onFindSaferRoute,
  rerouting = false,
}) {
  const { t } = useTranslation(['map', 'common'])

  if (!alert) return null

  const sevClass = severityClass(alert.severity)
  const sevConfig = SEVERITY_ICON[String(alert.severity || '').toLowerCase()] || { Icon: WarningAmberOutlinedIcon, color: 'icon-warning' }
  const { Icon, color: iconColor } = sevConfig
  const distanceLabel = getDistanceLabel(alert.distanceAheadMeters, t)

  return (
    <div
      className={`siara-nav-alert ${sevClass}`}
      role="alert"
      aria-live="assertive"
    >
      <div className="siara-nav-alert__top">
        <span className="siara-nav-alert__icon" aria-hidden="true"><Icon fontSize="inherit" className={iconColor} /></span>
        <h5 className="siara-nav-alert__title">
          {alert.title || t('navigationDangerAlert.defaultTitle')}
        </h5>
        <span className={`siara-nav-alert__chip ${sevClass}`}>
          {getSeverityLabel(alert.severity, t)}
        </span>
      </div>

      {alert.message ? (
        <p className="siara-nav-alert__message">{alert.message}</p>
      ) : null}

      <div className="siara-nav-alert__meta">
        {distanceLabel ? <span>{distanceLabel}</span> : null}
        {alert.verifiedByPolice ? <span>{t('navigationDangerAlert.policeVerified')}</span> : null}
        {alert.createdAt ? (
          <span>{new Date(alert.createdAt).toLocaleTimeString().slice(0, 5)}</span>
        ) : null}
      </div>

      {totalAlerts > 1 ? (
        <div className="siara-nav-alert__more" aria-live="polite">
          {t('navigationDangerAlert.moreAlerts', { count: totalAlerts - 1 })}
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
          {t('navigationDangerAlert.keepRoute')}
        </button>
        {typeof onFindSaferRoute === 'function' ? (
          <button
            type="button"
            className="siara-nav-alert__btn siara-nav-alert__btn--primary"
            onClick={() => onFindSaferRoute(alert)}
            disabled={rerouting}
          >
            {rerouting ? t('navigationDangerAlert.recalculating') : t('navigationDangerAlert.findSaferRoute')}
          </button>
        ) : null}
      </div>
    </div>
  )
}

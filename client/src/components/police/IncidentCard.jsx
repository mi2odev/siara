import React from 'react'
import { useTranslation } from 'react-i18next'

import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined'
import LocationOnOutlinedIcon from '@mui/icons-material/LocationOnOutlined'
import AccessTimeOutlinedIcon from '@mui/icons-material/AccessTimeOutlined'
import PriorityHighRoundedIcon from '@mui/icons-material/PriorityHighRounded'
import ReportProblemOutlinedIcon from '@mui/icons-material/ReportProblemOutlined'
import CheckCircleOutlinedIcon from '@mui/icons-material/CheckCircleOutlined'

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

export default function IncidentCard({
  incident,
  onClick,
  active = false,
  topRight,
  extraBadges = [],
  description,
  metaExtras = [],
  reasons = [],
  actions,
}) {
  const { t } = useTranslation(['police', 'common'])

  const severity = incident.severity || 'low'
  const status = incident.status || 'pending'

  const handleKey = (e) => {
    if (!onClick) return
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onClick(e)
    }
  }

  const resolvedActions = actions && actions.length > 0
    ? actions
    : [{
        label: t('incidentCard.actions.view'),
        icon: <VisibilityOutlinedIcon fontSize="inherit" />,
        onClick,
        variant: 'primary',
        ariaLabel: incident.displayId
          ? t('incidentCard.actions.viewAriaWithId', { id: incident.displayId })
          : t('incidentCard.actions.viewAria'),
      }]

  return (
    <div
      className={`pic-row pic-row--${severity}${active ? ' pic-row--active' : ''}`}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={handleKey}
    >
      <span className={`pic-strip pic-strip--${severity}`} />

      <div className="pic-info">
        <div className="pic-badges">
          {incident.displayId && <code className="pic-id">{incident.displayId}</code>}
          <span className={`pic-sev pic-sev--${severity}`}>
            <SeverityIcon severity={severity} />
            {displayLabel(severity)}
          </span>
          <span className={`pic-status pic-status--${status}`}>
            {displayLabel(status)}
          </span>
          {extraBadges.map((b, i) => (
            <span
              key={`badge-${i}`}
              className={`pic-badge${b.kind ? ` pic-badge--${b.kind}` : ''}`}
            >
              {b.icon}
              {b.label}
            </span>
          ))}
          {topRight != null && <span className="pic-topright">{topRight}</span>}
        </div>

        <p className="pic-title">{incident.title || t('incidentCard.untitledIncident')}</p>

        {description && <p className="pic-desc">{description}</p>}

        <div className="pic-meta">
          {incident.locationText && (
            <span className="pic-loc">
              <LocationOnOutlinedIcon fontSize="inherit" />
              {incident.locationText}
            </span>
          )}
          {incident.timeAgo && (
            <span className="pic-time">
              <AccessTimeOutlinedIcon fontSize="inherit" />
              {incident.timeAgo}
            </span>
          )}
          {incident.reportedBy?.name && (
            <span className="pic-reporter">{t('incidentCard.reportedBy', { name: incident.reportedBy.name })}</span>
          )}
          {metaExtras.map((m, i) => (
            <span key={`meta-${i}`} className="pic-meta-extra">
              {m.icon}
              {m.label}
            </span>
          ))}
        </div>

        {reasons.length > 0 && (
          <div className="pic-reasons">
            {reasons.map((r, i) => (
              <span key={`reason-${i}`} className="pic-reason">{r}</span>
            ))}
          </div>
        )}
      </div>

      <div className="pic-actions">
        {resolvedActions.map((a, i) => (
          <button
            key={`act-${i}`}
            type="button"
            className={`pic-btn pic-btn--${a.variant || 'primary'}`}
            onClick={(e) => { e.stopPropagation(); a.onClick?.(e) }}
            aria-label={a.ariaLabel}
            disabled={a.disabled}
          >
            {a.icon}
            {a.label}
          </button>
        ))}
      </div>
    </div>
  )
}

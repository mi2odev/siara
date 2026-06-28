import React from 'react'
import { useTranslation } from 'react-i18next'
import BadgeOutlinedIcon from '@mui/icons-material/BadgeOutlined'
import PlaceOutlinedIcon from '@mui/icons-material/PlaceOutlined'

function getInitials(name) {
  return String(name || 'O')
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

export default function PoliceOfficerPanel({ officer, workZone, workZoneAction, children }) {
  const { t } = useTranslation(['police', 'common'])
  return (
    <div className="pop-panel">

      {/* Officer card */}
      <div className="pop-card">
        <div className="pop-card-head">
          <span className="pop-card-title">{t('policeOfficerPanel.officerTitle')}</span>
          <span className={`pop-duty pop-duty--${officer?.isOnDuty ? 'on' : 'off'}`}>
            <span className="pop-duty-dot" />
            {officer?.isOnDuty ? t('policeOfficerPanel.onDuty') : t('policeOfficerPanel.offDuty')}
          </span>
        </div>
        <div className="pop-officer-row">
          {officer?.avatarUrl
            ? <img src={officer.avatarUrl} alt={officer.name} className="pop-avatar-img" />
            : <span className="pop-avatar">{getInitials(officer?.name)}</span>
          }
          <div className="pop-officer-meta">
            <strong>{officer?.name || t('policeOfficerPanel.defaultName')}</strong>
            <span>{officer?.rank || t('policeOfficerPanel.defaultRank')}</span>
          </div>
        </div>
        <div className="pop-rows">
          <div className="pop-row">
            <BadgeOutlinedIcon fontSize="inherit" />
            <span>{t('policeOfficerPanel.badge')}</span>
            <strong>{officer?.badgeNumber || t('policeOfficerPanel.badgePending')}</strong>
          </div>
        </div>
      </div>

      {/* Work Zone card */}
      <div className="pop-card">
        <div className="pop-card-head">
          <span className="pop-card-title">{t('policeOfficerPanel.workZoneTitle')}</span>
          {workZoneAction || null}
        </div>
        <div className="pop-rows">
          <div className="pop-row">
            <PlaceOutlinedIcon fontSize="inherit" />
            <span>{t('policeOfficerPanel.wilaya')}</span>
            <strong>{workZone?.wilaya?.name || t('policeOfficerPanel.notSet')}</strong>
          </div>
          <div className="pop-row">
            <PlaceOutlinedIcon fontSize="inherit" />
            <span>{t('policeOfficerPanel.commune')}</span>
            <strong>{workZone?.commune?.name || t('policeOfficerPanel.notSet')}</strong>
          </div>
        </div>
      </div>

      {/* Page-specific content */}
      {children}

    </div>
  )
}

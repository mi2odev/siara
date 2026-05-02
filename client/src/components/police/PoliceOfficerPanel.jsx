import React from 'react'
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
  return (
    <div className="pop-panel">

      {/* Officer card */}
      <div className="pop-card">
        <div className="pop-card-head">
          <span className="pop-card-title">Officer</span>
          <span className={`pop-duty pop-duty--${officer?.isOnDuty ? 'on' : 'off'}`}>
            <span className="pop-duty-dot" />
            {officer?.isOnDuty ? 'On Duty' : 'Off Duty'}
          </span>
        </div>
        <div className="pop-officer-row">
          {officer?.avatarUrl
            ? <img src={officer.avatarUrl} alt={officer.name} className="pop-avatar-img" />
            : <span className="pop-avatar">{getInitials(officer?.name)}</span>
          }
          <div className="pop-officer-meta">
            <strong>{officer?.name || 'Officer'}</strong>
            <span>{officer?.rank || 'Police Officer'}</span>
          </div>
        </div>
        <div className="pop-rows">
          <div className="pop-row">
            <BadgeOutlinedIcon fontSize="inherit" />
            <span>Badge</span>
            <strong>{officer?.badgeNumber || 'Pending'}</strong>
          </div>
        </div>
      </div>

      {/* Work Zone card */}
      <div className="pop-card">
        <div className="pop-card-head">
          <span className="pop-card-title">Work Zone</span>
          {workZoneAction || null}
        </div>
        <div className="pop-rows">
          <div className="pop-row">
            <PlaceOutlinedIcon fontSize="inherit" />
            <span>Wilaya</span>
            <strong>{workZone?.wilaya?.name || 'Not set'}</strong>
          </div>
          <div className="pop-row">
            <PlaceOutlinedIcon fontSize="inherit" />
            <span>Commune</span>
            <strong>{workZone?.commune?.name || 'Not set'}</strong>
          </div>
        </div>
      </div>

      {/* Page-specific content */}
      {children}

    </div>
  )
}

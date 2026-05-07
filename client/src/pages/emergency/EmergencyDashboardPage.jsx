import React, { useMemo } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

import EmergencyShell from '../../components/layout/EmergencyShell'

import LocalFireDepartmentOutlinedIcon from '@mui/icons-material/LocalFireDepartmentOutlined'
import LocalHospitalOutlinedIcon from '@mui/icons-material/LocalHospitalOutlined'
import CarCrashOutlinedIcon from '@mui/icons-material/CarCrashOutlined'
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded'
import AssignmentLateOutlinedIcon from '@mui/icons-material/AssignmentLateOutlined'
import DirectionsCarFilledOutlinedIcon from '@mui/icons-material/DirectionsCarFilledOutlined'
import TimerOutlinedIcon from '@mui/icons-material/TimerOutlined'
import LocationOnOutlinedIcon from '@mui/icons-material/LocationOnOutlined'
import RouteOutlinedIcon from '@mui/icons-material/RouteOutlined'
import MapOutlinedIcon from '@mui/icons-material/MapOutlined'
import ListAltOutlinedIcon from '@mui/icons-material/ListAltOutlined'
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded'
import RadioButtonCheckedRoundedIcon from '@mui/icons-material/RadioButtonCheckedRounded'
import NotificationsActiveOutlinedIcon from '@mui/icons-material/NotificationsActiveOutlined'

const KPIS = [
  { key: 'active',   tone: 'red',    label: 'Active Operations',  value: 7,      sub: 'Awaiting response',         icon: <AssignmentLateOutlinedIcon fontSize="inherit" />, alert: true },
  { key: 'critical', tone: 'red',    label: 'Critical Incidents', value: 2,      sub: 'Highest severity',          icon: <WarningAmberRoundedIcon fontSize="inherit" />,    alert: true },
  { key: 'units',    tone: 'green',  label: 'Available Units',    value: 11,     sub: '5 ambulance · 4 fire · 2 civil', icon: <DirectionsCarFilledOutlinedIcon fontSize="inherit" /> },
  { key: 'eta',      tone: 'blue',   label: 'Avg Response Time',  value: '6m24', sub: 'Last 30 days',              icon: <TimerOutlinedIcon fontSize="inherit" /> },
]

const INCIDENTS = [
  {
    id: 'EMG-2041',
    type: 'Multi-vehicle accident',
    severity: 'critical',
    title: 'Three-car collision blocking eastbound lanes',
    location: 'A1 Highway · km 47, Boudouaou',
    reportedAt: '2 min ago',
    injured: 2,
    status: 'unassigned',
    icon: <CarCrashOutlinedIcon fontSize="inherit" />,
  },
  {
    id: 'EMG-2040',
    type: 'Building fire',
    severity: 'critical',
    title: 'Residential fire — smoke on 3rd floor',
    location: 'Rue Didouche Mourad, Algiers',
    reportedAt: '5 min ago',
    injured: 1,
    status: 'unassigned',
    icon: <LocalFireDepartmentOutlinedIcon fontSize="inherit" />,
  },
  {
    id: 'EMG-2038',
    type: 'Injured civilian',
    severity: 'high',
    title: 'Pedestrian struck — conscious, leg trauma',
    location: 'Bd Krim Belkacem, Telemly',
    reportedAt: '11 min ago',
    injured: 1,
    status: 'en_route',
    icon: <LocalHospitalOutlinedIcon fontSize="inherit" />,
  },
  {
    id: 'EMG-2036',
    type: 'Dangerous obstacle',
    severity: 'medium',
    title: 'Cargo spill across two lanes',
    location: 'RN5, exit Rouiba',
    reportedAt: '18 min ago',
    injured: 0,
    status: 'unassigned',
    icon: <WarningAmberRoundedIcon fontSize="inherit" />,
  },
]

export default function EmergencyDashboardPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const basePath = location.pathname.startsWith('/preview/emergency') ? '/preview/emergency' : '/emergency'

  const criticalCount = useMemo(
    () => INCIDENTS.filter((i) => i.severity === 'critical').length,
    [],
  )

  return (
    <EmergencyShell unitId="AMB-A12" unitStatus="responding" activeMissions={2}>
      <header className="em-page-head">
        <div>
          <span className="em-eyebrow">
            <RadioButtonCheckedRoundedIcon style={{ fontSize: 11, marginRight: 6, verticalAlign: -1 }} />
            Operations Console
          </span>
          <h1 className="em-page-title">Emergency Dashboard</h1>
          <p className="em-page-subtitle">
            {criticalCount} critical incident{criticalCount === 1 ? '' : 's'} requiring action
          </p>
        </div>
      </header>

      {/* KPI bar (4 KPIs only per spec) */}
      <section className="em-kpi-row" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }} aria-label="Key metrics">
        {KPIS.map((kpi) => (
          <article key={kpi.key} className={`em-kpi tone-${kpi.tone} ${kpi.alert ? 'alert' : ''}`}>
            <div className="em-kpi-header">
              <span className="em-kpi-label">{kpi.label}</span>
              <span className="em-kpi-icon">{kpi.icon}</span>
            </div>
            <div className="em-kpi-value">{kpi.value}</div>
            <div className="em-kpi-sub">{kpi.sub}</div>
          </article>
        ))}
      </section>

      {/* Active Emergency Incidents */}
      <section className="em-section" aria-label="Active emergency incidents">
        <header className="em-section-head">
          <h2 className="em-section-title">
            <span className="em-section-title-icon"><NotificationsActiveOutlinedIcon fontSize="inherit" /></span>
            Active Emergency Incidents
            <span className="em-section-count">{INCIDENTS.length}</span>
          </h2>
        </header>

        <div className="em-section-body">
          <div className="em-feed">
            {INCIDENTS.map((inc) => (
              <article key={inc.id} className="em-incident-card" data-severity={inc.severity}>
                <div>
                  <div className="em-incident-head">
                    <span className="em-incident-id">{inc.id}</span>
                    <span className="em-incident-type">
                      <span style={{ display: 'inline-flex', fontSize: 14 }}>{inc.icon}</span>
                      {inc.type}
                    </span>
                    <span className={`em-sev-badge ${inc.severity}`}>{inc.severity}</span>
                    <span className="em-incident-time">{inc.reportedAt}</span>
                  </div>

                  <h3 className="em-incident-title">{inc.title}</h3>

                  <div className="em-incident-meta">
                    <span className="em-incident-meta-cell">
                      <LocationOnOutlinedIcon /> {inc.location}
                    </span>
                    {inc.injured > 0 ? (
                      <span className="em-incident-meta-cell">
                        <LocalHospitalOutlinedIcon /> {inc.injured} injured
                      </span>
                    ) : null}
                    <span className="em-incident-meta-cell">
                      Status: {inc.status === 'en_route' ? 'En-Route' : 'Unassigned'}
                    </span>
                  </div>
                </div>

                <div className="em-incident-actions">
                  {inc.status === 'en_route' ? (
                    <>
                      <button className="em-action-btn outline" onClick={() => navigate(`${basePath}/response`)}>View Details</button>
                      <button className="em-action-btn outline">Navigate</button>
                    </>
                  ) : (
                    <>
                      <button className="em-action-btn accept">Accept Mission</button>
                      <button className="em-action-btn outline" onClick={() => navigate(`${basePath}/response`)}>View Details</button>
                      <button className="em-action-btn outline">Navigate</button>
                    </>
                  )}
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Quick Actions (3 buttons per spec) */}
      <section className="em-section" aria-label="Quick actions">
        <header className="em-section-head">
          <h2 className="em-section-title">
            <span className="em-section-title-icon"><RouteOutlinedIcon fontSize="inherit" /></span>
            Quick Actions
          </h2>
        </header>
        <div className="em-section-body">
          <div className="em-quick-row">
            <button className="em-quick-tile" onClick={() => navigate(`${basePath}/map`)}>
              <span className="em-quick-tile-icon"><MapOutlinedIcon fontSize="inherit" /></span>
              <span className="em-quick-tile-text">
                <strong>Open Emergency Map</strong>
                <span>Live incident geography</span>
              </span>
            </button>
            <button className="em-quick-tile" onClick={() => navigate(`${basePath}/assigned`)}>
              <span className="em-quick-tile-icon"><ListAltOutlinedIcon fontSize="inherit" /></span>
              <span className="em-quick-tile-text">
                <strong>View Assigned Operations</strong>
                <span>2 ongoing missions</span>
              </span>
            </button>
            <button className="em-quick-tile" onClick={() => navigate(`${basePath}/alerts`)}>
              <span className="em-quick-tile-icon"><WarningAmberRoundedIcon fontSize="inherit" /></span>
              <span className="em-quick-tile-text">
                <strong>View Alerts</strong>
                <span>3 active warnings</span>
              </span>
            </button>
          </div>
        </div>
      </section>
    </EmergencyShell>
  )
}

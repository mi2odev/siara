import React, { useMemo, useState } from 'react'

import EmergencyShell from '../../components/layout/EmergencyShell'

import LocationOnOutlinedIcon from '@mui/icons-material/LocationOnOutlined'
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded'
import CarCrashOutlinedIcon from '@mui/icons-material/CarCrashOutlined'
import CloudOutlinedIcon from '@mui/icons-material/CloudOutlined'
import BlockOutlinedIcon from '@mui/icons-material/BlockOutlined'
import GroupsOutlinedIcon from '@mui/icons-material/GroupsOutlined'

const ALERTS = [
  {
    id: 'WARN-08',
    severity: 'high',
    type: 'accident',
    title: 'Bus collision corridor RN1 — possible 12+ casualties',
    location: 'RN1 km 12, Larbaa',
    time: '14:21',
    icon: <CarCrashOutlinedIcon fontSize="inherit" />,
  },
  {
    id: 'WARN-07',
    severity: 'high',
    type: 'weather',
    title: 'Heavy rain — reduced visibility on coastal roads',
    location: 'Algiers · Tipaza',
    time: '13:58',
    icon: <CloudOutlinedIcon fontSize="inherit" />,
  },
  {
    id: 'WARN-06',
    severity: 'high',
    type: 'blockage',
    title: 'Road blocked — overturned truck on RN5',
    location: 'RN5, exit Rouiba',
    time: '13:42',
    icon: <BlockOutlinedIcon fontSize="inherit" />,
  },
  {
    id: 'WARN-05',
    severity: 'medium',
    type: 'zone',
    title: 'High-risk zone activated — repeated accidents reported',
    location: 'El Harrach junction',
    time: '12:30',
    icon: <WarningAmberRoundedIcon fontSize="inherit" />,
  },
  {
    id: 'WARN-04',
    severity: 'medium',
    type: 'accident',
    title: 'Two-vehicle collision — one ambulance dispatched',
    location: 'Bd des Martyrs, Alger Centre',
    time: '12:08',
    icon: <CarCrashOutlinedIcon fontSize="inherit" />,
  },
]

const FILTERS = [
  { key: 'all',      label: 'All' },
  { key: 'high',     label: 'High' },
  { key: 'medium',   label: 'Medium' },
  { key: 'low',      label: 'Low' },
]

export default function EmergencyAlertsPage() {
  const [filter, setFilter] = useState('all')

  const visible = useMemo(
    () => (filter === 'all' ? ALERTS : ALERTS.filter((a) => a.severity === filter)),
    [filter],
  )

  return (
    <EmergencyShell unitId="AMB-A12" unitStatus="responding" activeMissions={2}>
      <header className="em-page-head">
        <div>
          <span className="em-eyebrow">High-Severity Notices</span>
          <h1 className="em-page-title">Emergency Alerts</h1>
          <p className="em-page-subtitle">{visible.length} active alert{visible.length === 1 ? '' : 's'}</p>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {FILTERS.map((f) => (
            <button
              key={f.key}
              className={`em-btn ${filter === f.key ? 'em-btn-primary' : ''}`}
              onClick={() => setFilter(f.key)}
              style={{ padding: '8px 14px', fontSize: 12 }}
            >
              {f.label}
            </button>
          ))}
        </div>
      </header>

      <section className="em-section">
        <header className="em-section-head">
          <h2 className="em-section-title">
            <span className="em-section-title-icon" style={{ background: 'var(--em-red-soft)', color: 'var(--em-red)' }}>
              <WarningAmberRoundedIcon fontSize="inherit" />
            </span>
            Active Alerts
            <span className="em-section-count">{visible.length}</span>
          </h2>
        </header>

        <div className="em-section-body">
          <div className="em-alerts-list">
            {visible.map((alert) => (
              <article key={alert.id} className="em-alert-row" data-severity={alert.severity}>
                <div className="em-alert-body">
                  <span className="em-alert-icon">{alert.icon}</span>
                  <div className="em-alert-text">
                    <div className="em-incident-head" style={{ marginBottom: 0, gap: 6 }}>
                      <span className="em-incident-id">{alert.id}</span>
                      <span className={`em-sev-badge ${alert.severity}`}>{alert.severity}</span>
                    </div>
                    <div className="em-alert-title">{alert.title}</div>
                    <div className="em-alert-meta">
                      <span><LocationOnOutlinedIcon />{alert.location}</span>
                      {alert.type === 'accident' ? <span><GroupsOutlinedIcon />Possible casualties</span> : null}
                    </div>
                  </div>
                </div>
                <div className="em-alert-time">{alert.time}</div>
              </article>
            ))}

            {visible.length === 0 ? (
              <div className="em-empty">No alerts match this filter.</div>
            ) : null}
          </div>
        </div>
      </section>
    </EmergencyShell>
  )
}

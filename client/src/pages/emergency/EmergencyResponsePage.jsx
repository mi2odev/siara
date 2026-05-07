import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'

import EmergencyShell from '../../components/layout/EmergencyShell'

import LocationOnOutlinedIcon from '@mui/icons-material/LocationOnOutlined'
import LocalHospitalOutlinedIcon from '@mui/icons-material/LocalHospitalOutlined'
import CarCrashOutlinedIcon from '@mui/icons-material/CarCrashOutlined'
import ImageOutlinedIcon from '@mui/icons-material/ImageOutlined'
import CheckCircleOutlineRoundedIcon from '@mui/icons-material/CheckCircleOutlineRounded'
import NotificationsActiveOutlinedIcon from '@mui/icons-material/NotificationsActiveOutlined'
import FlagOutlinedIcon from '@mui/icons-material/FlagOutlined'
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded'

const INCIDENT = {
  id: 'EMG-2038',
  type: 'Injured civilian',
  severity: 'high',
  title: 'Pedestrian struck — conscious, leg trauma',
  location: 'Bd Krim Belkacem, Telemly · Algiers',
  reportedAt: '14:31',
  reportedBy: 'Citizen report',
  injured: 1,
  casualties: 0,
  reliability: 76,
}

const TIMELINE = [
  { time: '14:31', tone: 'done',   text: <>Incident reported by citizen — auto-validated by SIARA.</> },
  { time: '14:35', tone: 'done',   text: <>Dispatched <strong>AMB-A12</strong> to scene.</> },
  { time: '14:42', tone: 'active', text: <>Unit <strong>en route</strong> — ETA 4 min.</> },
]

export default function EmergencyResponsePage() {
  const navigate = useNavigate()
  const [arrived, setArrived] = useState(false)
  const [closed, setClosed] = useState(false)
  const [note, setNote] = useState('')

  return (
    <EmergencyShell unitId="AMB-A12" unitStatus="responding" activeMissions={2}>
      <header className="em-page-head">
        <div>
          <span className="em-eyebrow">
            <button
              type="button"
              onClick={() => navigate(-1)}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--em-violet)', font: 'inherit', padding: 0,
                display: 'inline-flex', alignItems: 'center', gap: 4,
              }}
            >
              <ArrowBackRoundedIcon style={{ fontSize: 14 }} /> Back
            </button>
          </span>
          <h1 className="em-page-title">Incident Response</h1>
          <p className="em-page-subtitle">Operational details and intervention controls</p>
        </div>
      </header>

      <div className="em-detail-grid">
        <section className="em-section">
          <div className="em-detail-hero">
            <div className="em-detail-hero-icon"><CarCrashOutlinedIcon fontSize="inherit" /></div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="em-incident-head">
                <span className="em-incident-id">{INCIDENT.id}</span>
                <span className={`em-sev-badge ${INCIDENT.severity}`}>{INCIDENT.severity}</span>
                <span className="em-incident-type" style={{ marginLeft: 0 }}>{INCIDENT.type}</span>
              </div>
              <h2 className="em-incident-title" style={{ fontSize: 18, marginBottom: 8 }}>
                {INCIDENT.title}
              </h2>
              <div className="em-incident-meta">
                <span className="em-incident-meta-cell">
                  <LocationOnOutlinedIcon /> {INCIDENT.location}
                </span>
                <span className="em-incident-meta-cell">Reported {INCIDENT.reportedAt}</span>
              </div>
            </div>
          </div>

          <div className="em-detail-info-grid">
            <div className="em-detail-info-item">
              <div className="em-detail-info-item-label">Injured</div>
              <div className="em-detail-info-item-value mono">{INCIDENT.injured}</div>
            </div>
            <div className="em-detail-info-item">
              <div className="em-detail-info-item-label">Casualties</div>
              <div className="em-detail-info-item-value mono">{INCIDENT.casualties}</div>
            </div>
            <div className="em-detail-info-item">
              <div className="em-detail-info-item-label">Source</div>
              <div className="em-detail-info-item-value">{INCIDENT.reportedBy}</div>
            </div>
            <div className="em-detail-info-item">
              <div className="em-detail-info-item-label">Reliability</div>
              <div className="em-detail-info-item-value mono">{INCIDENT.reliability}%</div>
            </div>
          </div>

          <div style={{ padding: '4px 18px 8px', fontSize: 12, fontWeight: 600, color: 'var(--em-text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Media
          </div>
          <div className="em-media-grid">
            <div className="em-media-tile"><ImageOutlinedIcon style={{ fontSize: 28 }} /></div>
            <div className="em-media-tile"><ImageOutlinedIcon style={{ fontSize: 28 }} /></div>
            <div className="em-media-tile">No more media</div>
          </div>
        </section>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <section className="em-section">
            <header className="em-section-head">
              <h2 className="em-section-title">Actions</h2>
            </header>
            <div className="em-action-stack">
              <button
                className={`em-action-btn ${arrived ? 'success' : 'accept'}`}
                onClick={() => setArrived(true)}
                disabled={arrived}
              >
                <CheckCircleOutlineRoundedIcon style={{ fontSize: 16 }} />
                {arrived ? 'Arrival Logged' : 'Mark Arrived'}
              </button>
              <button className="em-action-btn outline">
                <NotificationsActiveOutlinedIcon style={{ fontSize: 16 }} />
                Request Backup
              </button>
              <button
                className={`em-action-btn ${closed ? 'success' : 'danger'}`}
                onClick={() => setClosed(true)}
                disabled={closed}
              >
                <FlagOutlinedIcon style={{ fontSize: 16 }} />
                {closed ? 'Mission Closed' : 'Close Mission'}
              </button>
            </div>
          </section>

          <section className="em-section">
            <header className="em-section-head">
              <h2 className="em-section-title">Operational Notes</h2>
            </header>
            <div style={{ padding: '14px 16px 16px' }}>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Add a field note for dispatch…"
                rows={4}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  border: '1px solid var(--em-border)',
                  borderRadius: 8,
                  fontFamily: 'inherit',
                  fontSize: 13,
                  color: 'var(--em-text)',
                  background: '#fff',
                  resize: 'vertical',
                  outline: 'none',
                }}
              />
              <button className="em-action-btn accept" style={{ marginTop: 10, width: '100%' }}>
                Save Note
              </button>
            </div>
          </section>

          <section className="em-section">
            <header className="em-section-head">
              <h2 className="em-section-title">
                <span className="em-section-title-icon"><LocalHospitalOutlinedIcon fontSize="inherit" /></span>
                Response Timeline
              </h2>
            </header>
            <div className="em-timeline">
              {TIMELINE.map((step, idx) => (
                <div key={idx} className="em-timeline-row" data-tone={step.tone}>
                  <span className="em-timeline-time">{step.time}</span>
                  <span className="em-timeline-marker" />
                  <span className="em-timeline-text">{step.text}</span>
                </div>
              ))}
              {arrived ? (
                <div className="em-timeline-row" data-tone="done">
                  <span className="em-timeline-time">Now</span>
                  <span className="em-timeline-marker" />
                  <span className="em-timeline-text">Unit <strong>arrived on scene</strong>.</span>
                </div>
              ) : null}
            </div>
          </section>
        </div>
      </div>
    </EmergencyShell>
  )
}

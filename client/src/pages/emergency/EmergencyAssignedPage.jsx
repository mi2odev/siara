import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation, useNavigate } from 'react-router-dom'

import EmergencyShell from '../../components/layout/EmergencyShell'

import LocationOnOutlinedIcon from '@mui/icons-material/LocationOnOutlined'
import DirectionsCarFilledOutlinedIcon from '@mui/icons-material/DirectionsCarFilledOutlined'
import EditNoteOutlinedIcon from '@mui/icons-material/EditNoteOutlined'
import CheckCircleOutlineRoundedIcon from '@mui/icons-material/CheckCircleOutlineRounded'
import RouteOutlinedIcon from '@mui/icons-material/RouteOutlined'
import AssignmentTurnedInOutlinedIcon from '@mui/icons-material/AssignmentTurnedInOutlined'

const STATUS_FLOW = ['assigned', 'en_route', 'arrived', 'completed']

const INITIAL_OPS = [
  {
    id: 'EMG-2038',
    severity: 'high',
    title: 'Pedestrian struck — leg trauma',
    location: 'Bd Krim Belkacem, Telemly',
    vehicle: 'AMB-A12',
    status: 'en_route',
  },
  {
    id: 'EMG-2031',
    severity: 'high',
    title: 'Multi-vehicle collision',
    location: 'A1 Highway km 47, Boudouaou',
    vehicle: 'AMB-A12',
    status: 'arrived',
  },
]

function nextStatus(status) {
  const idx = STATUS_FLOW.indexOf(status)
  if (idx < 0 || idx >= STATUS_FLOW.length - 1) return status
  return STATUS_FLOW[idx + 1]
}

export default function EmergencyAssignedPage() {
  const { t } = useTranslation(['emergency', 'common'])
  const navigate = useNavigate()
  const location = useLocation()
  const basePath = location.pathname.startsWith('/preview/emergency') ? '/preview/emergency' : '/emergency'

  const [ops, setOps] = useState(INITIAL_OPS)

  const advance = (id) => {
    setOps((prev) => prev.map((op) => (op.id === id ? { ...op, status: nextStatus(op.status) } : op)))
  }

  const complete = (id) => {
    setOps((prev) => prev.map((op) => (op.id === id ? { ...op, status: 'completed' } : op)))
  }

  return (
    <EmergencyShell unitId="AMB-A12" unitStatus="responding" activeMissions={ops.filter((o) => o.status !== 'completed').length}>
      <header className="em-page-head">
        <div>
          <span className="em-eyebrow">{t('emergencyAssignedPage.eyebrow')}</span>
          <h1 className="em-page-title">{t('emergencyAssignedPage.title')}</h1>
          <p className="em-page-subtitle">{t('emergencyAssignedPage.subtitle')}</p>
        </div>
      </header>

      <section className="em-section" aria-label={t('emergencyAssignedPage.sectionAriaLabel')}>
        <header className="em-section-head">
          <h2 className="em-section-title">
            <span className="em-section-title-icon"><AssignmentTurnedInOutlinedIcon fontSize="inherit" /></span>
            {t('emergencyAssignedPage.sectionTitle')}
            <span className="em-section-count">{ops.length}</span>
          </h2>
        </header>

        <div className="em-section-body">
          <div className="em-ops-list">
            {ops.map((op) => (
              <article key={op.id} className="em-ops-card">
                <div>
                  <div className="em-incident-head">
                    <span className="em-incident-id">{op.id}</span>
                    <span className={`em-sev-badge ${op.severity}`}>{op.severity}</span>
                    <span className={`em-status-pill ${op.status}`}>{t(`emergencyAssignedPage.status.${op.status}`)}</span>
                  </div>

                  <h3 className="em-incident-title">{op.title}</h3>

                  <div className="em-ops-meta">
                    <span className="em-ops-meta-cell"><LocationOnOutlinedIcon /> {op.location}</span>
                    <span className="em-ops-meta-cell"><DirectionsCarFilledOutlinedIcon /> {t('emergencyAssignedPage.vehicleLabel', { vehicle: op.vehicle })}</span>
                  </div>
                </div>

                <div className="em-ops-actions">
                  {op.status !== 'completed' && op.status !== 'arrived' ? (
                    <button className="em-action-btn accept" onClick={() => advance(op.id)}>
                      <RouteOutlinedIcon style={{ fontSize: 16 }} />
                      {t('emergencyAssignedPage.updateStatus')}
                    </button>
                  ) : null}

                  {op.status === 'arrived' ? (
                    <button className="em-action-btn success" onClick={() => complete(op.id)}>
                      <CheckCircleOutlineRoundedIcon style={{ fontSize: 16 }} />
                      {t('emergencyAssignedPage.markCompleted')}
                    </button>
                  ) : null}

                  <button className="em-action-btn outline" onClick={() => navigate(`${basePath}/response`)}>
                    <EditNoteOutlinedIcon style={{ fontSize: 16 }} />
                    {t('emergencyAssignedPage.addNotes')}
                  </button>
                </div>
              </article>
            ))}

            {ops.length === 0 ? (
              <div className="em-empty">{t('emergencyAssignedPage.empty')}</div>
            ) : null}
          </div>
        </div>
      </section>
    </EmergencyShell>
  )
}

import React, { useMemo } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

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

export default function EmergencyDashboardPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { t } = useTranslation(['emergency', 'common'])
  const basePath = location.pathname.startsWith('/preview/emergency') ? '/preview/emergency' : '/emergency'

  const KPIS = useMemo(() => [
    { key: 'active',   tone: 'red',    label: t('emergencyDashboardPage.kpi.activeOperations'),     value: 7,      sub: t('emergencyDashboardPage.kpi.awaitingResponse'),         icon: <AssignmentLateOutlinedIcon fontSize="inherit" />, alert: true },
    { key: 'high',     tone: 'red',    label: t('emergencyDashboardPage.kpi.highSeverityIncidents'), value: 2,      sub: t('emergencyDashboardPage.kpi.highestSeverity'),           icon: <WarningAmberRoundedIcon fontSize="inherit" />,    alert: true },
    { key: 'units',    tone: 'green',  label: t('emergencyDashboardPage.kpi.availableUnits'),        value: 11,     sub: t('emergencyDashboardPage.kpi.unitBreakdown'),             icon: <DirectionsCarFilledOutlinedIcon fontSize="inherit" /> },
    { key: 'eta',      tone: 'blue',   label: t('emergencyDashboardPage.kpi.avgResponseTime'),       value: '6m24', sub: t('emergencyDashboardPage.kpi.last30Days'),                icon: <TimerOutlinedIcon fontSize="inherit" /> },
  ], [t])

  const INCIDENTS = useMemo(() => [
    {
      id: 'EMG-2041',
      type: t('emergencyDashboardPage.incidents.types.multiVehicleAccident'),
      severity: 'high',
      title: t('emergencyDashboardPage.incidents.titles.threeCarCollision'),
      location: 'A1 Highway · km 47, Boudouaou',
      reportedAt: t('emergencyDashboardPage.incidents.reportedAt.2minAgo'),
      injured: 2,
      status: 'unassigned',
      icon: <CarCrashOutlinedIcon fontSize="inherit" />,
    },
    {
      id: 'EMG-2040',
      type: t('emergencyDashboardPage.incidents.types.buildingFire'),
      severity: 'high',
      title: t('emergencyDashboardPage.incidents.titles.residentialFire'),
      location: 'Rue Didouche Mourad, Algiers',
      reportedAt: t('emergencyDashboardPage.incidents.reportedAt.5minAgo'),
      injured: 1,
      status: 'unassigned',
      icon: <LocalFireDepartmentOutlinedIcon fontSize="inherit" />,
    },
    {
      id: 'EMG-2038',
      type: t('emergencyDashboardPage.incidents.types.injuredCivilian'),
      severity: 'high',
      title: t('emergencyDashboardPage.incidents.titles.pedestrianStruck'),
      location: 'Bd Krim Belkacem, Telemly',
      reportedAt: t('emergencyDashboardPage.incidents.reportedAt.11minAgo'),
      injured: 1,
      status: 'en_route',
      icon: <LocalHospitalOutlinedIcon fontSize="inherit" />,
    },
    {
      id: 'EMG-2036',
      type: t('emergencyDashboardPage.incidents.types.dangerousObstacle'),
      severity: 'medium',
      title: t('emergencyDashboardPage.incidents.titles.cargoSpill'),
      location: 'RN5, exit Rouiba',
      reportedAt: t('emergencyDashboardPage.incidents.reportedAt.18minAgo'),
      injured: 0,
      status: 'unassigned',
      icon: <WarningAmberRoundedIcon fontSize="inherit" />,
    },
  ], [t])

  const highSeverityCount = useMemo(
    () => INCIDENTS.filter((i) => i.severity === 'high').length,
    [INCIDENTS],
  )

  return (
    <EmergencyShell unitId="AMB-A12" unitStatus="responding" activeMissions={2}>
      <header className="em-page-head">
        <div>
          <span className="em-eyebrow">
            <RadioButtonCheckedRoundedIcon style={{ fontSize: 11, marginRight: 6, verticalAlign: -1 }} />
            {t('emergencyDashboardPage.operationsConsole')}
          </span>
          <h1 className="em-page-title">{t('emergencyDashboardPage.title')}</h1>
          <p className="em-page-subtitle">
            {t('emergencyDashboardPage.highSeveritySubtitle', { count: highSeverityCount })}
          </p>
        </div>
      </header>

      {/* KPI bar (4 KPIs only per spec) */}
      <section className="em-kpi-row" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }} aria-label={t('emergencyDashboardPage.ariaKeyMetrics')}>
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
      <section className="em-section" aria-label={t('emergencyDashboardPage.ariaActiveIncidents')}>
        <header className="em-section-head">
          <h2 className="em-section-title">
            <span className="em-section-title-icon"><NotificationsActiveOutlinedIcon fontSize="inherit" /></span>
            {t('emergencyDashboardPage.activeEmergencyIncidents')}
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
                        <LocalHospitalOutlinedIcon /> {t('emergencyDashboardPage.injuredCount', { count: inc.injured })}
                      </span>
                    ) : null}
                    <span className="em-incident-meta-cell">
                      {t('emergencyDashboardPage.statusLabel')}: {inc.status === 'en_route' ? t('emergencyDashboardPage.statusEnRoute') : t('emergencyDashboardPage.statusUnassigned')}
                    </span>
                  </div>
                </div>

                <div className="em-incident-actions">
                  {inc.status === 'en_route' ? (
                    <>
                      <button className="em-action-btn outline" onClick={() => navigate(`${basePath}/response`)}>{t('emergencyDashboardPage.viewDetails')}</button>
                      <button className="em-action-btn outline">{t('emergencyDashboardPage.navigate')}</button>
                    </>
                  ) : (
                    <>
                      <button className="em-action-btn accept">{t('emergencyDashboardPage.acceptMission')}</button>
                      <button className="em-action-btn outline" onClick={() => navigate(`${basePath}/response`)}>{t('emergencyDashboardPage.viewDetails')}</button>
                      <button className="em-action-btn outline">{t('emergencyDashboardPage.navigate')}</button>
                    </>
                  )}
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Quick Actions (3 buttons per spec) */}
      <section className="em-section" aria-label={t('emergencyDashboardPage.ariaQuickActions')}>
        <header className="em-section-head">
          <h2 className="em-section-title">
            <span className="em-section-title-icon"><RouteOutlinedIcon fontSize="inherit" /></span>
            {t('emergencyDashboardPage.quickActions')}
          </h2>
        </header>
        <div className="em-section-body">
          <div className="em-quick-row">
            <button className="em-quick-tile" onClick={() => navigate(`${basePath}/map`)}>
              <span className="em-quick-tile-icon"><MapOutlinedIcon fontSize="inherit" /></span>
              <span className="em-quick-tile-text">
                <strong>{t('emergencyDashboardPage.openEmergencyMap')}</strong>
                <span>{t('emergencyDashboardPage.liveIncidentGeography')}</span>
              </span>
            </button>
            <button className="em-quick-tile" onClick={() => navigate(`${basePath}/assigned`)}>
              <span className="em-quick-tile-icon"><ListAltOutlinedIcon fontSize="inherit" /></span>
              <span className="em-quick-tile-text">
                <strong>{t('emergencyDashboardPage.viewAssignedOperations')}</strong>
                <span>{t('emergencyDashboardPage.ongoingMissions', { count: 2 })}</span>
              </span>
            </button>
            <button className="em-quick-tile" onClick={() => navigate(`${basePath}/alerts`)}>
              <span className="em-quick-tile-icon"><WarningAmberRoundedIcon fontSize="inherit" /></span>
              <span className="em-quick-tile-text">
                <strong>{t('emergencyDashboardPage.viewAlerts')}</strong>
                <span>{t('emergencyDashboardPage.activeWarnings', { count: 3 })}</span>
              </span>
            </button>
          </div>
        </div>
      </section>
    </EmergencyShell>
  )
}

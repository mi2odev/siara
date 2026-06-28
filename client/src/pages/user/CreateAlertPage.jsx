import React, { useContext, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation, useNavigate } from 'react-router-dom'
import { Circle, MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet'
import FancySelect from '../../components/ui/FancySelect'
import TimeField from '../../components/ui/TimeField'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

const leafletIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
})

function RadiusMapClickHandler({ onPick }) {
  useMapEvents({
    click(event) {
      onPick({ lat: event.latlng.lat, lng: event.latlng.lng })
    },
  })
  return null
}

function RadiusMapView({ center, zoom }) {
  const map = useMap()
  useEffect(() => {
    map.setView([center.lat, center.lng], zoom)
  }, [map, center.lat, center.lng, zoom])
  return null
}
import CarCrashOutlinedIcon from '@mui/icons-material/CarCrashOutlined'
import TrafficOutlinedIcon from '@mui/icons-material/TrafficOutlined'
import LocalFireDepartmentOutlinedIcon from '@mui/icons-material/LocalFireDepartmentOutlined'
import WaterDropOutlinedIcon from '@mui/icons-material/WaterDropOutlined'
import ConstructionOutlinedIcon from '@mui/icons-material/ConstructionOutlined'
import HelpOutlineOutlinedIcon from '@mui/icons-material/HelpOutlineOutlined'
import BoltOutlinedIcon from '@mui/icons-material/BoltOutlined'
import CalendarMonthOutlinedIcon from '@mui/icons-material/CalendarMonthOutlined'
import NotificationsOffOutlinedIcon from '@mui/icons-material/NotificationsOffOutlined'
import NotificationsOutlinedIcon from '@mui/icons-material/NotificationsOutlined'
import NotificationBell from '../../components/notifications/NotificationBell'
import MailOutlineOutlinedIcon from '@mui/icons-material/MailOutlineOutlined'
import ChatBubbleOutlineOutlinedIcon from '@mui/icons-material/ChatBubbleOutlineOutlined'
import CheckRoundedIcon from '@mui/icons-material/CheckRounded'
import ShieldOutlinedIcon from '@mui/icons-material/ShieldOutlined'
import WarningAmberOutlinedIcon from '@mui/icons-material/WarningAmberOutlined'
import RepeatOutlinedIcon from '@mui/icons-material/RepeatOutlined'
import LocationCityOutlinedIcon from '@mui/icons-material/LocationCityOutlined'
import PushPinOutlinedIcon from '@mui/icons-material/PushPinOutlined'
import LocationOnOutlinedIcon from '@mui/icons-material/LocationOnOutlined'
import CloseRoundedIcon from '@mui/icons-material/CloseRounded'
import EditRoundedIcon from '@mui/icons-material/EditRounded'
import AssignmentOutlinedIcon from '@mui/icons-material/AssignmentOutlined'
import AccessTimeRoundedIcon from '@mui/icons-material/AccessTimeRounded'
import PhoneIphoneOutlinedIcon from '@mui/icons-material/PhoneIphoneOutlined'
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded'
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded'

import { AuthContext } from '../../contexts/AuthContext'
import PoliceModeTab from '../../components/layout/PoliceModeTab'
import LeftQuickInfoLinks from '../../components/layout/LeftQuickInfoLinks'
import GlobalHeaderSearch from '../../components/search/GlobalHeaderSearch'
import { createAlert, fetchCommunes, fetchWilayas, updateAlert } from '../../services/alertService'
import { getInitialsFromName, getUserAvatarUrl } from '../../utils/avatarUtils'
import '../../styles/CreateAlertPage.css'
import '../../styles/DashboardPage.css'
import siaraLogo from '../../assets/logos/siara-logo.png'

const ALGIERS = { lat: 36.753, lng: 3.0588 }

const DIGEST_INTERVALS = ['hourly', 'daily', 'weekly']

function renderHeaderIcon(type) {
  if (type === 'notification') {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M18 16V11C18 7.7 15.8 5 12.7 4.2V3.5C12.7 3 12.3 2.7 11.8 2.7C11.3 2.7 10.9 3 10.9 3.5V4.2C7.8 5 5.6 7.7 5.6 11V16L4.2 17.4C3.8 17.8 4.1 18.6 4.7 18.6H19C19.6 18.6 19.9 17.8 19.5 17.4L18 16Z"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinejoin="round"
        />
        <path
          d="M9.6 19.4C10 20.4 10.8 21 11.8 21C12.8 21 13.6 20.4 14 19.4"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
        />
      </svg>
    )
  }

  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M6 17.2L3.8 20.2C3.4 20.8 3.8 21.6 4.5 21.6H16.2"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M8 15.8C5.8 15.8 4 14 4 11.8V8.8C4 6.6 5.8 4.8 8 4.8H16C18.2 4.8 20 6.6 20 8.8V11.8C20 14 18.2 15.8 16 15.8H8Z"
        stroke="currentColor"
        strokeWidth="1.7"
      />
    </svg>
  )
}

function renderTypeIcon(type, alertTypes) {
  return alertTypes.find((item) => item.id === type)?.icon || <HelpOutlineOutlinedIcon fontSize="inherit" />
}

function getInitialState(editAlert) {
  const zoneType = editAlert?.zone?.zoneType || ''

  return {
    name: editAlert?.name || '',
    types: editAlert?.incidentTypes || [],
    zoneType,
    zoneRadius: editAlert?.zone?.radiusM ? Math.round(editAlert.zone.radiusM / 1000) : 5,
    zoneWilayaId: String(
      zoneType === 'wilaya'
        ? (editAlert?.zone?.adminAreaId || editAlert?.zone?.wilayaId || '')
        : (editAlert?.zone?.wilayaId || ''),
    ),
    zoneCommuneId: String(
      zoneType === 'commune'
        ? (editAlert?.zone?.adminAreaId || editAlert?.zone?.communeId || '')
        : '',
    ),
    radiusCenter: editAlert?.zone?.center || ALGIERS,
    severities: editAlert?.severityLevels?.length ? editAlert.severityLevels : ['high', 'medium'],
    timeRange: editAlert?.timeRangeType || 'all',
    timeStart: editAlert?.customTimeStart || '00:00',
    timeEnd: editAlert?.customTimeEnd || '23:59',
    weatherRelated: Boolean(editAlert?.weatherRelated),
    aiConfidence: editAlert?.aiConfidenceMin ?? 70,
    frequency: editAlert?.frequencyType || 'immediate',
    digestInterval: editAlert?.digestInterval || 'daily',
    muteDuplicates: editAlert?.muteDuplicates ?? true,
    deliveryApp: editAlert?.notifications?.app ?? true,
    deliveryEmail: editAlert?.notifications?.email ?? false,
    deliverySms: editAlert?.notifications?.sms ?? false,
  }
}

function zoneReady(data) {
  if (data.zoneType === 'radius') return Boolean(data.radiusCenter && data.zoneRadius > 0)
  if (data.zoneType === 'wilaya') return Boolean(data.zoneWilayaId)
  if (data.zoneType === 'commune') return Boolean(data.zoneWilayaId && data.zoneCommuneId)
  return false
}

function formatTimeRangeLabel(alertData, timeRangeOptions, t) {
  if (alertData.timeRange === 'custom') {
    if (alertData.timeStart && alertData.timeEnd) {
      return `${alertData.timeStart} - ${alertData.timeEnd}`
    }
    return t('createAlertPage.timeRange.custom')
  }

  const option = timeRangeOptions.find((item) => item.id === alertData.timeRange)
  return option?.label || t('createAlertPage.timeRange.allDay')
}

function formatSeverityLabelList(ids = [], severityOptions, t) {
  const labels = ids
    .map((id) => severityOptions.find((item) => item.id === id)?.label)
    .filter(Boolean)

  return labels.length > 0 ? labels.join(', ') : t('createAlertPage.severity.notSet')
}

function formatDeliveryLabelList(alertData, deliveryOptions, t) {
  const labels = deliveryOptions
    .filter((option) => alertData[option.key])
    .map((option) => option.label)

  return labels.length > 0 ? labels.join(', ') : t('createAlertPage.delivery.inApp')
}

export default function CreateAlertPage() {
  const { t } = useTranslation(['alerts', 'common'])
  const navigate = useNavigate()
  const location = useLocation()
  const { user, logout } = useContext(AuthContext)
  const editAlert = location.state?.editAlert || null
  const isEditMode = Boolean(editAlert)
  const initialState = useMemo(() => getInitialState(editAlert), [editAlert])

  const STEPS = [
    t('createAlertPage.steps.alertType'),
    t('createAlertPage.steps.zone'),
    t('createAlertPage.steps.conditions'),
    t('createAlertPage.steps.frequency'),
    t('createAlertPage.steps.confirmation'),
  ]

  const ALERT_TYPES = [
    { id: 'accident', icon: <CarCrashOutlinedIcon fontSize="inherit" className="icon-danger" />, label: t('createAlertPage.alertTypes.accident.label'), desc: t('createAlertPage.alertTypes.accident.desc') },
    { id: 'traffic', icon: <TrafficOutlinedIcon fontSize="inherit" className="icon-warning" />, label: t('createAlertPage.alertTypes.traffic.label'), desc: t('createAlertPage.alertTypes.traffic.desc') },
    { id: 'danger', icon: <LocalFireDepartmentOutlinedIcon fontSize="inherit" className="icon-fire" />, label: t('createAlertPage.alertTypes.danger.label'), desc: t('createAlertPage.alertTypes.danger.desc') },
    { id: 'weather', icon: <WaterDropOutlinedIcon fontSize="inherit" className="icon-info" />, label: t('createAlertPage.alertTypes.weather.label'), desc: t('createAlertPage.alertTypes.weather.desc') },
    { id: 'roadworks', icon: <ConstructionOutlinedIcon fontSize="inherit" className="icon-warning" />, label: t('createAlertPage.alertTypes.roadworks.label'), desc: t('createAlertPage.alertTypes.roadworks.desc') },
    { id: 'other', icon: <HelpOutlineOutlinedIcon fontSize="inherit" className="icon-muted" />, label: t('createAlertPage.alertTypes.other.label'), desc: t('createAlertPage.alertTypes.other.desc') },
  ]

  const SEVERITY_OPTIONS = [
    {
      id: 'high',
      label: t('createAlertPage.severityOptions.high.label'),
      desc: t('createAlertPage.severityOptions.high.desc'),
      color: '#DC2626',
    },
    {
      id: 'medium',
      label: t('createAlertPage.severityOptions.medium.label'),
      desc: t('createAlertPage.severityOptions.medium.desc'),
      color: '#F59E0B',
    },
    {
      id: 'low',
      label: t('createAlertPage.severityOptions.low.label'),
      desc: t('createAlertPage.severityOptions.low.desc'),
      color: '#10B981',
    },
  ]

  const TIME_RANGE_OPTIONS = [
    { id: 'all', label: t('createAlertPage.timeRange.allDay') },
    { id: 'day', label: t('createAlertPage.timeRange.daytime') },
    { id: 'night', label: t('createAlertPage.timeRange.night') },
    { id: 'custom', label: t('createAlertPage.timeRange.custom') },
  ]

  const FREQUENCY_OPTIONS = [
    {
      id: 'immediate',
      icon: <BoltOutlinedIcon fontSize="inherit" />,
      label: t('createAlertPage.frequency.immediate.label'),
      desc: t('createAlertPage.frequency.immediate.desc'),
    },
    {
      id: 'digest',
      icon: <CalendarMonthOutlinedIcon fontSize="inherit" />,
      label: t('createAlertPage.frequency.digest.label'),
      desc: t('createAlertPage.frequency.digest.desc'),
    },
    {
      id: 'first',
      icon: <NotificationsOffOutlinedIcon fontSize="inherit" />,
      label: t('createAlertPage.frequency.firstOnly.label'),
      desc: t('createAlertPage.frequency.firstOnly.desc'),
    },
  ]

  const DELIVERY_OPTIONS = [
    {
      key: 'deliveryApp',
      icon: <NotificationsOutlinedIcon fontSize="inherit" />,
      label: t('createAlertPage.delivery.inApp'),
      desc: t('createAlertPage.delivery.inAppDesc'),
    },
    {
      key: 'deliveryEmail',
      icon: <MailOutlineOutlinedIcon fontSize="inherit" />,
      label: t('createAlertPage.delivery.email'),
      desc: t('createAlertPage.delivery.emailDesc'),
    },
    {
      key: 'deliverySms',
      icon: <ChatBubbleOutlineOutlinedIcon fontSize="inherit" />,
      label: t('createAlertPage.delivery.sms'),
      desc: t('createAlertPage.delivery.smsDesc'),
    },
  ]

  const [showDropdown, setShowDropdown] = useState(false)
  const [headerSearchQuery, setHeaderSearchQuery] = useState('')
  const [currentStep, setCurrentStep] = useState(1)
  const [errorMessage, setErrorMessage] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [shakeNav, setShakeNav] = useState(false)
  const [loadingWilayas, setLoadingWilayas] = useState(true)
  const [loadingCommunes, setLoadingCommunes] = useState(false)
  const [radiusLocationAttempted, setRadiusLocationAttempted] = useState(Boolean(isEditMode))
  const [wilayas, setWilayas] = useState([])
  const [communes, setCommunes] = useState([])
  const [nameDirty, setNameDirty] = useState(isEditMode)
  const [alertData, setAlertData] = useState(initialState)

  const selectedWilaya = wilayas.find((item) => String(item.id) === String(alertData.zoneWilayaId)) || null
  const selectedCommune = communes.find((item) => String(item.id) === String(alertData.zoneCommuneId)) || null

  const zoneLabel =
    alertData.zoneType === 'radius'
      ? t('createAlertPage.zone.radiusLabel', { radius: alertData.zoneRadius })
      : alertData.zoneType === 'wilaya'
        ? selectedWilaya?.name || t('createAlertPage.zone.selectedWilaya')
        : alertData.zoneType === 'commune'
          ? [selectedCommune?.name, selectedWilaya?.name].filter(Boolean).join(', ') || t('createAlertPage.zone.selectedCommune')
          : t('createAlertPage.zone.zone')

  const userAvatarUrl = getUserAvatarUrl(user)
  const profileInitials = getInitialsFromName(user?.name || user?.email || 'User')

  useEffect(() => {
    let ignore = false

    ;(async () => {
      try {
        const items = await fetchWilayas()
        if (!ignore) setWilayas(items)
      } catch (error) {
        if (!ignore) setErrorMessage(error.response?.data?.message || t('createAlertPage.errors.loadWilayas'))
      } finally {
        if (!ignore) setLoadingWilayas(false)
      }
    })()

    return () => {
      ignore = true
    }
  }, [])

  useEffect(() => {
    if (alertData.zoneType !== 'commune' || !alertData.zoneWilayaId) {
      setCommunes([])
      return
    }

    let ignore = false
    setLoadingCommunes(true)

    ;(async () => {
      try {
        const items = await fetchCommunes(alertData.zoneWilayaId)
        if (!ignore) setCommunes(items)
      } catch (error) {
        if (!ignore) setErrorMessage(error.response?.data?.message || t('createAlertPage.errors.loadCommunes'))
      } finally {
        if (!ignore) setLoadingCommunes(false)
      }
    })()

    return () => {
      ignore = true
    }
  }, [alertData.zoneType, alertData.zoneWilayaId])

  useEffect(() => {
    if (nameDirty || alertData.types.length === 0 || !zoneReady(alertData)) return

    const typeLabel = alertData.types
      .map((type) => ALERT_TYPES.find((item) => item.id === type)?.label || type)
      .join(' + ')

    setAlertData((prev) => ({ ...prev, name: `${typeLabel} - ${zoneLabel}` }))
  }, [
    alertData.types,
    alertData.zoneType,
    alertData.zoneRadius,
    alertData.zoneWilayaId,
    alertData.zoneCommuneId,
    zoneLabel,
    nameDirty,
  ])

  useEffect(() => {
    if (isEditMode || alertData.zoneType !== 'radius' || radiusLocationAttempted) {
      return
    }

    if (!navigator?.geolocation) {
      setRadiusLocationAttempted(true)
      return
    }

    let cancelled = false

    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (cancelled) return

        const lat = Number(position?.coords?.latitude)
        const lng = Number(position?.coords?.longitude)

        if (Number.isFinite(lat) && Number.isFinite(lng)) {
          setAlertData((prev) => {
            const currentLat = Number(prev?.radiusCenter?.lat)
            const currentLng = Number(prev?.radiusCenter?.lng)
            const stillDefaultCenter =
              Math.abs(currentLat - ALGIERS.lat) < 0.0001 &&
              Math.abs(currentLng - ALGIERS.lng) < 0.0001

            if (!stillDefaultCenter) {
              return prev
            }

            return {
              ...prev,
              radiusCenter: { lat, lng },
            }
          })
        }

        setRadiusLocationAttempted(true)
      },
      () => {
        if (!cancelled) {
          setRadiusLocationAttempted(true)
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 12000,
        maximumAge: 60000,
      },
    )

    return () => {
      cancelled = true
    }
  }, [alertData.zoneType, isEditMode, radiusLocationAttempted])

  function isStepValid(step) {
    if (step === 1) return alertData.types.length > 0
    if (step === 2) return zoneReady(alertData)
    if (step === 3) {
      return (
        alertData.severities.length > 0 &&
        (alertData.timeRange !== 'custom' || (alertData.timeStart && alertData.timeEnd))
      )
    }
    if (step === 4) return alertData.frequency !== 'digest' || Boolean(alertData.digestInterval)
    if (step === 5) return alertData.name.trim().length > 0
    return false
  }

  function bounce() {
    setShakeNav(true)
    setTimeout(() => setShakeNav(false), 600)
  }

  function goToStep(step) {
    if (step <= currentStep) {
      setCurrentStep(step)
      return
    }

    for (let i = currentStep; i < step; i += 1) {
      if (!isStepValid(i)) {
        bounce()
        return
      }
    }

    setCurrentStep(step)
  }

  function toggleInList(key, value) {
    setAlertData((prev) => ({
      ...prev,
      [key]: prev[key].includes(value)
        ? prev[key].filter((item) => item !== value)
        : [...prev[key], value],
    }))
  }

  async function saveAlert() {
    if (!isStepValid(5)) {
      bounce()
      return
    }

    setIsSaving(true)
    setErrorMessage('')

    const payload = {
      name: alertData.name.trim(),
      incidentTypes: alertData.types,
      severityLevels: alertData.severities,
      timeRangeType: alertData.timeRange,
      customTimeStart: alertData.timeRange === 'custom' ? alertData.timeStart : null,
      customTimeEnd: alertData.timeRange === 'custom' ? alertData.timeEnd : null,
      weatherRelated: alertData.weatherRelated,
      aiConfidenceMin: alertData.types.includes('ai_prediction') ? alertData.aiConfidence : null,
      frequencyType: alertData.frequency,
      digestInterval: alertData.frequency === 'digest' ? alertData.digestInterval : null,
      muteDuplicates: alertData.muteDuplicates,
      deliveryApp: alertData.deliveryApp || (!alertData.deliveryEmail && !alertData.deliverySms),
      deliveryEmail: alertData.deliveryEmail,
      deliverySms: alertData.deliverySms,
      zone:
        alertData.zoneType === 'radius'
          ? {
              zoneType: 'radius',
              displayName: zoneLabel,
              radiusM: alertData.zoneRadius * 1000,
              center: alertData.radiusCenter,
            }
          : alertData.zoneType === 'wilaya'
            ? {
                zoneType: 'wilaya',
                adminAreaId: Number(alertData.zoneWilayaId),
                wilayaId: Number(alertData.zoneWilayaId),
                displayName: selectedWilaya?.name || 'Wilaya',
              }
            : {
                zoneType: 'commune',
                adminAreaId: Number(alertData.zoneCommuneId),
                wilayaId: Number(alertData.zoneWilayaId),
                displayName: selectedCommune?.name || 'Commune',
              },
    }

    try {
      const saved = isEditMode
        ? await updateAlert(editAlert.id, payload)
        : await createAlert(payload)

      navigate('/alerts', {
        state: isEditMode
          ? { editedAlert: saved?.name || alertData.name }
          : { newAlert: saved?.name || alertData.name },
      })
    } catch (error) {
      setErrorMessage(error.response?.data?.message || t('createAlertPage.errors.saveFailed'))
      setIsSaving(false)
    }
  }

  return (
    <div className="create-alert-page">
      <header className="siara-dashboard-header">
        <div className="dash-header-inner">
          <div className="dash-header-left">
            <div className="dash-logo-block">
              <img src={siaraLogo} alt="SIARA" className="header-logo" />
            </div>

            <nav className="dash-header-tabs">
              <button className="dash-tab" onClick={() => navigate('/news')}>{t('createAlertPage.nav.feed')}</button>
              <button className="dash-tab" onClick={() => navigate('/map')}>{t('common:nav.map')}</button>
              <button className="dash-tab dash-tab-active" onClick={() => navigate('/alerts')}>{t('common:nav.alerts')}</button>
              <button className="dash-tab" onClick={() => navigate('/report')}>{t('createAlertPage.nav.report')}</button>
              <button className="dash-tab" onClick={() => navigate('/dashboard')}>{t('createAlertPage.nav.dashboard')}</button>
              <button className="dash-tab" onClick={() => navigate('/predictions')}>{t('common:nav.predictions')}</button>
              <PoliceModeTab user={user} />
            </nav>
          </div>

          <div className="dash-header-center">
            <GlobalHeaderSearch
              navigate={navigate}
              query={headerSearchQuery}
              setQuery={setHeaderSearchQuery}
              placeholder={t('createAlertPage.searchPlaceholder')}
              ariaLabel={t('common:actions.search')}
              currentUser={user}
            />
          </div>

          <div className="dash-header-right">
            <NotificationBell />

            <button className="dash-icon-btn" aria-label={t('common:nav.notifications')}>
              {renderHeaderIcon('message')}
            </button>

            <div className="dash-avatar-wrapper">
              <button
                className={`dash-avatar ${userAvatarUrl ? 'has-image' : ''}`}
                onClick={() => setShowDropdown(!showDropdown)}
                aria-label={t('createAlertPage.userProfileAriaLabel')}
              >
                {userAvatarUrl ? (
                  <img
                    src={userAvatarUrl}
                    alt={t('createAlertPage.userAvatarAlt')}
                    className="dash-avatar-image"
                    loading="lazy"
                  />
                ) : (
                  profileInitials
                )}
              </button>

              {showDropdown && (
                <div className="user-dropdown">
                  <button
                    className="dropdown-item"
                    onClick={() => {
                      setShowDropdown(false)
                      navigate('/profile')
                    }}
                  >
                    {t('createAlertPage.dropdown.myProfile')}
                  </button>
                  <button
                    className="dropdown-item"
                    onClick={() => {
                      setShowDropdown(false)
                      navigate('/settings')
                    }}
                  >
                    {t('common:nav.settings')}
                  </button>
                  <button
                    className="dropdown-item"
                    onClick={() => {
                      setShowDropdown(false)
                      navigate('/notifications')
                    }}
                  >
                    {t('common:nav.notifications')}
                  </button>
                  <div className="dropdown-divider"></div>
                  <button
                    className="dropdown-item logout"
                    onClick={() => {
                      logout()
                      navigate('/home')
                    }}
                  >
                    {t('common:nav.logout')}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="create-grid">
        <aside className="create-left">
          <div className="stepper-header">
            <span className="stepper-icon"><NotificationsOutlinedIcon fontSize="inherit" /></span>
            <h2>{isEditMode ? t('createAlertPage.editAlert') : t('createAlertPage.createAlert')}</h2>
          </div>

          <div className="stepper">
            {STEPS.map((label, index) => (
              <div
                key={label}
                className={`step ${currentStep === index + 1 ? 'active' : ''} ${currentStep > index + 1 ? 'completed' : ''} ${currentStep < index + 1 ? 'disabled' : ''}`}
                onClick={() => goToStep(index + 1)}
                style={{ cursor: currentStep > index + 1 ? 'pointer' : 'default' }}
              >
                <div className="step-indicator">{currentStep > index + 1 ? <CheckRoundedIcon fontSize="inherit" /> : index + 1}</div>
                <div className="step-content">
                  <span className="step-label">{label}</span>
                </div>
                {index < STEPS.length - 1 && <div className="step-line"></div>}
              </div>
            ))}
          </div>

          <div className="trust-notice">
            <span className="trust-icon"><ShieldOutlinedIcon fontSize="inherit" className="icon-security" /></span>
            <div className="trust-text">
              <strong>{t('createAlertPage.trustNotice.title')}</strong>
              <p>{t('createAlertPage.trustNotice.desc')}</p>
            </div>
          </div>

          <LeftQuickInfoLinks />

          <button className="cancel-btn" onClick={() => navigate('/alerts')}>
            <CloseRoundedIcon fontSize="inherit" className="icon-danger" /> {t('common:actions.cancel')}
          </button>
        </aside>

        <main className="create-center">
          {errorMessage && (
            <div className="step-hint" style={{ color: '#b91c1c', marginBottom: 12 }}>
              {errorMessage}
            </div>
          )}

          {currentStep === 1 && (
            <div className="step-panel create-alert-type-step">
              <div className="step-header">
                <h1>{t('createAlertPage.step1.title')}</h1>
                <p>{t('createAlertPage.step1.subtitle')}</p>
              </div>

              <div className="type-grid">
                {ALERT_TYPES.map((type) => (
                  <div
                    key={type.id}
                    className={`type-card ${alertData.types.includes(type.id) ? 'selected' : ''}`}
                    onClick={() => toggleInList('types', type.id)}
                  >
                    <div className="type-check">{alertData.types.includes(type.id) ? <CheckRoundedIcon fontSize="inherit" /> : ''}</div>
                    <span className="type-icon">{renderTypeIcon(type.id, ALERT_TYPES)}</span>
                    <span className="type-label">{type.label}</span>
                    <span className="type-desc">{type.desc}</span>
                  </div>
                ))}
              </div>

              {alertData.types.length === 0 && (
                <p className="step-hint" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><WarningAmberOutlinedIcon fontSize="inherit" className="icon-warning" /> {t('createAlertPage.step1.hint')}</p>
              )}
            </div>
          )}

          {currentStep === 2 && (
            <div className="step-panel">
              <div className="step-header">
                <h1>{t('createAlertPage.step2.title')}</h1>
                <p>{t('createAlertPage.step2.subtitle')}</p>
              </div>

              <div className="zone-options">
                <div
                  className={`zone-card ${alertData.zoneType === 'wilaya' ? 'selected' : ''}`}
                  onClick={() => setAlertData((prev) => ({ ...prev, zoneType: 'wilaya', zoneCommuneId: '' }))}
                >
                  <span className="zone-icon"><LocationCityOutlinedIcon fontSize="inherit" /></span>
                  <div className="zone-info">
                    <span className="zone-label">{t('createAlertPage.zone.wilaya')}</span>
                  </div>
                </div>

                <div
                  className={`zone-card ${alertData.zoneType === 'commune' ? 'selected' : ''}`}
                  onClick={() => setAlertData((prev) => ({ ...prev, zoneType: 'commune' }))}
                >
                  <span className="zone-icon"><PushPinOutlinedIcon fontSize="inherit" /></span>
                  <div className="zone-info">
                    <span className="zone-label">{t('createAlertPage.zone.commune')}</span>
                  </div>
                </div>

                <div
                  className={`zone-card ${alertData.zoneType === 'radius' ? 'selected' : ''}`}
                  onClick={() => setAlertData((prev) => ({ ...prev, zoneType: 'radius' }))}
                >
                  <span className="zone-icon"><LocationOnOutlinedIcon fontSize="inherit" /></span>
                  <div className="zone-info">
                    <span className="zone-label">{t('createAlertPage.zone.radius')}</span>
                  </div>
                </div>

                {alertData.zoneType === 'wilaya' && (
                  <div className="zone-config">
                    <label>{t('createAlertPage.zone.selectWilaya')}</label>
                    <FancySelect
                      value={alertData.zoneWilayaId}
                      onChange={(value) => setAlertData((prev) => ({ ...prev, zoneWilayaId: value }))}
                      menuAlign="left"
                      options={[
                        { value: '', label: loadingWilayas ? t('createAlertPage.zone.loadingWilayas') : t('createAlertPage.zone.chooseWilaya') },
                        ...wilayas.map((w) => ({ value: w.id, label: w.name })),
                      ]}
                    />
                  </div>
                )}

                {alertData.zoneType === 'commune' && (
                  <div className="zone-config">
                    <label>{t('createAlertPage.zone.wilaya')}</label>
                    <FancySelect
                      value={alertData.zoneWilayaId}
                      onChange={(value) =>
                        setAlertData((prev) => ({
                          ...prev,
                          zoneWilayaId: value,
                          zoneCommuneId: '',
                        }))
                      }
                      menuAlign="left"
                      options={[
                        { value: '', label: loadingWilayas ? t('createAlertPage.zone.loadingWilayas') : t('createAlertPage.zone.chooseWilaya') },
                        ...wilayas.map((w) => ({ value: w.id, label: w.name })),
                      ]}
                    />

                    <label style={{ marginTop: 12 }}>{t('createAlertPage.zone.commune')}</label>
                    <FancySelect
                      value={alertData.zoneCommuneId}
                      onChange={(value) => setAlertData((prev) => ({ ...prev, zoneCommuneId: value }))}
                      disabled={!alertData.zoneWilayaId || loadingCommunes}
                      menuAlign="left"
                      options={[
                        {
                          value: '',
                          label: !alertData.zoneWilayaId
                            ? t('createAlertPage.zone.chooseWilayaFirst')
                            : loadingCommunes
                              ? t('createAlertPage.zone.loadingCommunes')
                              : t('createAlertPage.zone.chooseCommune'),
                        },
                        ...communes.map((c) => ({ value: c.id, label: c.name })),
                      ]}
                    />
                  </div>
                )}

                {alertData.zoneType === 'radius' && (
                  <div className="zone-config">
                    <label>{t('createAlertPage.zone.radius')}</label>
                    <div className="radius-slider">
                      <input
                        type="range"
                        min="1"
                        max="100"
                        value={alertData.zoneRadius}
                        onChange={(event) =>
                          setAlertData((prev) => ({ ...prev, zoneRadius: Number(event.target.value) }))
                        }
                      />
                      <span className="radius-value">{t('createAlertPage.zone.radiusValue', { radius: alertData.zoneRadius })}</span>
                    </div>

                    <div className="map-preview" style={{ height: 260 }}>
                      <MapContainer
                        style={{ width: '100%', height: '100%' }}
                        center={[alertData.radiusCenter.lat, alertData.radiusCenter.lng]}
                        zoom={Math.max(7, 12 - Math.floor(alertData.zoneRadius / 6))}
                        scrollWheelZoom
                      >
                        <TileLayer
                          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                        />
                        <RadiusMapView
                          center={alertData.radiusCenter}
                          zoom={Math.max(7, 12 - Math.floor(alertData.zoneRadius / 6))}
                        />
                        <RadiusMapClickHandler
                          onPick={(latlng) =>
                            setAlertData((prev) => ({ ...prev, radiusCenter: latlng }))
                          }
                        />
                        <Marker
                          position={[alertData.radiusCenter.lat, alertData.radiusCenter.lng]}
                          icon={leafletIcon}
                        />
                        <Circle
                          center={[alertData.radiusCenter.lat, alertData.radiusCenter.lng]}
                          radius={alertData.zoneRadius * 1000}
                          pathOptions={{
                            fillColor: '#0f766e',
                            fillOpacity: 0.16,
                            color: '#0f766e',
                            weight: 2,
                          }}
                        />
                      </MapContainer>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {currentStep === 3 && (
            <div className="step-panel">
              <div className="step-header">
                <h1>{t('createAlertPage.step3.title')}</h1>
                <p>{t('createAlertPage.step3.subtitle')}</p>
              </div>

              <div className="severity-grid">
                {SEVERITY_OPTIONS.map((severity) => (
                  <div
                    key={severity.id}
                    className={`severity-card ${alertData.severities.includes(severity.id) ? 'selected' : ''}`}
                    onClick={() => toggleInList('severities', severity.id)}
                  >
                    <span className="sev-dot" style={{ background: severity.color }}></span>
                    <div className="sev-info">
                      <span className="sev-label">{severity.label}</span>
                      <span className="sev-desc">{severity.desc}</span>
                    </div>
                    <div className="sev-check">{alertData.severities.includes(severity.id) ? <CheckRoundedIcon fontSize="inherit" /> : ''}</div>
                  </div>
                ))}
              </div>

              {alertData.severities.length === 0 && (
                <p className="step-hint" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><WarningAmberOutlinedIcon fontSize="inherit" /> {t('createAlertPage.step3.severityHint')}</p>
              )}

              <div className="digest-config" style={{ marginTop: 20 }}>
                <label>{t('createAlertPage.step3.timeRangeLabel')}</label>
                <div className="digest-options">
                  {TIME_RANGE_OPTIONS.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      className={`digest-btn ${alertData.timeRange === option.id ? 'selected' : ''}`}
                      onClick={() => setAlertData((prev) => ({ ...prev, timeRange: option.id }))}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              {alertData.timeRange === 'custom' && (
                <div className="custom-time">
                  <div className="time-input">
                    <label>{t('createAlertPage.step3.timeFrom')}</label>
                    <TimeField
                      value={alertData.timeStart}
                      onChange={(next) => setAlertData((prev) => ({ ...prev, timeStart: next }))}
                    />
                  </div>
                  <div className="time-input">
                    <label>{t('createAlertPage.step3.timeTo')}</label>
                    <TimeField
                      value={alertData.timeEnd}
                      onChange={(next) => setAlertData((prev) => ({ ...prev, timeEnd: next }))}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {currentStep === 4 && (
            <div className="step-panel">
              <div className="step-header">
                <h1>{t('createAlertPage.step4.title')}</h1>
                <p>{t('createAlertPage.step4.subtitle')}</p>
              </div>

              <div className="frequency-card-grid">
                {FREQUENCY_OPTIONS.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    className={`frequency-card ${alertData.frequency === option.id ? 'selected' : ''}`}
                    onClick={() => setAlertData((prev) => ({ ...prev, frequency: option.id }))}
                  >
                    <span className="frequency-card-icon">{option.icon}</span>
                    <span className="frequency-card-content">
                      <span className="frequency-card-title">{option.label}</span>
                      <span className="frequency-card-desc">{option.desc}</span>
                    </span>
                    <span className="frequency-card-check">
                      {alertData.frequency === option.id ? <CheckRoundedIcon fontSize="inherit" /> : ''}
                    </span>
                  </button>
                ))}
              </div>

              {alertData.frequency === 'immediate' && (
                <div className="frequency-note">
                  <strong>{t('createAlertPage.step4.highVolumeTitle')}</strong> {t('createAlertPage.step4.highVolumeDesc')}
                </div>
              )}

              {alertData.frequency === 'digest' && (
                <div className="digest-config">
                  <label>{t('createAlertPage.step4.digestInterval')}</label>

                  <div className="frequency-autodelivery-note">
                    <span className="frequency-autodelivery-icon"><NotificationsOutlinedIcon fontSize="inherit" /></span>
                    <p>{t('createAlertPage.step4.autoDeliveryNote')}</p>
                  </div>

                  <div className="digest-options digest-options-tight">
                    {DIGEST_INTERVALS.map((value) => (
                      <button
                        key={value}
                        type="button"
                        className={`digest-btn ${alertData.digestInterval === value ? 'selected' : ''}`}
                        onClick={() => setAlertData((prev) => ({ ...prev, digestInterval: value }))}
                      >
                        {t(`createAlertPage.digestIntervals.${value}`)}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <p className="delivery-section-label">{t('createAlertPage.step4.notifyVia')}</p>
              <div className="delivery-grid">
                {DELIVERY_OPTIONS.map(({ key, icon, label, desc }) => (
                  <label
                    key={key}
                    className={`delivery-card ${alertData[key] ? 'selected' : ''}`}
                  >
                    <input
                      type="checkbox"
                      checked={Boolean(alertData[key])}
                      onChange={() =>
                        setAlertData((prev) => ({
                          ...prev,
                          [key]: !prev[key],
                        }))
                      }
                    />
                    <span className="delivery-card-icon" aria-hidden="true">{icon}</span>
                    <div className="delivery-info">
                      <span className="delivery-label">{label}</span>
                      <span className="delivery-desc">{desc}</span>
                    </div>
                    <span className="delivery-check" aria-hidden="true">{alertData[key] ? <CheckRoundedIcon fontSize="inherit" /> : ''}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {currentStep === 5 && (
            <div className="step-panel">
              <div className="step-header">
                <h1>{t('createAlertPage.step5.title')}</h1>
                <p>{t('createAlertPage.step5.subtitle')}</p>
              </div>

              {/* Editable alert name */}
              <div className="conf-name-card">
                <span className="conf-name-icon" aria-hidden="true">
                  {ALERT_TYPES.find((type) => type.id === alertData.types[0])?.icon || <NotificationsOutlinedIcon fontSize="inherit" />}
                </span>
                <input
                  className="conf-name-input"
                  value={alertData.name}
                  onChange={(event) => {
                    setNameDirty(true)
                    setAlertData((prev) => ({ ...prev, name: event.target.value }))
                  }}
                  placeholder={t('createAlertPage.step5.alertNamePlaceholder')}
                />
                <span className="conf-name-edit-hint" aria-hidden="true"><EditRoundedIcon fontSize="inherit" /></span>
              </div>

              {/* Summary rows */}
              <div className="conf-summary">
                <div className="conf-row">
                  <span className="conf-row-icon" aria-hidden="true"><AssignmentOutlinedIcon fontSize="inherit" /></span>
                  <span className="conf-row-label">{t('createAlertPage.step5.summaryTypes')}</span>
                  <span className="conf-row-value">
                    {alertData.types
                      .map((type) => ALERT_TYPES.find((item) => item.id === type)?.label || type)
                      .join(', ')}
                  </span>
                </div>

                <div className="conf-row">
                  <span className="conf-row-icon" aria-hidden="true"><LocationOnOutlinedIcon fontSize="inherit" /></span>
                  <span className="conf-row-label">{t('createAlertPage.step5.summaryZone')}</span>
                  <span className="conf-row-value">{zoneLabel}</span>
                </div>

                <div className="conf-row">
                  <span className="conf-row-icon" aria-hidden="true"><WarningAmberOutlinedIcon fontSize="inherit" /></span>
                  <span className="conf-row-label">{t('createAlertPage.step5.summarySeverity')}</span>
                  <span className="conf-row-value conf-row-badges">
                    {alertData.severities.map((sev) => (
                      <span key={sev} className={`conf-sev-badge conf-sev-badge--${sev}`}>
                        {SEVERITY_OPTIONS.find((s) => s.id === sev)?.label || sev}
                      </span>
                    ))}
                  </span>
                </div>

                <div className="conf-row">
                  <span className="conf-row-icon" aria-hidden="true"><RepeatOutlinedIcon fontSize="inherit" /></span>
                  <span className="conf-row-label">{t('createAlertPage.step5.summaryFrequency')}</span>
                  <span className="conf-row-value">
                    {FREQUENCY_OPTIONS.find((f) => f.id === alertData.frequency)?.label || alertData.frequency}
                  </span>
                </div>

                <div className="conf-row">
                  <span className="conf-row-icon" aria-hidden="true"><AccessTimeRoundedIcon fontSize="inherit" /></span>
                  <span className="conf-row-label">{t('createAlertPage.step5.summaryTimeRange')}</span>
                  <span className="conf-row-value">{formatTimeRangeLabel(alertData, TIME_RANGE_OPTIONS, t)}</span>
                </div>

                <div className="conf-row">
                  <span className="conf-row-icon" aria-hidden="true"><PhoneIphoneOutlinedIcon fontSize="inherit" /></span>
                  <span className="conf-row-label">{t('createAlertPage.step5.summaryDelivery')}</span>
                  <span className="conf-row-value">{formatDeliveryLabelList(alertData, DELIVERY_OPTIONS, t)}</span>
                </div>
              </div>

              {/* Ready banner */}
              <div className="conf-ready-banner">
                <span className="conf-ready-icon" aria-hidden="true"><CheckRoundedIcon fontSize="inherit" className="icon-success" /></span>
                <p>{t('createAlertPage.step5.readyBanner', { action: isEditMode ? t('createAlertPage.saveChanges') : t('createAlertPage.createAlertBtn') })}</p>
              </div>
            </div>
          )}

          <div className="step-nav">
            {currentStep > 1 && (
              <button className="nav-btn back" onClick={() => setCurrentStep((prev) => prev - 1)}>
                <ArrowBackRoundedIcon fontSize="inherit" /> {t('common:actions.back')}
              </button>
            )}

            <div className="nav-spacer"></div>

            {currentStep < 5 ? (
              <button
                className={`nav-btn next ${shakeNav ? 'shake' : ''}`}
                onClick={() => (isStepValid(currentStep) ? setCurrentStep((prev) => prev + 1) : bounce())}
              >
                {t('createAlertPage.continue')} <ArrowForwardRoundedIcon fontSize="inherit" />
              </button>
            ) : (
              <button
                className={`nav-btn create ${shakeNav ? 'shake' : ''}`}
                onClick={saveAlert}
                disabled={isSaving}
              >
                {isSaving ? t('createAlertPage.saving') : isEditMode ? t('createAlertPage.saveChanges') : t('createAlertPage.createAlertBtn')}
              </button>
            )}
          </div>
        </main>

        <aside className="create-right">
          <div className="preview-header">
            <h3>{t('createAlertPage.preview.title')}</h3>
          </div>

          <div className="preview-section">
            <span className="preview-label">{t('createAlertPage.preview.alertLabel')}</span>
            <div className="alert-preview-card">
              <div className="apc-header">
                <span className="apc-icons">
                  {alertData.types.length > 0 ? (
                    alertData.types.slice(0, 2).map((type) => (
                      <span key={type} className="apc-icon-chip">
                        {renderTypeIcon(type, ALERT_TYPES)}
                      </span>
                    ))
                  ) : (
                    <span className="apc-icon-chip">{renderHeaderIcon('notification')}</span>
                  )}
                </span>
                <span className="apc-name">{alertData.name || t('createAlertPage.preview.newAlert')}</span>
              </div>

              <div className="apc-body">
                <div className="apc-row">
                  <span className="apc-label">{t('createAlertPage.step5.summaryZone')}</span>
                  <span className="apc-value">{zoneLabel}</span>
                </div>
                <div className="apc-row">
                  <span className="apc-label">{t('createAlertPage.step5.summarySeverity')}</span>
                  <span className="apc-value">{formatSeverityLabelList(alertData.severities, SEVERITY_OPTIONS, t)}</span>
                </div>
                <div className="apc-row">
                  <span className="apc-label">{t('createAlertPage.preview.schedule')}</span>
                  <span className="apc-value">{formatTimeRangeLabel(alertData, TIME_RANGE_OPTIONS, t)}</span>
                </div>
                <div className="apc-row">
                  <span className="apc-label">{t('createAlertPage.preview.estimatedVolume')}</span>
                  <span className="apc-value">
                    {t('createAlertPage.preview.signalsPerWeek', { count: alertData.types.length + alertData.severities.length })}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="preview-section why-section">
            <span className="preview-label">{t('createAlertPage.preview.whyLabel')}</span>
            <p className="why-text">
              {alertData.types.length > 0 && zoneReady(alertData)
                ? t('createAlertPage.preview.whyText', {
                    types: alertData.types
                      .map((type) => ALERT_TYPES.find((item) => item.id === type)?.label.toLowerCase())
                      .join(` ${t('createAlertPage.preview.whyOr')} `),
                    zone: zoneLabel,
                  })
                : t('createAlertPage.preview.whyTextIncomplete')}
            </p>
          </div>
        </aside>
      </div>
    </div>
  )
}

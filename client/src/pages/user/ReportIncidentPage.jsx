/**
 * @file ReportIncidentPage.jsx
 * @description 5-step wizard for reporting road incidents, plus a post-submission success screen.
 *
 * Wizard steps: Type → Location → Details → Media → Verification
 *
 * Layout: 3-column grid
 *   - Left:   vertical stepper + trust notice + cancel button
 *   - Center: step-specific form panels
 *   - Right:  live preview sidebar (incident card preview, mini-map, verification status)
 *
 * Features:
 *   - 3 location input methods: GPS auto-detect, address search, map click
 *   - Media upload with image preview (max 5 files, 5 MB each)
 *   - Severity level selector (high / medium / low)
 *   - Simulated API submit with random tracking ID
 *   - Success screen with next-steps explainer and quick-action buttons
 */
import React, { useState, useContext, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import GpsFixedOutlinedIcon from '@mui/icons-material/GpsFixedOutlined'
import LocationOnOutlinedIcon from '@mui/icons-material/LocationOnOutlined'
import EditNoteOutlinedIcon from '@mui/icons-material/EditNoteOutlined'
import PhotoCameraOutlinedIcon from '@mui/icons-material/PhotoCameraOutlined'
import CheckCircleOutlineRoundedIcon from '@mui/icons-material/CheckCircleOutlineRounded'
import CarCrashOutlinedIcon from '@mui/icons-material/CarCrashOutlined'
import TrafficOutlinedIcon from '@mui/icons-material/TrafficOutlined'
import LocalFireDepartmentOutlinedIcon from '@mui/icons-material/LocalFireDepartmentOutlined'
import WaterDropOutlinedIcon from '@mui/icons-material/WaterDropOutlined'
import ConstructionOutlinedIcon from '@mui/icons-material/ConstructionOutlined'
import HelpOutlineOutlinedIcon from '@mui/icons-material/HelpOutlineOutlined'
import NotificationBell from '../../components/notifications/NotificationBell'
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded'
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded'
import CampaignOutlinedIcon from '@mui/icons-material/CampaignOutlined'
import CheckRoundedIcon from '@mui/icons-material/CheckRounded'
import ShieldOutlinedIcon from '@mui/icons-material/ShieldOutlined'
import CloseRoundedIcon from '@mui/icons-material/CloseRounded'
import WarningAmberOutlinedIcon from '@mui/icons-material/WarningAmberOutlined'
import SearchOutlinedIcon from '@mui/icons-material/SearchOutlined'
import EditRoundedIcon from '@mui/icons-material/EditRounded'
import TipsAndUpdatesOutlinedIcon from '@mui/icons-material/TipsAndUpdatesOutlined'
import TimerOutlinedIcon from '@mui/icons-material/TimerOutlined'
import AccessTimeRoundedIcon from '@mui/icons-material/AccessTimeRounded'
import CalendarMonthRoundedIcon from '@mui/icons-material/CalendarMonthRounded'
import LockOutlinedIcon from '@mui/icons-material/LockOutlined'
import EnhancedEncryptionOutlinedIcon from '@mui/icons-material/EnhancedEncryptionOutlined'
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined'
import HourglassEmptyOutlinedIcon from '@mui/icons-material/HourglassEmptyOutlined'
import BalanceOutlinedIcon from '@mui/icons-material/BalanceOutlined'
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'
import { AuthContext } from '../../contexts/AuthContext'
import PoliceModeTab from '../../components/layout/PoliceModeTab'
import GlobalHeaderSearch from '../../components/search/GlobalHeaderSearch'
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { createReport, uploadReportMedia } from '../../services/reportsService'
import ReportSuggestionCard from '../../components/reports/ReportSuggestionCard'
import DateTimePicker from '../../components/ui/DateTimePicker'
import { getInitialsFromName, getUserAvatarUrl } from '../../utils/avatarUtils'
import '../../styles/ReportIncidentPage.css'
import '../../styles/DashboardPage.css'
import siaraLogo from '../../assets/logos/siara-logo.png'

const MAX_REPORT_MEDIA_FILES = 5
const MAX_REPORT_MEDIA_FILE_SIZE_BYTES = 5 * 1024 * 1024
const ALLOWED_REPORT_MEDIA_MIME_TYPES = new Set(['image/jpeg', 'image/jpg', 'image/pjpeg', 'image/png', 'image/webp'])

/* Fix default Leaflet marker icon paths (broken by bundlers) */
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

/**
 * Inner component that listens for map clicks and calls the parent handler.
 */
function MapClickHandler({ onClick }) {
  useMapEvents({
    click(e) {
      onClick(e.latlng);
    },
  });
  return null;
}

function MapViewportController({ locationCoords, locationType, defaultCenter, defaultZoom, duration = 1.1 }) {
  const map = useMap()

  useEffect(() => {
    if (!locationCoords) {
      return
    }

    const targetZoom = locationType === 'gps' ? 16 : 14
    map.flyTo([locationCoords.lat, locationCoords.lng], targetZoom, {
      animate: true,
      duration,
      easeLinearity: 0.25,
    })
  }, [defaultCenter?.lat, defaultCenter?.lng, defaultZoom, duration, locationCoords, locationType, map])

  return null
}

/* Relative "when did it happen" quick-picks (most incidents are recent, so this
   replaces the clunky native calendar for the common case). */
const TIME_PRESET_KEYS = [
  { key: 'now', minutes: 0 },
  { key: '5m',  minutes: 5 },
  { key: '15m', minutes: 15 },
  { key: '30m', minutes: 30 },
  { key: '1h',  minutes: 60 },
  { key: '2h',  minutes: 120 },
]

/** Format a Date as a local <input type="datetime-local"> value (YYYY-MM-DDTHH:mm). */
function toLocalDateTimeValue(date) {
  const pad = (n) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

/** Human-friendly summary of a chosen datetime-local value. */
function formatPickedTime(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleString('en', {
    weekday: 'short', day: 'numeric', month: 'short',
    hour: '2-digit', minute: '2-digit',
  })
}

export default function ReportIncidentPage() {
  /* ═══ ROUTING ═══ */
  const navigate = useNavigate()
  const { user, logout } = useContext(AuthContext)
  const { t } = useTranslation(['reports', 'common'])

  /* Scroll to top on mount — prevents the page from opening mid-scroll */
  useEffect(() => { window.scrollTo(0, 0) }, [])

  /* ═══ UI STATE ═══ */
  const [showDropdown, setShowDropdown] = useState(false)   // Header avatar dropdown
  const [headerSearchQuery, setHeaderSearchQuery] = useState('')
  const [currentStep, setCurrentStep] = useState(1)         // Active wizard step (1-5)
  const [isSubmitting, setIsSubmitting] = useState(false)   // Loading spinner during submit
  const [isSubmitted, setIsSubmitted] = useState(false)     // Switches to success screen
  const [submittedId, setSubmittedId] = useState(null)      // Generated tracking reference
  const [submitError, setSubmitError] = useState('')        // Submission error banner
  const [submitWarning, setSubmitWarning] = useState('')    // Non-blocking warning after report creation
  const [mediaError, setMediaError] = useState('')          // Media validation banner
  const [isUploadDragActive, setIsUploadDragActive] = useState(false)
  const [isResolvingCurrentLocation, setIsResolvingCurrentLocation] = useState(false)
  const [locationActionError, setLocationActionError] = useState('')
  const [addressQuery, setAddressQuery] = useState('')
  const [addressResults, setAddressResults] = useState([])
  const [isSearchingAddress, setIsSearchingAddress] = useState(false)
  const [showAddressSuggestions, setShowAddressSuggestions] = useState(false)

  /* ═══ FORM STATE ═══ */
  // All report fields consolidated in a single state object
  const [reportData, setReportData] = useState({
    type: '',                  // Selected incident type id
    locationType: '',          // 'gps' | 'search' | 'map'
    locationCoords: null,      // { lat, lng } or null
    locationAddress: '',       // Human-readable address string
    locationDetails: null,     // Structured location metadata from reverse geocoding
    locationAccuracy: null,    // Accuracy label (e.g. 'High-precision GPS')
    title: '',                 // Incident title (min 5 chars)
    description: '',           // Optional free-text description (max 500 chars)
    severity: 'medium',        // 'high' | 'medium' | 'low'
    timeOption: 'now',         // 'now' | 'earlier'
    timePreset: 'now',         // UI selection: 'now' | '5m' | '15m' | '30m' | '1h' | '2h' | 'custom'
    customTime: '',            // datetime-local string when timeOption === 'earlier'
    media: [],                 // Array of { file, name, type, preview } objects
  })

  /* ═══ WIZARD STEP DEFINITIONS ═══ */
  const steps = [
    { id: 1, label: t('reportIncidentPage.steps.incidentType'), icon: <GpsFixedOutlinedIcon fontSize="inherit" /> },
    { id: 2, label: t('reportIncidentPage.steps.location'), icon: <LocationOnOutlinedIcon fontSize="inherit" /> },
    { id: 3, label: t('reportIncidentPage.steps.details'), icon: <EditNoteOutlinedIcon fontSize="inherit" /> },
    { id: 4, label: t('reportIncidentPage.steps.media'), icon: <PhotoCameraOutlinedIcon fontSize="inherit" /> },
    { id: 5, label: t('reportIncidentPage.steps.verification'), icon: <CheckCircleOutlineRoundedIcon fontSize="inherit" /> }
  ]

  /* Reset center panel scroll to top on every step change */
  const centerPanelRef = React.useRef(null)
  useEffect(() => {
    if (centerPanelRef.current) centerPanelRef.current.scrollTop = 0
  }, [currentStep])

  /* ═══ STATIC DATA — incident types & severity levels ═══ */
  const incidentTypes = [
    { id: 'accident', icon: <CarCrashOutlinedIcon fontSize="inherit" className="icon-danger" />, label: t('reportIncidentPage.incidentTypes.accident.label'), desc: t('reportIncidentPage.incidentTypes.accident.desc') },
    { id: 'traffic', icon: <TrafficOutlinedIcon fontSize="inherit" className="icon-warning" />, label: t('reportIncidentPage.incidentTypes.traffic.label'), desc: t('reportIncidentPage.incidentTypes.traffic.desc') },
    { id: 'danger', icon: <LocalFireDepartmentOutlinedIcon fontSize="inherit" className="icon-fire" />, label: t('reportIncidentPage.incidentTypes.danger.label'), desc: t('reportIncidentPage.incidentTypes.danger.desc') },
    { id: 'weather', icon: <WaterDropOutlinedIcon fontSize="inherit" className="icon-info" />, label: t('reportIncidentPage.incidentTypes.weather.label'), desc: t('reportIncidentPage.incidentTypes.weather.desc') },
    { id: 'roadworks', icon: <ConstructionOutlinedIcon fontSize="inherit" className="icon-warning" />, label: t('reportIncidentPage.incidentTypes.roadworks.label'), desc: t('reportIncidentPage.incidentTypes.roadworks.desc') },
    { id: 'other', icon: <HelpOutlineOutlinedIcon fontSize="inherit" className="icon-muted" />, label: t('reportIncidentPage.incidentTypes.other.label'), desc: t('reportIncidentPage.incidentTypes.other.desc') }
  ]

  const severityLevels = [
    { id: 'high', label: t('reportIncidentPage.severity.high.label'), color: '#DC2626', desc: t('reportIncidentPage.severity.high.desc') },
    { id: 'medium', label: t('reportIncidentPage.severity.medium.label'), color: '#F59E0B', desc: t('reportIncidentPage.severity.medium.desc') },
    { id: 'low', label: t('reportIncidentPage.severity.low.label'), color: '#10B981', desc: t('reportIncidentPage.severity.low.desc') }
  ]

  const TIME_PRESETS = TIME_PRESET_KEYS.map((preset) => ({
    ...preset,
    label: t(`reportIncidentPage.timePresets.${preset.key}`),
  }))

  const DEFAULT_MAP_CENTER = { lat: 28.0339, lng: 1.6596 }

  const getLocationFallbackLabel = (lat, lng) => `Lat ${Number(lat).toFixed(5)}, Lng ${Number(lng).toFixed(5)}`

  const buildLocationDetails = (reverseData, lat, lng) => {
    const address = reverseData?.address || {}
    const road = [
      address?.road,
      address?.pedestrian,
      address?.footway,
      address?.path,
      address?.cycleway,
      reverseData?.name,
    ].find((value) => String(value || '').trim()) || ''

    const neighborhood = extractNeighborhoodName(address)

    return {
      road,
      neighborhood,
      district: String(address?.city_district || address?.district || address?.subdistrict || '').trim(),
      city: String(address?.city || address?.town || address?.village || address?.municipality || '').trim(),
      county: String(address?.county || '').trim(),
      state: String(address?.state || '').trim(),
      postcode: String(address?.postcode || '').trim(),
      country: String(address?.country || '').trim(),
      countryCode: String(address?.country_code || '').trim().toUpperCase(),
      roadType: String(reverseData?.type || '').trim(),
      osmType: String(reverseData?.osm_type || '').trim(),
      osmId: reverseData?.osm_id != null ? String(reverseData.osm_id) : '',
      lat: Number(lat),
      lng: Number(lng),
    }
  }

  const buildLocationDetailsRows = (details, coords) => {
    const rows = []

    if (details?.fullAddress) rows.push({ label: t('reportIncidentPage.locationDetails.fullAddress'), value: details.fullAddress })
    if (details?.road) rows.push({ label: t('reportIncidentPage.locationDetails.road'), value: details.road })
    if (details?.roadType) {
      const normalizedRoadType = String(details.roadType)
      rows.push({
        label: t('reportIncidentPage.locationDetails.roadType'),
        value: normalizedRoadType.charAt(0).toUpperCase() + normalizedRoadType.slice(1),
      })
    }
    if (details?.neighborhood) rows.push({ label: t('reportIncidentPage.locationDetails.neighborhood'), value: details.neighborhood })
    if (details?.district) rows.push({ label: t('reportIncidentPage.locationDetails.district'), value: details.district })
    if (details?.city) rows.push({ label: t('reportIncidentPage.locationDetails.city'), value: details.city })
    if (details?.county) rows.push({ label: t('reportIncidentPage.locationDetails.county'), value: details.county })
    if (details?.state) rows.push({ label: t('reportIncidentPage.locationDetails.state'), value: details.state })
    if (details?.postcode) rows.push({ label: t('reportIncidentPage.locationDetails.postcode'), value: details.postcode })
    if (details?.country || details?.countryCode) {
      const countryValue = [details?.country, details?.countryCode].filter(Boolean).join(' · ')
      rows.push({ label: t('reportIncidentPage.locationDetails.country'), value: countryValue })
    }

    const lat = Number(coords?.lat ?? details?.lat)
    const lng = Number(coords?.lng ?? details?.lng)
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      rows.push({ label: t('reportIncidentPage.locationDetails.coordinates'), value: `${lat.toFixed(6)}, ${lng.toFixed(6)}` })
    }

    return rows
  }

  const extractNeighborhoodName = (address = {}) => {
    const candidate = [
      address?.neighbourhood,
      address?.neighborhood,
      address?.suburb,
      address?.quarter,
      address?.city_district,
      address?.district,
      address?.village,
      address?.town,
      address?.city,
    ].find((value) => String(value || '').trim())

    return String(candidate || '').trim()
  }

  const reverseGeocodeCoordinates = async (lat, lng) => {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lng)}&zoom=18&addressdetails=1`,
      )

      if (!response.ok) {
        return {
          displayName: '',
          neighborhood: '',
          details: null,
        }
      }

      const data = await response.json()
      const details = buildLocationDetails(data, lat, lng)
      return {
        displayName: String(data?.display_name || '').trim(),
        neighborhood: details.neighborhood,
        details,
      }
    } catch {
      return {
        displayName: '',
        neighborhood: '',
        details: null,
      }
    }
  }

  const buildMapSelectionAddressLabel = (lat, lng, geoDetails) => {
    const fullRoadName = String(geoDetails?.displayName || '').trim()
    const primaryRoad = String(geoDetails?.details?.road || '').trim()
    const neighborhood = String(geoDetails?.details?.neighborhood || geoDetails?.neighborhood || '').trim()
    const fallback = getLocationFallbackLabel(lat, lng)

    const baseLabel = fullRoadName || primaryRoad || neighborhood || fallback
    const shouldAppendNeighborhood = neighborhood
      && primaryRoad
      && neighborhood.toLowerCase() !== primaryRoad.toLowerCase()
      && !fullRoadName
    const fullLabel = shouldAppendNeighborhood ? `${baseLabel}, ${neighborhood}` : baseLabel

    return `${fullLabel} (${t('reportIncidentPage.location.selectedOnMap')})`
  }

  const resolveCurrentPosition = () => {
    if (!navigator?.geolocation) {
      throw new Error(t('reportIncidentPage.errors.geolocationNotSupported'))
    }

    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        resolve,
        reject,
        {
          enableHighAccuracy: true,
          timeout: 12000,
          maximumAge: 60_000,
        },
      )
    })
  }

  const releaseMediaPreviews = (mediaItems) => {
    mediaItems.forEach((mediaItem) => {
      if (mediaItem?.preview) {
        URL.revokeObjectURL(mediaItem.preview)
      }
    })
  }

  /* ═══ LOCATION HANDLERS ═══ */
  // Simulate getting current GPS location (hardcoded Algiers coordinates)
  const getCurrentLocation = async () => {
    if (isResolvingCurrentLocation) {
      return
    }

    setLocationActionError('')
    setIsResolvingCurrentLocation(true)

    try {
      const position = await resolveCurrentPosition()
      const lat = Number(position?.coords?.latitude)
      const lng = Number(position?.coords?.longitude)
      const accuracyMeters = Number(position?.coords?.accuracy)

      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        throw new Error(t('reportIncidentPage.errors.unableToReadCoordinates'))
      }

      const geoDetails = await reverseGeocodeCoordinates(lat, lng)
      const accuracyLabel = Number.isFinite(accuracyMeters)
        ? t('reportIncidentPage.location.gpsAccuracy', { meters: Math.max(1, Math.round(accuracyMeters)) })
        : t('reportIncidentPage.location.highPrecisionGps')

      setReportData(prev => ({
        ...prev,
        locationType: 'gps',
        locationCoords: { lat, lng },
        locationAddress: geoDetails.displayName || geoDetails.details?.road || geoDetails.neighborhood || getLocationFallbackLabel(lat, lng),
        locationDetails: geoDetails.details,
        locationAccuracy: accuracyLabel,
      }))
    } catch (error) {
      const code = error?.code
      if (code === 1) {
        setLocationActionError(t('reportIncidentPage.errors.locationPermissionDenied'))
      } else if (code === 2) {
        setLocationActionError(t('reportIncidentPage.errors.locationUnavailable'))
      } else if (code === 3) {
        setLocationActionError(t('reportIncidentPage.errors.locationTimeout'))
      } else {
        setLocationActionError(error?.message || t('reportIncidentPage.errors.unableToGetLocation'))
      }
    } finally {
      setIsResolvingCurrentLocation(false)
    }
  }

  // Forward-geocode the query via OpenStreetMap Nominatim and present suggestions.
  // Algeria is biased via countrycodes=dz to keep results relevant.
  useEffect(() => {
    const trimmed = addressQuery.trim()
    if (trimmed.length < 3) {
      setAddressResults([])
      setIsSearchingAddress(false)
      return undefined
    }

    let cancelled = false
    setIsSearchingAddress(true)

    const timer = setTimeout(async () => {
      try {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/search?format=jsonv2&q=${encodeURIComponent(trimmed)}&countrycodes=dz&addressdetails=1&limit=6`,
          { headers: { 'Accept-Language': 'en' } },
        )
        if (!response.ok) {
          if (!cancelled) setAddressResults([])
          return
        }
        const data = await response.json()
        if (!cancelled) setAddressResults(Array.isArray(data) ? data : [])
      } catch {
        if (!cancelled) setAddressResults([])
      } finally {
        if (!cancelled) setIsSearchingAddress(false)
      }
    }, 350)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [addressQuery])

  const handlePickAddressSuggestion = (suggestion) => {
    const lat = Number(suggestion?.lat)
    const lng = Number(suggestion?.lon)
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return

    const details = buildLocationDetails(suggestion, lat, lng)
    const displayName = String(suggestion?.display_name || '').trim()

    setReportData(prev => ({
      ...prev,
      locationType: 'search',
      locationCoords: { lat, lng },
      locationAddress: displayName,
      locationDetails: details,
      locationAccuracy: t('reportIncidentPage.location.addressSearch'),
    }))
    setAddressQuery(displayName)
    setAddressResults([])
    setShowAddressSuggestions(false)
    setLocationActionError('')
  }

  /**
   * Handle a real click on the Leaflet map — store the selected coords.
   * @param {L.LatLng} latlng - The coordinates from the map click event.
   */
  const handleMapClick = async (latlng) => {
    setLocationActionError('')
    const lat = Number(latlng?.lat)
    const lng = Number(latlng?.lng)

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return
    }

    setReportData(prev => ({
      ...prev,
      locationType: 'map',
      locationCoords: { lat, lng },
      locationAddress: `${getLocationFallbackLabel(lat, lng)} (${t('reportIncidentPage.location.selectedOnMap')})`,
      locationDetails: {
        lat,
        lng,
      },
      locationAccuracy: t('reportIncidentPage.location.mapSelection')
    }))

    const geoDetails = await reverseGeocodeCoordinates(lat, lng)

    setReportData((prev) => {
      const isSameSelection = prev.locationType === 'map'
        && prev.locationCoords
        && Number(prev.locationCoords.lat) === lat
        && Number(prev.locationCoords.lng) === lng

      if (!isSameSelection) {
        return prev
      }

      return {
        ...prev,
        locationAddress: buildMapSelectionAddressLabel(lat, lng, geoDetails),
        locationDetails: {
          ...(geoDetails.details || prev.locationDetails || {}),
          fullAddress: geoDetails.displayName || prev.locationDetails?.fullAddress || '',
        },
      }
    })
  }

  /* ═══ MEDIA HANDLERS ═══ */
  const appendMediaFiles = (inputFiles = []) => {
    const files = Array.from(inputFiles || [])
    const remainingSlots = Math.max(0, MAX_REPORT_MEDIA_FILES - reportData.media.length)

    setMediaError('')

    if (!files.length) {
      return
    }

    if (remainingSlots === 0) {
      setMediaError(t('reportIncidentPage.errors.mediaMaxFiles'))
      return
    }

    const acceptedMedia = []
    let nextError = ''

    for (const file of files) {
      if (!ALLOWED_REPORT_MEDIA_MIME_TYPES.has(file.type)) {
        nextError = t('reportIncidentPage.errors.mediaInvalidType')
        continue
      }

      if (file.size > MAX_REPORT_MEDIA_FILE_SIZE_BYTES) {
        nextError = t('reportIncidentPage.errors.mediaFileTooLarge')
        continue
      }

      if (acceptedMedia.length >= remainingSlots) {
        nextError = t('reportIncidentPage.errors.mediaMaxFiles')
        continue
      }

      acceptedMedia.push({
        file,
        name: file.name,
        type: 'image',
        preview: URL.createObjectURL(file)
      })
    }

    if (!acceptedMedia.length) {
      setMediaError(nextError || t('reportIncidentPage.errors.mediaNoValidImages'))
      return
    }

    setReportData(prev => ({
      ...prev,
      media: [...prev.media, ...acceptedMedia]
    }))

    if (nextError) {
      setMediaError(nextError)
    }
  }

  // Process file input: validate images and create object-URLs for previews
  const handleMediaUpload = (e) => {
    appendMediaFiles(e.target.files || [])
    e.target.value = ''
  }

  const handleUploadZoneDrop = (event) => {
    event.preventDefault()
    setIsUploadDragActive(false)
    appendMediaFiles(event.dataTransfer?.files || [])
  }

  const handleUploadZoneDragOver = (event) => {
    event.preventDefault()
    if (!isUploadDragActive) {
      setIsUploadDragActive(true)
    }
  }

  const handleUploadZoneDragLeave = (event) => {
    if (event.currentTarget.contains(event.relatedTarget)) {
      return
    }

    setIsUploadDragActive(false)
  }

  // Remove a media item by index
  const removeMedia = (index) => {
    setReportData((prev) => {
      const mediaToRemove = prev.media[index]
      if (mediaToRemove?.preview) {
        URL.revokeObjectURL(mediaToRemove.preview)
      }

      return {
        ...prev,
        media: prev.media.filter((_, i) => i !== index),
      }
    })
    setMediaError('')
  }

  /* ═══ STEP VALIDATION & NAVIGATION ═══ */
  // Per-step validation: returns true if the step's required fields are filled
  const canProceed = () => {
    switch (currentStep) {
      case 1: return reportData.type !== ''
      case 2: return reportData.locationCoords !== null
      case 3: return reportData.title.trim().length >= 2
      case 4: return true // Media is optional
      case 5: return true
      default: return false
    }
  }

  const nextStep = () => {
    if (canProceed() && currentStep < 5) {
      setCurrentStep(prev => prev + 1)
    }
  }

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(prev => prev - 1)
    }
  }

  /* ═══ SUBMIT HANDLER ═══ */
  const buildCreatePayload = () => ({
    incidentType: reportData.type,
    title: reportData.title.trim(),
    description: reportData.description.trim(),
    severity: reportData.severity,
    occurredAt: reportData.timeOption === 'earlier' && reportData.customTime
      ? new Date(reportData.customTime).toISOString()
      : new Date().toISOString(),
    location: {
      lat: reportData.locationCoords?.lat,
      lng: reportData.locationCoords?.lng,
      label: reportData.locationAddress.trim(),
    },
  })

  const submitReport = async () => {
    if (isSubmitting) {
      return
    }

    setSubmitError('')
    setSubmitWarning('')
    setIsSubmitting(true)

    try {
      const createdReport = await createReport(buildCreatePayload())

      if (createdReport?.id && reportData.media.length > 0) {
        try {
          await uploadReportMedia(createdReport.id, reportData.media.map((mediaItem) => mediaItem.file))
        } catch (error) {
          setSubmitWarning(error.message || t('reportIncidentPage.errors.mediaUploadFailed'))
        }
      }

      releaseMediaPreviews(reportData.media)
      setIsSubmitting(false)
      setIsSubmitted(true)
      setSubmittedId(createdReport?.id || null)
    } catch (error) {
      setIsSubmitting(false)
      setSubmitError(error.message || t('reportIncidentPage.errors.submitFailed'))
    }
  }

  /* ═══ DERIVED HELPERS ═══ */
  // Get type info
  const getTypeInfo = () => incidentTypes.find(tp => tp.id === reportData.type)

  // Generate preview title
  const getPreviewTitle = () => {
    if (reportData.title) return reportData.title
    const typeInfo = getTypeInfo()
    return typeInfo ? t('reportIncidentPage.preview.reportedTitle', { type: typeInfo.label }) : t('reportIncidentPage.preview.newIncident')
  }

  const userAvatarUrl = getUserAvatarUrl(user)
  const userInitials = getInitialsFromName(user?.name || user?.email || 'User')
  const selectedLocationDetailRows = buildLocationDetailsRows(reportData.locationDetails, reportData.locationCoords)

  /* ═══ SUCCESS SCREEN (shown after submission) ═══ */
  // Success screen
  if (isSubmitted) {
    return (
      <div className="report-page">
        <header className="siara-dashboard-header">
          <div className="dash-header-inner">
            <div className="dash-header-left">
              <div className="dash-logo-block">
                <img src={siaraLogo} alt="SIARA" className="header-logo" />
              </div>
              <nav className="dash-header-tabs">
                <button className="dash-tab" onClick={() => navigate('/news')}>{t('common:nav.feed')}</button>
                <button className="dash-tab" onClick={() => navigate('/map')}>{t('common:nav.map')}</button>
                <button className="dash-tab" onClick={() => navigate('/alerts')}>{t('common:nav.alerts')}</button>
                <button className="dash-tab dash-tab-active" onClick={() => navigate('/report')}>{t('common:nav.reports')}</button>
                <button className="dash-tab" onClick={() => navigate('/dashboard')}>{t('common:nav.dashboard')}</button>
                <button className="dash-tab" onClick={() => navigate('/predictions')}>{t('common:nav.predictions')}</button>
                <PoliceModeTab user={user} />
              </nav>
            </div>
            <div className="dash-header-center">
              <GlobalHeaderSearch
                navigate={navigate}
                query={headerSearchQuery}
                setQuery={setHeaderSearchQuery}
                placeholder={t('reportIncidentPage.header.searchPlaceholder')}
                ariaLabel={t('common:actions.search')}
                currentUser={user}
              />
            </div>
            <div className="dash-header-right">
              <NotificationBell />
              <div className="dash-avatar-wrapper">
                <button className={`dash-avatar ${userAvatarUrl ? 'has-image' : ''}`} onClick={() => setShowDropdown(!showDropdown)} aria-label={t('reportIncidentPage.header.userProfile')}>
                  {userAvatarUrl ? (
                    <img src={userAvatarUrl} alt={t('reportIncidentPage.header.userAvatar')} className="dash-avatar-image" />
                  ) : userInitials}
                </button>
                {showDropdown && (
                  <div className="user-dropdown">
                    <button className="dropdown-item" onClick={() => { setShowDropdown(false); navigate('/profile') }}>{t('common:nav.profile')}</button>
                    <button className="dropdown-item" onClick={() => { setShowDropdown(false); navigate('/settings') }}>{t('common:nav.settings')}</button>
                    <button className="dropdown-item" onClick={() => { setShowDropdown(false); navigate('/notifications') }}>{t('common:nav.notifications')}</button>
                    <div className="dropdown-divider"></div>
                    <button className="dropdown-item logout" onClick={() => { logout(); navigate('/home') }}>{t('common:nav.logout')}</button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>

        <div className="success-container">
          <div className="success-card">
            <div className="success-icon-wrap">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <h1 className="success-title">{t('reportIncidentPage.success.title')}</h1>
            <p className="success-id">{t('reportIncidentPage.success.reference')} <strong>{submittedId}</strong></p>

            <div className="success-status">
              <div className="status-badge pending">
                <span className="status-dot"></span>
                {t('reportIncidentPage.success.awaitingVerification')}
              </div>
            </div>

            {submitWarning && <p className="step-hint">{submitWarning}</p>}

            <div className="success-next">
              <h3>{t('reportIncidentPage.success.whatHappensNext')}</h3>
              <div className="next-steps">
                <div className="next-step">
                  <span className="step-num">1</span>
                  <div className="step-info">
                    <span className="step-title">{t('reportIncidentPage.success.nextSteps.autoReview.title')}</span>
                    <span className="step-desc">{t('reportIncidentPage.success.nextSteps.autoReview.desc')}</span>
                  </div>
                </div>
                <div className="next-step">
                  <span className="step-num">2</span>
                  <div className="step-info">
                    <span className="step-title">{t('reportIncidentPage.success.nextSteps.communityConfirmation.title')}</span>
                    <span className="step-desc">{t('reportIncidentPage.success.nextSteps.communityConfirmation.desc')}</span>
                  </div>
                </div>
                <div className="next-step">
                  <span className="step-num">3</span>
                  <div className="step-info">
                    <span className="step-title">{t('reportIncidentPage.success.nextSteps.officialValidation.title')}</span>
                    <span className="step-desc">{t('reportIncidentPage.success.nextSteps.officialValidation.desc')}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="success-actions">
              <button className="action-btn primary" onClick={() => navigate(`/incident/${submittedId}`)}>
                {t('reportIncidentPage.success.viewMyReport')}
              </button>
              <button className="action-btn secondary" onClick={() => { window.location.href = '/report' }}>
                {t('reportIncidentPage.success.reportAnother')}
              </button>
              <button className="action-btn back" onClick={() => navigate('/news')}>
                <ArrowBackRoundedIcon fontSize="inherit" /> {t('reportIncidentPage.success.backToFeed')}
              </button>
            </div>

            <div className="success-trust">
              <p>{t('reportIncidentPage.success.trustNotice')}</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  /* ═══ MAIN RENDER (wizard form) ═══ */
  return (
    <div className="report-page">
      {/* ═══ FLOATING HEADER ═══ */}
      <header className="siara-dashboard-header">
        <div className="dash-header-inner">
          <div className="dash-header-left">
            <div className="dash-logo-block">
              <img src={siaraLogo} alt="SIARA" className="header-logo" />
            </div>
            <nav className="dash-header-tabs">
              <button className="dash-tab" onClick={() => navigate('/news')}>{t('common:nav.feed')}</button>
              <button className="dash-tab" onClick={() => navigate('/map')}>{t('common:nav.map')}</button>
              <button className="dash-tab" onClick={() => navigate('/alerts')}>{t('common:nav.alerts')}</button>
              <button className="dash-tab dash-tab-active" onClick={() => navigate('/report')}>{t('common:nav.reports')}</button>
              <button className="dash-tab" onClick={() => navigate('/dashboard')}>{t('common:nav.dashboard')}</button>
              <button className="dash-tab" onClick={() => navigate('/predictions')}>{t('common:nav.predictions')}</button>
              <PoliceModeTab user={user} />
            </nav>
          </div>
          <div className="dash-header-center">
            <GlobalHeaderSearch
              navigate={navigate}
              query={headerSearchQuery}
              setQuery={setHeaderSearchQuery}
              placeholder={t('reportIncidentPage.header.searchPlaceholder')}
              ariaLabel={t('common:actions.search')}
              currentUser={user}
            />
          </div>
          <div className="dash-header-right">
            <NotificationBell />
            <div className="dash-avatar-wrapper">
              <button className={`dash-avatar ${userAvatarUrl ? 'has-image' : ''}`} onClick={() => setShowDropdown(!showDropdown)} aria-label={t('reportIncidentPage.header.userProfile')}>
                {userAvatarUrl ? (
                  <img src={userAvatarUrl} alt={t('reportIncidentPage.header.userAvatar')} className="dash-avatar-image" />
                ) : userInitials}
              </button>
              {showDropdown && (
                <div className="user-dropdown">
                  <button className="dropdown-item" onClick={() => { setShowDropdown(false); navigate('/profile') }}>{t('common:nav.profile')}</button>
                  <button className="dropdown-item" onClick={() => { setShowDropdown(false); navigate('/settings') }}>{t('common:nav.settings')}</button>
                  <button className="dropdown-item" onClick={() => { setShowDropdown(false); navigate('/notifications') }}>{t('common:nav.notifications')}</button>
                  <div className="dropdown-divider"></div>
                  <button className="dropdown-item logout" onClick={() => { logout(); navigate('/home') }}>{t('common:nav.logout')}</button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* ═══ MAIN 3-COLUMN GRID ═══ */}
      <div className="report-grid">
        {/* ═══ LEFT COLUMN — VERTICAL STEPPER ═══ */}
        <aside className="report-left">
          <div className="stepper-header">
            <span className="stepper-icon"><CampaignOutlinedIcon fontSize="inherit" /></span>
            <h2>{t('reportIncidentPage.wizard.heading')}</h2>
          </div>
          <div className="stepper">
            {steps.map((step, index) => (
              <div
                key={step.id}
                className={`step ${currentStep === step.id ? 'active' : ''} ${currentStep > step.id ? 'completed' : ''} ${currentStep < step.id ? 'disabled' : ''}`}
                onClick={() => currentStep > step.id && setCurrentStep(step.id)}
              >
                <div className="step-indicator">
                  {currentStep > step.id ? <CheckRoundedIcon fontSize="inherit" /> : step.id}
                </div>
                <div className="step-content">
                  <span className="step-label">{step.label}</span>
                </div>
                {index < steps.length - 1 && <div className="step-line"></div>}
              </div>
            ))}
          </div>

          <div className="trust-notice">
            <span className="trust-icon"><ShieldOutlinedIcon fontSize="inherit" className="icon-security" /></span>
            <div className="trust-text">
              <strong>{t('reportIncidentPage.wizard.secureReporting')}</strong>
              <p>{t('reportIncidentPage.wizard.secureReportingDesc')}</p>
            </div>
          </div>

          <button className="cancel-btn" onClick={() => navigate('/report')}>
            <CloseRoundedIcon fontSize="inherit" /> {t('reportIncidentPage.wizard.cancelReport')}
          </button>
        </aside>

        {/* ═══ CENTER COLUMN — STEP FORM PANELS ═══ */}
        <main className="report-center" ref={centerPanelRef}>
          {/* STEP 1 — Incident Type Selection (single-select cards) */}
          {currentStep === 1 && (
            <div className="step-panel">
              <div className="step-header">
                <h1>{t('reportIncidentPage.step1.heading')}</h1>
                <p>{t('reportIncidentPage.step1.subheading')}</p>
              </div>
              <div className="type-grid">
                {incidentTypes.map(type => (
                  <div
                    key={type.id}
                    className={`type-card ${reportData.type === type.id ? 'selected' : ''}`}
                    onClick={() => setReportData(prev => ({ ...prev, type: type.id }))}
                  >
                    <div className="type-check">{reportData.type === type.id ? <CheckRoundedIcon fontSize="inherit" /> : ''}</div>
                    <span className="type-icon">{type.icon}</span>
                    <span className="type-label">{type.label}</span>
                    <span className="type-desc">{type.desc}</span>
                  </div>
                ))}
              </div>
              {reportData.type === '' && (
                <p className="step-hint" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><WarningAmberOutlinedIcon fontSize="inherit" className="icon-warning" /> {t('reportIncidentPage.step1.selectTypeHint')}</p>
              )}
            </div>
          )}

          {/* STEP 2 — Location (GPS / search / map click) */}
          {currentStep === 2 && (
            <div className="step-panel">
              <div className="step-header">
                <h1>{t('reportIncidentPage.step2.heading')}</h1>
                <p>{t('reportIncidentPage.step2.subheading')}</p>
              </div>
              <div className="location-options">
                <button
                  className={`location-btn ${reportData.locationType === 'gps' ? 'selected' : ''}`}
                  onClick={getCurrentLocation}
                  disabled={isResolvingCurrentLocation}
                >
                  <span className="loc-icon"><LocationOnOutlinedIcon fontSize="inherit" /></span>
                  <div className="loc-info">
                    <span className="loc-label">{isResolvingCurrentLocation ? t('reportIncidentPage.step2.detectingLocation') : t('reportIncidentPage.step2.useCurrentLocation')}</span>
                    <span className="loc-desc">{isResolvingCurrentLocation ? t('reportIncidentPage.step2.pleaseWait') : t('reportIncidentPage.location.highPrecisionGps')}</span>
                  </div>
                  {reportData.locationType === 'gps' && <span className="loc-check"><CheckRoundedIcon fontSize="inherit" /></span>}
                </button>

                {locationActionError && (
                  <p className="input-error">{locationActionError}</p>
                )}

                <div className="location-search">
                  <label>{t('reportIncidentPage.step2.searchAddressLabel')}</label>
                  <div className="search-input-wrap">
                    <span className="search-icon"><SearchOutlinedIcon fontSize="inherit" /></span>
                    <input
                      type="text"
                      placeholder={t('reportIncidentPage.step2.searchAddressPlaceholder')}
                      value={addressQuery}
                      onChange={(e) => {
                        setAddressQuery(e.target.value)
                        setShowAddressSuggestions(true)
                      }}
                      onFocus={() => setShowAddressSuggestions(true)}
                      onBlur={() => setTimeout(() => setShowAddressSuggestions(false), 150)}
                      autoComplete="off"
                    />
                    {isSearchingAddress && (
                      <span className="address-search-spinner" aria-hidden="true">…</span>
                    )}
                  </div>

                  {showAddressSuggestions && addressResults.length > 0 && (
                    <ul className="address-suggestions" role="listbox">
                      {addressResults.map((suggestion) => (
                        <li key={`${suggestion.place_id}-${suggestion.osm_id}`}>
                          <button
                            type="button"
                            className="address-suggestion-btn"
                            onMouseDown={(event) => {
                              event.preventDefault()
                              handlePickAddressSuggestion(suggestion)
                            }}
                          >
                            <LocationOnOutlinedIcon fontSize="inherit" className="address-suggestion-icon" />
                            <span className="address-suggestion-text">{suggestion.display_name}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}

                  {showAddressSuggestions
                    && !isSearchingAddress
                    && addressQuery.trim().length >= 3
                    && addressResults.length === 0 && (
                    <p className="address-no-results">{t('reportIncidentPage.step2.noAddressFound')}</p>
                  )}
                </div>

                <div className="map-section">
                  <label>{t('reportIncidentPage.step2.selectOnMapLabel')}</label>
                  <div className="map-interactive-leaflet">
                    <MapContainer
                      center={[DEFAULT_MAP_CENTER.lat, DEFAULT_MAP_CENTER.lng]}
                      zoom={5}
                      style={{ width: '100%', height: '100%' }}
                      scrollWheelZoom={true}
                    >
                      <TileLayer
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                      />
                      <MapViewportController
                        locationCoords={reportData.locationCoords}
                        locationType={reportData.locationType}
                        defaultCenter={DEFAULT_MAP_CENTER}
                        defaultZoom={5}
                        duration={1.2}
                      />
                      <MapClickHandler onClick={handleMapClick} />
                      {reportData.locationCoords && (
                        <Marker position={[reportData.locationCoords.lat, reportData.locationCoords.lng]} />
                      )}
                    </MapContainer>
                    {!reportData.locationCoords && (
                      <p className="map-hint">{t('reportIncidentPage.step2.mapClickHint')}</p>
                    )}
                  </div>
                </div>

                {reportData.locationCoords && (
                  <div className="location-confirm">
                    <div className="confirm-icon"><CheckCircleOutlineRoundedIcon fontSize="inherit" className="icon-success" /></div>
                    <div className="confirm-info">
                      <span className="confirm-address">{reportData.locationAddress}</span>
                      <span className="confirm-accuracy">
                        <span className="accuracy-dot"></span>
                        {reportData.locationAccuracy}
                      </span>
                      {selectedLocationDetailRows.length > 0 && (
                        <div className="confirm-location-details" role="list" aria-label={t('reportIncidentPage.step2.locationDetailsAriaLabel')}>
                          {selectedLocationDetailRows.map((item) => (
                            <div key={`${item.label}-${item.value}`} className="confirm-location-row" role="listitem">
                              <span className="confirm-location-key">{item.label}</span>
                              <span className="confirm-location-value">{item.value}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <button className="confirm-edit" onClick={() => setReportData(prev => ({ ...prev, locationCoords: null, locationAddress: '', locationType: '', locationDetails: null }))}>
                      <EditRoundedIcon fontSize="inherit" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* STEP 3 — Details (title, description, severity, time) */}
          {currentStep === 3 && (
            <div className="step-panel">
              <div className="step-header">
                <h1>{t('reportIncidentPage.step3.heading')}</h1>
                <p>{t('reportIncidentPage.step3.subheading')}</p>
              </div>
              <div className="details-form">
                <div className="form-group">
                  <label>{t('reportIncidentPage.step3.titleLabel')} <span className="required">*</span></label>
                  <input
                    type="text"
                    className="title-input"
                    placeholder={t('reportIncidentPage.step3.titlePlaceholder')}
                    value={reportData.title}
                    onChange={(e) => setReportData(prev => ({ ...prev, title: e.target.value.slice(0, 100) }))}
                    maxLength={100}
                  />
                  <div className="input-meta">
                    <span className="char-count">{reportData.title.length}/100</span>
                    {reportData.title.length < 2 && reportData.title.length > 0 && (
                      <span className="input-error">{t('reportIncidentPage.step3.titleMinChars')}</span>
                    )}
                  </div>
                </div>

                <div className="form-group">
                  <label>{t('reportIncidentPage.step3.descriptionLabel')} <span className="optional">({t('reportIncidentPage.step3.optional')})</span></label>
                  <div className="desc-field">
                    <textarea
                      className="desc-input"
                      placeholder={t('reportIncidentPage.step3.descriptionPlaceholder')}
                      value={reportData.description}
                      onChange={(e) => setReportData(prev => ({ ...prev, description: e.target.value.slice(0, 500) }))}
                      maxLength={500}
                      rows={4}
                    />
                    <div className="input-meta">
                      <span className={`char-count ${reportData.description.length >= 450 ? 'is-near-limit' : ''}`}>
                        {reportData.description.length}/500
                      </span>
                    </div>
                  </div>
                  <div className="writing-tips">
                    <span className="tips-title" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><TipsAndUpdatesOutlinedIcon fontSize="inherit" className="icon-info" /> {t('reportIncidentPage.step3.tips.heading')}</span>
                    <ul>
                      <li>{t('reportIncidentPage.step3.tips.tip1')}</li>
                      <li>{t('reportIncidentPage.step3.tips.tip2')}</li>
                      <li>{t('reportIncidentPage.step3.tips.tip3')}</li>
                    </ul>
                  </div>
                </div>

                <ReportSuggestionCard
                  title={reportData.title}
                  description={reportData.description}
                  lat={reportData.locationCoords?.lat}
                  lng={reportData.locationCoords?.lng}
                  currentType={reportData.type}
                  currentSeverity={
                    reportData.severity === 'high'
                      ? 'high'
                      : reportData.severity === 'low'
                        ? 'low'
                        : 'medium'
                  }
                  onApplyType={(suggestedType) => {
                    if (incidentTypes.some((tp) => tp.id === suggestedType)) {
                      setReportData((prev) => ({ ...prev, type: suggestedType }))
                    }
                  }}
                  onApplySeverity={(suggestedSeverity) => {
                    const mapped =
                      suggestedSeverity === 'high'
                        ? 'high'
                        : suggestedSeverity === 'low'
                          ? 'low'
                          : 'medium'
                    setReportData((prev) => ({ ...prev, severity: mapped }))
                  }}
                />

                <div className="form-group">
                  <label>{t('reportIncidentPage.step3.severityLabel')}</label>
                  <div className="severity-selector">
                    {severityLevels.map(sev => (
                      <button
                        key={sev.id}
                        className={`sev-btn ${reportData.severity === sev.id ? 'selected' : ''}`}
                        onClick={() => setReportData(prev => ({ ...prev, severity: sev.id }))}
                        style={{ '--sev-color': sev.color }}
                      >
                        <span className="sev-dot" style={{ background: sev.color }}></span>
                        <div className="sev-info">
                          <span className="sev-label">{sev.label}</span>
                          <span className="sev-desc">{sev.desc}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="form-group">
                  <label>{t('reportIncidentPage.step3.whenLabel')}</label>
                  <div className="time-presets">
                    {TIME_PRESETS.map((preset) => (
                      <button
                        key={preset.key}
                        type="button"
                        className={`time-chip ${reportData.timePreset === preset.key ? 'selected' : ''}`}
                        onClick={() => setReportData(prev => (
                          preset.key === 'now'
                            ? { ...prev, timeOption: 'now', timePreset: 'now', customTime: '' }
                            : {
                                ...prev,
                                timeOption: 'earlier',
                                timePreset: preset.key,
                                customTime: toLocalDateTimeValue(new Date(Date.now() - preset.minutes * 60000)),
                              }
                        ))}
                      >
                        {preset.key === 'now' && <span className="time-chip-dot" />}
                        {preset.label}
                      </button>
                    ))}
                    <button
                      type="button"
                      className={`time-chip time-chip--custom ${reportData.timePreset === 'custom' ? 'selected' : ''}`}
                      onClick={() => setReportData(prev => ({
                        ...prev,
                        timeOption: 'earlier',
                        timePreset: 'custom',
                        customTime: prev.customTime || toLocalDateTimeValue(new Date()),
                      }))}
                    >
                      <CalendarMonthRoundedIcon fontSize="inherit" />
                      {t('reportIncidentPage.step3.pickDateTime')}
                    </button>
                  </div>

                  {reportData.timePreset === 'custom' && (
                    <div className="custom-time-input">
                      <DateTimePicker
                        value={reportData.customTime}
                        max={toLocalDateTimeValue(new Date())}
                        onChange={(next) => setReportData(prev => ({ ...prev, customTime: next }))}
                      />
                    </div>
                  )}

                  {reportData.timeOption === 'earlier' && reportData.customTime && (
                    <p className="time-hint">
                      <TimerOutlinedIcon fontSize="inherit" />
                      {t('reportIncidentPage.step3.incidentTimeHint')} <strong>{formatPickedTime(reportData.customTime)}</strong>
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* STEP 4 — Media Upload (photos, optional) */}
          {currentStep === 4 && (
            <div className="step-panel">
              <div className="step-header">
                <h1>{t('reportIncidentPage.step4.heading')}</h1>
                <p>{t('reportIncidentPage.step4.subheading')}</p>
              </div>
              <div className="media-section">
                <div className="media-upload">
                  <input
                    type="file"
                    id="media-input"
                    accept="image/jpeg,image/png,image/webp"
                    multiple
                    onChange={handleMediaUpload}
                    style={{ display: 'none' }}
                  />
                  <label
                    htmlFor="media-input"
                    className={`upload-zone ${isUploadDragActive ? 'is-drag-active' : ''}`}
                    onDrop={handleUploadZoneDrop}
                    onDragOver={handleUploadZoneDragOver}
                    onDragLeave={handleUploadZoneDragLeave}
                  >
                    <span className="upload-icon"><PhotoCameraOutlinedIcon fontSize="inherit" /></span>
                    <span className="upload-title">{t('reportIncidentPage.step4.uploadTitle')}</span>
                    <span className="upload-desc">
                      {isUploadDragActive
                        ? t('reportIncidentPage.step4.dropHere')
                        : t('reportIncidentPage.step4.uploadDesc')}
                    </span>
                    <span className="upload-limit">{t('reportIncidentPage.step4.uploadLimit')}</span>
                  </label>
                </div>

                {mediaError && (
                  <p className="input-error">{mediaError}</p>
                )}

                {reportData.media.length > 0 && (
                  <div className="media-preview-grid">
                    {reportData.media.map((media, index) => (
                      <div key={index} className="media-preview-item">
                        <img src={media.preview} alt={t('reportIncidentPage.step4.previewAlt', { index: index + 1 })} />
                        <button className="remove-media" onClick={() => removeMedia(index)} aria-label={t('reportIncidentPage.step4.removeMedia')}><CloseRoundedIcon fontSize="inherit" /></button>
                      </div>
                    ))}
                  </div>
                )}

                  <div className="media-notice">
                    <span className="notice-icon"><LockOutlinedIcon fontSize="inherit" className="icon-security" /></span>
                    <div className="notice-text">
                      <strong>{t('reportIncidentPage.step4.privacyTitle')}</strong>
                      <p>{t('reportIncidentPage.step4.privacyDesc')}</p>
                  </div>
                </div>

                <div className="skip-media">
                  <p>{t('reportIncidentPage.step4.noMedia')}</p>
                  <button className="skip-btn" onClick={nextStep}>{t('reportIncidentPage.step4.skipStep')} <ArrowForwardRoundedIcon fontSize="inherit" /></button>
                </div>
              </div>
            </div>
          )}

          {/* STEP 5 — Review & Submit */}
          {currentStep === 5 && (
            <div className="step-panel">
              <div className="step-header">
                <h1>{t('reportIncidentPage.step5.heading')}</h1>
                <p>{t('reportIncidentPage.step5.subheading')}</p>
              </div>
              <div className="review-content">
                <div className="review-section">
                  <div className="review-row">
                    <span className="review-label">{t('reportIncidentPage.step5.reviewLabels.incidentType')}</span>
                    <span className="review-value">
                      {getTypeInfo()?.icon} {getTypeInfo()?.label}
                    </span>
                    <button className="review-edit" onClick={() => setCurrentStep(1)}>{t('common:actions.edit')}</button>
                  </div>
                  <div className="review-row">
                    <span className="review-label">{t('reportIncidentPage.step5.reviewLabels.location')}</span>
                    <span className="review-value" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><LocationOnOutlinedIcon fontSize="inherit" /> {reportData.locationAddress}</span>
                    <button className="review-edit" onClick={() => setCurrentStep(2)}>{t('common:actions.edit')}</button>
                  </div>
                  <div className="review-row">
                    <span className="review-label">{t('reportIncidentPage.step5.reviewLabels.title')}</span>
                    <span className="review-value">{reportData.title}</span>
                    <button className="review-edit" onClick={() => setCurrentStep(3)}>{t('common:actions.edit')}</button>
                  </div>
                  {reportData.description && (
                    <div className="review-row">
                      <span className="review-label">{t('reportIncidentPage.step5.reviewLabels.description')}</span>
                      <span className="review-value desc">{reportData.description}</span>
                    </div>
                  )}
                  <div className="review-row">
                    <span className="review-label">{t('reportIncidentPage.step5.reviewLabels.severity')}</span>
                    <span className="review-value">
                      <span className="sev-indicator" style={{ background: severityLevels.find(s => s.id === reportData.severity)?.color }}></span>
                      {severityLevels.find(s => s.id === reportData.severity)?.label}
                    </span>
                  </div>
                  <div className="review-row">
                    <span className="review-label">{t('reportIncidentPage.step5.reviewLabels.time')}</span>
                    <span className="review-value">
                      {reportData.timeOption === 'now' ? <><TimerOutlinedIcon fontSize="inherit" /> {t('reportIncidentPage.timePresets.now')}</> : <><AccessTimeRoundedIcon fontSize="inherit" /> {formatPickedTime(reportData.customTime)}</>}
                    </span>
                  </div>
                  <div className="review-row">
                    <span className="review-label">{t('reportIncidentPage.step5.reviewLabels.media')}</span>
                    <span className="review-value">
                      {reportData.media.length > 0
                        ? <><PhotoCameraOutlinedIcon fontSize="inherit" /> {t('reportIncidentPage.step5.imageCount', { count: reportData.media.length })}</>
                        : t('reportIncidentPage.step5.noMedia')}
                    </span>
                    <button className="review-edit" onClick={() => setCurrentStep(4)}>{t('common:actions.edit')}</button>
                  </div>
                </div>

                <div className="review-agreement">
                  <label className="checkbox-label">
                    <input type="checkbox" defaultChecked />
                    <span>{t('reportIncidentPage.step5.agreementText')}</span>
                  </label>
                </div>

                <div className="review-notice">
                  <span className="notice-icon"><InfoOutlinedIcon fontSize="inherit" className="icon-info" /></span>
                  <p>{t('reportIncidentPage.step5.reviewNotice')}</p>
                </div>

                {!user && (
                  <div className="review-notice">
                    <span className="notice-icon"><EnhancedEncryptionOutlinedIcon fontSize="inherit" className="icon-security" /></span>
                    <p>{t('reportIncidentPage.step5.loginRequired')}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ═══ BOTTOM NAVIGATION (Back / Continue / Submit) ═══ */}
          {submitError && (
            <div className="review-notice">
              <span className="notice-icon"><WarningAmberOutlinedIcon fontSize="inherit" className="icon-warning" /></span>
              <p>{submitError}</p>
            </div>
          )}
          <div className="step-nav">
            {currentStep > 1 && (
              <button className="nav-btn secondary" onClick={prevStep}>
                <ArrowBackRoundedIcon fontSize="inherit" /> {t('common:actions.back')}
              </button>
            )}
            <div className="nav-spacer"></div>
            {currentStep < 5 ? (
              <button className="nav-btn primary" onClick={nextStep} disabled={!canProceed()}>
                {t('reportIncidentPage.nav.continue')} <ArrowForwardRoundedIcon fontSize="inherit" />
              </button>
            ) : (
              <button className="nav-btn submit" onClick={submitReport} disabled={isSubmitting || !user}>
                {isSubmitting ? (
                  <><span className="nav-btn-spinner" />{t('reportIncidentPage.nav.submitting')}</>
                ) : (
                  t('reportIncidentPage.nav.submitReport')
                )}
              </button>
            )}
          </div>
        </main>

        {/* ═══ RIGHT COLUMN — LIVE PREVIEW SIDEBAR ═══ */}
        <aside className="report-right">
          <div className="preview-header">
            <span className="preview-icon"><VisibilityOutlinedIcon fontSize="inherit" /></span>
            <h3>{t('reportIncidentPage.preview.heading')}</h3>
          </div>

          {/* Incident Card Preview */}
          <div className="preview-section">
            <span className="preview-label">{t('reportIncidentPage.preview.howItWillAppear')}</span>
            <div className="incident-preview-card">
              <div className="ipc-header">
                <span className="ipc-icon" style={{ background: `${severityLevels.find(s => s.id === reportData.severity)?.color}20` }}>
                  {getTypeInfo()?.icon || <CampaignOutlinedIcon fontSize="inherit" />}
                </span>
                <div className="ipc-info">
                  <span className="ipc-title">{getPreviewTitle()}</span>
                  <span className="ipc-meta">
                    {reportData.locationAddress || t('reportIncidentPage.preview.locationPlaceholder')}
                  </span>
                </div>
              </div>
              <div className="ipc-body">
                {reportData.description ? (
                  <p className="ipc-desc">{reportData.description.slice(0, 100)}{reportData.description.length > 100 ? '...' : ''}</p>
                ) : (
                  <p className="ipc-desc placeholder">{t('reportIncidentPage.preview.descriptionPlaceholder')}</p>
                )}
              </div>
              <div className="ipc-footer">
                <span className="ipc-sev" style={{ background: `${severityLevels.find(s => s.id === reportData.severity)?.color}15`, color: severityLevels.find(s => s.id === reportData.severity)?.color }}>
                  <span className="sev-dot-sm" style={{ background: severityLevels.find(s => s.id === reportData.severity)?.color }}></span>
                  {severityLevels.find(s => s.id === reportData.severity)?.label}
                </span>
                <span className="ipc-time">{t('reportIncidentPage.timePresets.now')}</span>
                <span className="ipc-status" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><HourglassEmptyOutlinedIcon fontSize="inherit" /> {t('reportIncidentPage.preview.pending')}</span>
              </div>
            </div>
          </div>

          {/* Mini Map */}
          <div className="preview-section">
            <span className="preview-label">{t('reportIncidentPage.preview.locationLabel')}</span>
            <div className="map-preview">
              <MapContainer
                center={[DEFAULT_MAP_CENTER.lat, DEFAULT_MAP_CENTER.lng]}
                zoom={5}
                style={{ width: '100%', height: '100%' }}
                scrollWheelZoom={false}
                dragging={false}
                zoomControl={false}
                doubleClickZoom={false}
                touchZoom={false}
                boxZoom={false}
                keyboard={false}
              >
                <TileLayer
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                />
                <MapViewportController
                  locationCoords={reportData.locationCoords}
                  locationType={reportData.locationType}
                  defaultCenter={DEFAULT_MAP_CENTER}
                  defaultZoom={5}
                  duration={0.95}
                />
                {reportData.locationCoords ? (
                  <Marker position={[reportData.locationCoords.lat, reportData.locationCoords.lng]} />
                ) : null}
              </MapContainer>
              {!reportData.locationCoords ? <p className="map-placeholder-text">{t('reportIncidentPage.preview.selectLocation')}</p> : null}
            </div>
          </div>

          {/* Verification Status */}
          <div className="preview-section">
            <span className="preview-label">{t('reportIncidentPage.preview.verificationStatus')}</span>
            <div className="verification-preview">
              <div className="verif-step">
                <span className="verif-icon pending"><HourglassEmptyOutlinedIcon fontSize="inherit" /></span>
                <div className="verif-info">
                  <span className="verif-title">{t('reportIncidentPage.preview.verifPending')}</span>
                  <span className="verif-desc">{t('reportIncidentPage.preview.verifPendingDesc')}</span>
                </div>
              </div>
              <div className="verif-timeline">
                <div className="timeline-step">
                  <span className="tl-dot"></span>
                  <span className="tl-label">{t('reportIncidentPage.preview.timeline.aiReview')}</span>
                </div>
                <div className="timeline-step">
                  <span className="tl-dot"></span>
                  <span className="tl-label">{t('reportIncidentPage.preview.timeline.community')}</span>
                </div>
                <div className="timeline-step">
                  <span className="tl-dot"></span>
                  <span className="tl-label">{t('reportIncidentPage.preview.timeline.published')}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Trust & Safety */}
          <div className="preview-section trust-preview">
            <span className="preview-label">{t('reportIncidentPage.preview.trustSafety')}</span>
            <ul className="trust-list">
              <li style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><CheckCircleOutlineRoundedIcon fontSize="inherit" className="icon-success" /> {t('reportIncidentPage.preview.trust.verifiedReports')}</li>
              <li style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><ShieldOutlinedIcon fontSize="inherit" className="icon-security" /> {t('reportIncidentPage.preview.trust.protectedData')}</li>
              <li style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><VisibilityOutlinedIcon fontSize="inherit" /> {t('reportIncidentPage.preview.trust.moderatedMedia')}</li>
              <li style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><BalanceOutlinedIcon fontSize="inherit" /> {t('reportIncidentPage.preview.trust.falseReportsRemoved')}</li>
            </ul>
          </div>
        </aside>
      </div>
    </div>
  )
}

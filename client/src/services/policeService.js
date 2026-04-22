import { userRequest } from '../requestMethodes'
import { normalizeReportMediaUrl } from './reportsService'

const POLICE_LOCATION_CACHE_KEY = 'siara.police.lastKnownLocation'
const POLICE_LOCATION_CACHE_MAX_AGE_MS = 15 * 60 * 1000
const POLICE_LOCATION_BROWSER_MAX_AGE_MS = 2 * 60 * 1000
const POLICE_LOCATION_SYNC_THROTTLE_MS = 60 * 1000
const POLICE_LOCATION_MIN_MOVE_METERS = 25
const POLICE_LOCATION_MAX_ACCURACY_M = 200

let lastLocationSyncMeta = {
  syncedAt: 0,
  coords: null,
}

function normalizeApiError(error, fallbackMessage) {
  return new Error(
    error?.response?.data?.message
      || error?.response?.data?.error
      || error?.message
      || fallbackMessage,
  )
}

function buildQuery(params = {}) {
  const query = new URLSearchParams()

  Object.entries(params).forEach(([key, value]) => {
    if (value == null || value === '') {
      return
    }

    query.set(key, String(value))
  })

  return query.toString()
}

export function formatPoliceDateTime(value, options = {}) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return 'Unknown'
  }

  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: options.includeYear === false ? undefined : 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

export function formatPoliceRelativeTime(value) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return 'Unknown time'
  }

  const diffMinutes = Math.max(0, Math.round((Date.now() - date.getTime()) / 60000))

  if (diffMinutes < 1) return 'Just now'
  if (diffMinutes < 60) return `${diffMinutes} min ago`

  const diffHours = Math.round(diffMinutes / 60)
  if (diffHours < 24) return `${diffHours} h ago`

  const diffDays = Math.round(diffHours / 24)
  if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`

  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
  }).format(date)
}

function severityRank(value) {
  if (value === 'critical') return 4
  if (value === 'high') return 3
  if (value === 'medium') return 2
  return 1
}

function toRadians(value) {
  return (Number(value) * Math.PI) / 180
}

function distanceMetersBetween(left, right) {
  if (!left || !right) {
    return Number.POSITIVE_INFINITY
  }

  const earthRadiusMeters = 6371000
  const dLat = toRadians(Number(right.lat) - Number(left.lat))
  const dLng = toRadians(Number(right.lng) - Number(left.lng))
  const a =
    Math.sin(dLat / 2) ** 2
    + Math.cos(toRadians(left.lat))
      * Math.cos(toRadians(right.lat))
      * Math.sin(dLng / 2) ** 2

  return earthRadiusMeters * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function getLocationStorage() {
  if (typeof window === 'undefined' || !window.localStorage) {
    return null
  }

  return window.localStorage
}

function readCachedPoliceLocation() {
  const storage = getLocationStorage()
  if (!storage) {
    return null
  }

  try {
    const raw = storage.getItem(POLICE_LOCATION_CACHE_KEY)
    if (!raw) {
      return null
    }

    const parsed = JSON.parse(raw)
    const capturedAtMs = parsed?.capturedAt ? new Date(parsed.capturedAt).getTime() : Number.NaN
    if (
      !parsed
      || !Number.isFinite(Number(parsed?.coords?.lat))
      || !Number.isFinite(Number(parsed?.coords?.lng))
      || !Number.isFinite(capturedAtMs)
      || Date.now() - capturedAtMs > POLICE_LOCATION_CACHE_MAX_AGE_MS
    ) {
      storage.removeItem(POLICE_LOCATION_CACHE_KEY)
      return null
    }

    return {
      coords: {
        lat: Number(parsed.coords.lat),
        lng: Number(parsed.coords.lng),
      },
      accuracyM: parsed.accuracyM == null ? null : Number(parsed.accuracyM),
      capturedAt: new Date(capturedAtMs).toISOString(),
      source: parsed.source || 'cached',
    }
  } catch {
    storage.removeItem(POLICE_LOCATION_CACHE_KEY)
    return null
  }
}

function writeCachedPoliceLocation(location) {
  const storage = getLocationStorage()
  if (!storage || !location?.coords) {
    return
  }

  try {
    storage.setItem(POLICE_LOCATION_CACHE_KEY, JSON.stringify({
      coords: {
        lat: Number(location.coords.lat),
        lng: Number(location.coords.lng),
      },
      accuracyM: location.accuracyM == null ? null : Number(location.accuracyM),
      capturedAt: location.capturedAt || new Date().toISOString(),
      source: location.source || 'browser',
    }))
  } catch {
    // Best-effort cache only.
  }
}

function normalizeLocationErrorReason(error) {
  if (!error) return 'temporary_error'
  if (error.code === 1) return 'permission_denied'
  if (error.code === 2) return 'unavailable'
  if (error.code === 3) return 'timeout'
  return 'temporary_error'
}

function shouldUseBrowserLocation(position) {
  if (!position?.coords) {
    return { ok: false, reason: 'unavailable' }
  }

  const capturedAtMs = Number(position.timestamp || Date.now())
  const accuracyM = Number(position.coords.accuracy)

  if (!Number.isFinite(capturedAtMs) || Date.now() - capturedAtMs > POLICE_LOCATION_BROWSER_MAX_AGE_MS) {
    return { ok: false, reason: 'stale' }
  }

  if (Number.isFinite(accuracyM) && accuracyM > POLICE_LOCATION_MAX_ACCURACY_M) {
    return { ok: false, reason: 'inaccurate', accuracyM }
  }

  return { ok: true }
}

function shouldSyncLocationToBackend(nextLocation) {
  if (!lastLocationSyncMeta.coords || !lastLocationSyncMeta.syncedAt) {
    return true
  }

  const ageMs = Date.now() - lastLocationSyncMeta.syncedAt
  if (ageMs >= POLICE_LOCATION_SYNC_THROTTLE_MS) {
    return true
  }

  return distanceMetersBetween(lastLocationSyncMeta.coords, nextLocation.coords) >= POLICE_LOCATION_MIN_MOVE_METERS
}

function normalizePerson(person) {
  if (!person || typeof person !== 'object') {
    return null
  }

  const avatarUrl = normalizeReportMediaUrl(person.avatarUrl || person.avatar_url || '')

  return {
    ...person,
    avatarUrl,
    avatar_url: avatarUrl,
    name: person.name || person.email || 'Officer',
  }
}

function normalizeZone(area) {
  if (!area || typeof area !== 'object') {
    return null
  }

  return {
    id: area.id == null ? null : Number(area.id),
    name: area.name || '',
    level: area.level || null,
    parentId: area.parentId == null ? null : Number(area.parentId),
    parentName: area.parentName || null,
  }
}

function buildIncidentLocationLabel(incident) {
  return [
    incident.locationLabel,
    incident.commune?.name,
    incident.wilaya?.name,
  ].filter(Boolean).join(', ')
}

function normalizeIncident(item) {
  if (!item || typeof item !== 'object') {
    return null
  }

  const occurredAt = item.occurredAt || item.createdAt || null
  const media = Array.isArray(item.media)
    ? item.media.map((mediaItem, index) => ({
      ...mediaItem,
      id: mediaItem?.id || `${item.id}-media-${index}`,
      url: normalizeReportMediaUrl(mediaItem?.url || ''),
    })).filter((mediaItem) => mediaItem.url)
    : []

  const incident = {
    ...item,
    id: item.id,
    displayId: item.displayId || item.id,
    title: item.title || item.incidentType || 'Incident',
    description: item.description || '',
    severity: String(item.severity || 'low').toLowerCase(),
    status: String(item.status || 'pending').toLowerCase(),
    incidentType: item.incidentType || 'incident',
    occurredAt,
    createdAt: item.createdAt || null,
    updatedAt: item.updatedAt || null,
    location: {
      lat: item.location?.lat == null ? null : Number(item.location.lat),
      lng: item.location?.lng == null ? null : Number(item.location.lng),
    },
    locationLabel: item.locationLabel || '',
    locationText: buildIncidentLocationLabel(item) || 'Unknown location',
    timeAgo: formatPoliceRelativeTime(occurredAt),
    occurredAtLabel: occurredAt ? formatPoliceDateTime(occurredAt) : 'Unknown',
    distanceMeters: item.distanceMeters == null ? null : Number(item.distanceMeters),
    distanceLabel: item.distanceMeters == null ? '' : `${Math.round(Number(item.distanceMeters))} m`,
    sourceChannel: item.sourceChannel || null,
    fieldNoteCount: Number(item.fieldNoteCount || 0),
    reportedBy: normalizePerson(item.reportedBy),
    assignedOfficer: normalizePerson(item.assignedOfficer),
    verifiedByOfficer: normalizePerson(item.verifiedByOfficer),
    resolvedByOfficer: normalizePerson(item.resolvedByOfficer),
    assignment: item.assignment || null,
    wilaya: normalizeZone(item.wilaya),
    commune: normalizeZone(item.commune),
    media,
  }

  incident.priorityScore = severityRank(incident.severity)
  return incident
}

function normalizeAlert(item) {
  if (!item || typeof item !== 'object') {
    return null
  }

  return {
    ...item,
    id: item.id,
    notificationId: item.notificationId || null,
    title: item.title || 'Alert',
    description: item.description || '',
    severity: String(item.severity || 'medium').toLowerCase(),
    status: String(item.status || 'active').toLowerCase(),
    read: Boolean(item.read),
    expired: Boolean(item.expired),
    createdAt: item.createdAt || item.notificationCreatedAt || null,
    createdAtLabel: formatPoliceDateTime(item.createdAt || item.notificationCreatedAt || null),
  }
}

function normalizeHistoryItem(item) {
  if (!item || typeof item !== 'object') {
    return null
  }

  return {
    ...item,
    id: item.id,
    note: item.note || '',
    createdAt: item.createdAt || null,
    createdAtLabel: formatPoliceDateTime(item.createdAt || null),
    actionType: item.actionType || 'update_status',
    officer: normalizePerson(item.officer),
  }
}

function normalizeOfficerContext(payload = {}) {
  return {
    officer: normalizePerson(payload.officer) || null,
    workZone: {
      wilaya: normalizeZone(payload.workZone?.wilaya),
      commune: normalizeZone(payload.workZone?.commune),
      activeAdminAreaId: payload.workZone?.activeAdminAreaId == null ? null : Number(payload.workZone.activeAdminAreaId),
      firstZoneSelectionCompleted: Boolean(payload.workZone?.firstZoneSelectionCompleted),
    },
    latestLocation: payload.latestLocation || null,
    requiresZoneSelection: Boolean(payload.requiresZoneSelection),
  }
}

function normalizePagination(pagination = {}, defaults = {}) {
  return {
    page: Number(pagination.page || defaults.page || 1),
    pageSize: Number(pagination.pageSize || defaults.pageSize || 20),
    total: Number(pagination.total || 0),
    totalPages: Number(pagination.totalPages || 1),
    returned: Number(pagination.returned || 0),
  }
}

export async function getPoliceMe() {
  try {
    const response = await userRequest.get('/police/me')
    return normalizeOfficerContext(response.data)
  } catch (error) {
    throw normalizeApiError(error, 'Failed to load police profile')
  }
}

export async function getPoliceWorkZoneOptions(wilayaId = null) {
  try {
    const response = await userRequest.get('/police/work-zone/options', {
      params: wilayaId ? { wilayaId } : undefined,
    })

    return {
      wilayas: Array.isArray(response.data?.wilayas)
        ? response.data.wilayas.map((item) => ({ id: Number(item.id), name: item.name || '' }))
        : [],
      communes: Array.isArray(response.data?.communes)
        ? response.data.communes.map((item) => ({ id: Number(item.id), name: item.name || '' }))
        : [],
      selectedWilayaId: response.data?.selectedWilayaId == null ? null : Number(response.data.selectedWilayaId),
      selectedCommuneId: response.data?.selectedCommuneId == null ? null : Number(response.data.selectedCommuneId),
    }
  } catch (error) {
    throw normalizeApiError(error, 'Failed to load work-zone options')
  }
}

export async function updatePoliceWorkZone(payload) {
  try {
    const response = await userRequest.put('/police/me/work-zone', payload)
    return normalizeOfficerContext(response.data)
  } catch (error) {
    throw normalizeApiError(error, 'Failed to save work zone')
  }
}

export async function updatePoliceLocation(payload) {
  try {
    const response = await userRequest.post('/police/me/location', payload)
    return response.data?.location || null
  } catch (error) {
    throw normalizeApiError(error, 'Failed to update officer location')
  }
}

export async function syncPoliceBrowserLocation() {
  const cachedLocation = readCachedPoliceLocation()

  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    return cachedLocation
      ? {
        ok: true,
        coords: cachedLocation.coords,
        accuracyM: cachedLocation.accuracyM,
        capturedAt: cachedLocation.capturedAt,
        source: 'cached',
        state: 'using_last_known',
        reason: 'unsupported',
      }
      : { ok: false, reason: 'unsupported', state: 'location_unavailable' }
  }

  const position = await new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 12000,
      maximumAge: 15000,
    })
  }).catch((error) => ({ error }))

  if (position?.error) {
    const reason = normalizeLocationErrorReason(position.error)
    if (cachedLocation) {
      return {
        ok: true,
        coords: cachedLocation.coords,
        accuracyM: cachedLocation.accuracyM,
        capturedAt: cachedLocation.capturedAt,
        source: 'cached',
        state: 'using_last_known',
        reason,
      }
    }

    return {
      ok: false,
      reason,
      state: reason === 'permission_denied' ? 'permission_denied' : 'location_unavailable',
    }
  }

  const locationCheck = shouldUseBrowserLocation(position)
  if (!locationCheck.ok) {
    if (cachedLocation) {
      return {
        ok: true,
        coords: cachedLocation.coords,
        accuracyM: cachedLocation.accuracyM,
        capturedAt: cachedLocation.capturedAt,
        source: 'cached',
        state: 'using_last_known',
        reason: locationCheck.reason,
        warning: locationCheck.reason === 'inaccurate' ? 'accuracy_low' : null,
      }
    }

    return {
      ok: false,
      reason: locationCheck.reason,
      state: locationCheck.reason === 'permission_denied' ? 'permission_denied' : 'location_unavailable',
      accuracyM: locationCheck.accuracyM || null,
    }
  }

  const nextLocation = {
    coords: {
      lat: Number(position.coords.latitude),
      lng: Number(position.coords.longitude),
    },
    accuracyM: position.coords.accuracy == null ? null : Number(position.coords.accuracy),
    capturedAt: new Date(position.timestamp || Date.now()).toISOString(),
    source: 'browser',
  }

  if (shouldSyncLocationToBackend(nextLocation)) {
    await updatePoliceLocation({
      lat: nextLocation.coords.lat,
      lng: nextLocation.coords.lng,
      accuracyM: nextLocation.accuracyM,
      heading: position.coords.heading,
      speedKmh:
        position.coords.speed == null || Number.isNaN(Number(position.coords.speed))
          ? null
          : Number(position.coords.speed) * 3.6,
      capturedAt: nextLocation.capturedAt,
      source: 'browser',
    })

    lastLocationSyncMeta = {
      syncedAt: Date.now(),
      coords: nextLocation.coords,
    }
  }

  writeCachedPoliceLocation(nextLocation)

  return {
    ok: true,
    coords: nextLocation.coords,
    accuracyM: nextLocation.accuracyM,
    capturedAt: nextLocation.capturedAt,
    source: 'browser',
    state: 'nearby_loaded',
  }
}

export async function getPoliceDashboard() {
  try {
    const response = await userRequest.get('/police/dashboard')

    return {
      ...normalizeOfficerContext(response.data),
      stats: {
        activeCount: Number(response.data?.stats?.activeCount || 0),
        highPriorityCount: Number(response.data?.stats?.highPriorityCount || 0),
        pendingVerificationCount: Number(response.data?.stats?.pendingVerificationCount || 0),
        unreadAlertsCount: Number(response.data?.stats?.unreadAlertsCount || 0),
      },
      activeIncidents: Array.isArray(response.data?.activeIncidents)
        ? response.data.activeIncidents.map(normalizeIncident).filter(Boolean)
        : [],
      nearbyIncidents: Array.isArray(response.data?.nearbyIncidents)
        ? response.data.nearbyIncidents.map(normalizeIncident).filter(Boolean)
        : [],
      nearbyLocationRequired: Boolean(response.data?.nearbyLocationRequired),
      myIncidents: Array.isArray(response.data?.myIncidents)
        ? response.data.myIncidents.map(normalizeIncident).filter(Boolean)
        : [],
      recentHistory: Array.isArray(response.data?.recentHistory)
        ? response.data.recentHistory.map(normalizeHistoryItem).filter(Boolean)
        : [],
      mapMarkers: Array.isArray(response.data?.mapMarkers) ? response.data.mapMarkers : [],
    }
  } catch (error) {
    throw normalizeApiError(error, 'Failed to load police dashboard')
  }
}

export async function listPoliceIncidents(params = {}) {
  try {
    const query = buildQuery(params)
    const response = await userRequest.get(`/police/incidents${query ? `?${query}` : ''}`)

    return {
      items: Array.isArray(response.data?.items)
        ? response.data.items.map(normalizeIncident).filter(Boolean)
        : [],
      pagination: normalizePagination(response.data?.pagination, params),
      scope: response.data?.scope || params.scope || 'active',
      locationRequired: Boolean(response.data?.locationRequired),
    }
  } catch (error) {
    throw normalizeApiError(error, 'Failed to load incidents')
  }
}

export async function getPoliceIncident(incidentId) {
  try {
    const response = await userRequest.get(`/police/incidents/${incidentId}`)
    return {
      incident: normalizeIncident(response.data?.incident),
      nearbyIncidents: Array.isArray(response.data?.nearbyIncidents)
        ? response.data.nearbyIncidents.map(normalizeIncident).filter(Boolean)
        : [],
      history: Array.isArray(response.data?.history)
        ? response.data.history.map(normalizeHistoryItem).filter(Boolean)
        : [],
    }
  } catch (error) {
    throw normalizeApiError(error, 'Failed to load incident details')
  }
}

async function runIncidentAction(incidentId, actionPath, payload = {}, fallbackMessage) {
  try {
    const response = await userRequest.post(`/police/incidents/${incidentId}/${actionPath}`, payload)
    return {
      incident: normalizeIncident(response.data?.incident),
      nearbyIncidents: Array.isArray(response.data?.nearbyIncidents)
        ? response.data.nearbyIncidents.map(normalizeIncident).filter(Boolean)
        : [],
      history: Array.isArray(response.data?.history)
        ? response.data.history.map(normalizeHistoryItem).filter(Boolean)
        : [],
    }
  } catch (error) {
    throw normalizeApiError(error, fallbackMessage)
  }
}

export function verifyPoliceIncident(incidentId, payload = {}) {
  return runIncidentAction(incidentId, 'verify', payload, 'Failed to verify incident')
}

export function rejectPoliceIncident(incidentId, payload = {}) {
  return runIncidentAction(incidentId, 'reject', payload, 'Failed to reject incident')
}

export function requestPoliceBackup(incidentId, payload = {}) {
  return runIncidentAction(incidentId, 'request-backup', payload, 'Failed to request backup')
}

export function assignSelfToPoliceIncident(incidentId, payload = {}) {
  return runIncidentAction(incidentId, 'assign-self', payload, 'Failed to assign incident')
}

export function updatePoliceIncidentStatus(incidentId, payload = {}) {
  return runIncidentAction(incidentId, 'status', payload, 'Failed to update status')
}

export function addPoliceFieldNote(incidentId, payload = {}) {
  return runIncidentAction(incidentId, 'field-note', payload, 'Failed to add field note')
}

export async function listPoliceAlerts(params = {}) {
  try {
    const response = await userRequest.get('/police/alerts', {
      params: {
        page: params.page,
        pageSize: params.pageSize,
      },
    })

    return {
      items: Array.isArray(response.data?.items)
        ? response.data.items.map(normalizeAlert).filter(Boolean)
        : [],
      unreadCount: Number(response.data?.unreadCount || 0),
      pagination: normalizePagination(response.data?.pagination, params),
    }
  } catch (error) {
    throw normalizeApiError(error, 'Failed to load alerts')
  }
}

export async function markPoliceAlertRead(alertId) {
  try {
    const response = await userRequest.patch(`/police/alerts/${alertId}/read`)
    return {
      alert: normalizeAlert(response.data?.alert),
      notification: response.data?.notification || null,
    }
  } catch (error) {
    throw normalizeApiError(error, 'Failed to mark alert as read')
  }
}

export async function listPoliceOperationHistory(params = {}) {
  try {
    const response = await userRequest.get('/police/operation-history', {
      params,
    })

    return {
      items: Array.isArray(response.data?.items)
        ? response.data.items.map(normalizeHistoryItem).filter(Boolean)
        : [],
      pagination: normalizePagination(response.data?.pagination, params),
    }
  } catch (error) {
    throw normalizeApiError(error, 'Failed to load operation history')
  }
}

export async function createManualPoliceHistoryEntry(payload = {}) {
  try {
    const response = await userRequest.post('/police/operation-history/manual', payload)
    return {
      item: normalizeHistoryItem(response.data?.item),
    }
  } catch (error) {
    throw normalizeApiError(error, 'Failed to add manual history entry')
  }
}

import { userRequest } from '../requestMethodes'

const DEFAULT_PERIOD = '24h'
const DEFAULT_METRIC = 'composite'
const ALLOWED_PERIODS = new Set(['24h', '7d', '30d'])
const ALLOWED_METRICS = new Set(['composite', 'model', 'reports', 'alerts'])

function normalizeApiError(error, fallbackMessage) {
  return new Error(
    error?.response?.data?.message
      || error?.response?.data?.error
      || error?.message
      || fallbackMessage,
  )
}

function ensureNumber(value, fallback = 0) {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : fallback
}

function ensureNullableNumber(value, digits = 2) {
  if (value == null || value === '') {
    return null
  }

  const numeric = Number(value)
  if (!Number.isFinite(numeric)) {
    return null
  }

  return Number(numeric.toFixed(digits))
}

function normalizePoint(point) {
  if (!point || typeof point !== 'object') {
    return null
  }

  const lat = Number(point.lat)
  const lng = Number(point.lng)
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null
  }

  return { lat, lng }
}

function normalizeGeometry(geometry) {
  return geometry && typeof geometry === 'object' ? geometry : null
}

function normalizeZoneItem(item, feature = null) {
  return {
    adminAreaId: ensureNumber(item?.adminAreaId || feature?.properties?.adminAreaId, 0),
    name: item?.name || feature?.properties?.name || 'Unknown zone',
    level: item?.level || feature?.properties?.level || 'wilaya',
    riskScore: ensureNumber(item?.riskScore || feature?.properties?.riskScore, 0),
    riskLevel: ['low', 'medium', 'high', 'critical'].includes(item?.riskLevel || feature?.properties?.riskLevel)
      ? (item?.riskLevel || feature?.properties?.riskLevel)
      : 'low',
    modelWeightedScore: ensureNullableNumber(item?.modelWeightedScore || feature?.properties?.modelWeightedScore),
    modelAvgScore: ensureNullableNumber(item?.modelAvgScore || feature?.properties?.modelAvgScore),
    topRoadRiskScore: ensureNullableNumber(item?.topRoadRiskScore || feature?.properties?.topRoadRiskScore || feature?.properties?.topRoadRiskScoreValue),
    recentReportCount: ensureNumber(item?.recentReportCount || feature?.properties?.recentReportCount, 0),
    verifiedReportCount: ensureNumber(item?.verifiedReportCount || feature?.properties?.verifiedReportCount, 0),
    pendingReportCount: ensureNumber(item?.pendingReportCount || feature?.properties?.pendingReportCount, 0),
    flaggedReportCount: ensureNumber(item?.flaggedReportCount || feature?.properties?.flaggedReportCount, 0),
    reportScore: ensureNullableNumber(item?.reportScore || feature?.properties?.reportScore),
    activeAlertCount: ensureNumber(item?.activeAlertCount || feature?.properties?.activeAlertCount, 0),
    scheduledAlertCount: ensureNumber(item?.scheduledAlertCount || feature?.properties?.scheduledAlertCount, 0),
    criticalAlertCount: ensureNumber(item?.criticalAlertCount || feature?.properties?.criticalAlertCount, 0),
    alertScore: ensureNullableNumber(item?.alertScore || feature?.properties?.alertScore),
    confidenceAvg: ensureNullableNumber(item?.confidenceAvg || feature?.properties?.confidenceAvg),
    trendVsPrevious: ensureNullableNumber(item?.trendVsPrevious || feature?.properties?.trendVsPrevious),
    topRoadName: item?.topRoadName || feature?.properties?.topRoadName || null,
    centroid: normalizePoint(item?.centroid || feature?.properties?.centroid),
    geometry: normalizeGeometry(item?.geometry || feature?.geometry),
    metricScore: ensureNumber(item?.metricScore || feature?.properties?.metricScore, 0),
    snapshotAt: item?.snapshotAt || feature?.properties?.snapshotAt || null,
  }
}

function normalizeZoneFeature(feature) {
  const normalizedFeature = feature && typeof feature === 'object' ? feature : {}
  const item = normalizeZoneItem(normalizedFeature.properties, normalizedFeature)

  return {
    type: 'Feature',
    geometry: item.geometry,
    properties: item,
  }
}

function normalizeTopRoad(item) {
  return {
    roadSegmentId: ensureNumber(item?.roadSegmentId, 0),
    roadName: item?.roadName || 'Unknown road',
    roadClass: item?.roadClass || null,
    roadWeight: ensureNumber(item?.roadWeight, 1),
    riskScore: ensureNullableNumber(item?.riskScore),
    confidenceAvg: ensureNullableNumber(item?.confidenceAvg),
  }
}

function normalizeRecentReport(item) {
  return {
    reportId: item?.reportId || '',
    displayId: item?.displayId || 'INC-UNKNOWN',
    incidentType: item?.incidentType || 'incident',
    status: item?.status || 'pending',
    severity: ['low', 'medium', 'high'].includes(item?.severity) ? item.severity : 'low',
    location: item?.location || 'Unknown location',
    occurredAt: item?.occurredAt || null,
    createdAt: item?.createdAt || null,
  }
}

function normalizeOperationalAlert(item) {
  return {
    id: item?.id || '',
    title: item?.title || 'Operational alert',
    severity: ['low', 'medium', 'high', 'critical'].includes(item?.severity) ? item.severity : 'low',
    status: ['active', 'scheduled', 'expired', 'cancelled'].includes(item?.status) ? item.status : 'expired',
    startsAt: item?.startsAt || null,
    endsAt: item?.endsAt || null,
  }
}

export function normalizeZonePeriod(period) {
  const normalized = String(period || '').trim().toLowerCase()
  return ALLOWED_PERIODS.has(normalized) ? normalized : DEFAULT_PERIOD
}

export function normalizeZoneMetric(metric) {
  const normalized = String(metric || '').trim().toLowerCase()
  return ALLOWED_METRICS.has(normalized) ? normalized : DEFAULT_METRIC
}

export async function fetchAdminZoneMap(period = DEFAULT_PERIOD, metric = DEFAULT_METRIC, options = {}) {
  try {
    const response = await userRequest.get('/admin/zones/map', {
      params: {
        period: normalizeZonePeriod(period),
        metric: normalizeZoneMetric(metric),
      },
      signal: options.signal,
    })

    const featureCollection = response.data?.featureCollection && typeof response.data.featureCollection === 'object'
      ? {
        type: 'FeatureCollection',
        features: Array.isArray(response.data.featureCollection.features)
          ? response.data.featureCollection.features.map(normalizeZoneFeature).filter((feature) => feature.geometry)
          : [],
      }
      : { type: 'FeatureCollection', features: [] }

    return {
      period: normalizeZonePeriod(response.data?.period),
      metric: normalizeZoneMetric(response.data?.metric),
      generatedAt: response.data?.generatedAt || null,
      summarySource: response.data?.summarySource || 'ml.zone_risk_summary_current',
      summaryRebuilt: Boolean(response.data?.summaryRebuilt),
      featureCollection,
      items: Array.isArray(response.data?.items)
        ? response.data.items.map((item) => normalizeZoneItem(item))
        : featureCollection.features.map((feature) => feature.properties),
      stats: {
        zoneCount: ensureNumber(response.data?.stats?.zoneCount, featureCollection.features.length),
        critical: ensureNumber(response.data?.stats?.critical, 0),
        high: ensureNumber(response.data?.stats?.high, 0),
        medium: ensureNumber(response.data?.stats?.medium, 0),
        low: ensureNumber(response.data?.stats?.low, 0),
      },
    }
  } catch (error) {
    throw normalizeApiError(error, 'Failed to load zone map')
  }
}

export async function fetchAdminZoneDetails(adminAreaId, period = DEFAULT_PERIOD, options = {}) {
  try {
    const response = await userRequest.get(`/admin/zones/${adminAreaId}/details`, {
      params: {
        period: normalizeZonePeriod(period),
      },
      signal: options.signal,
    })

    return {
      period: normalizeZonePeriod(response.data?.period),
      generatedAt: response.data?.generatedAt || null,
      summary: normalizeZoneItem(response.data?.summary),
      topRoads: Array.isArray(response.data?.topRoads) ? response.data.topRoads.map(normalizeTopRoad) : [],
      recentReportsSummary: {
        total: ensureNumber(response.data?.recentReportsSummary?.total, 0),
        verified: ensureNumber(response.data?.recentReportsSummary?.verified, 0),
        pending: ensureNumber(response.data?.recentReportsSummary?.pending, 0),
        flagged: ensureNumber(response.data?.recentReportsSummary?.flagged, 0),
        items: Array.isArray(response.data?.recentReportsSummary?.items)
          ? response.data.recentReportsSummary.items.map(normalizeRecentReport)
          : [],
      },
      operationalAlertsSummary: {
        active: ensureNumber(response.data?.operationalAlertsSummary?.active, 0),
        scheduled: ensureNumber(response.data?.operationalAlertsSummary?.scheduled, 0),
        critical: ensureNumber(response.data?.operationalAlertsSummary?.critical, 0),
        items: Array.isArray(response.data?.operationalAlertsSummary?.items)
          ? response.data.operationalAlertsSummary.items.map(normalizeOperationalAlert)
          : [],
      },
    }
  } catch (error) {
    throw normalizeApiError(error, 'Failed to load zone details')
  }
}

export async function rebuildAdminZoneSummary(period = DEFAULT_PERIOD) {
  try {
    const response = await userRequest.post('/admin/zones/rebuild-summary', {
      period: normalizeZonePeriod(period),
    })

    return {
      period: normalizeZonePeriod(response.data?.period),
      snapshotAt: response.data?.snapshotAt || null,
      zoneCount: ensureNumber(response.data?.zoneCount, 0),
    }
  } catch (error) {
    throw normalizeApiError(error, 'Failed to rebuild zone summary')
  }
}

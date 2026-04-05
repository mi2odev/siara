import { userRequest } from '../requestMethodes'

const DEFAULT_RANGE = '24h'
const ALLOWED_RANGES = new Set(['1h', '24h', '7d', '30d'])
const DEFAULT_WEEKLY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const ALLOWED_CONFIDENCE_STATUSES = new Set(['completed', 'pending', 'failed'])
const ALLOWED_ML_STATUSES = new Set([
  'waiting_for_text',
  'waiting_for_image',
  'processing',
  'completed',
  'failed',
])
const ALLOWED_PREDICTED_LABELS = new Set(['spam', 'real'])

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

function ensureNullableNumber(value, digits = null) {
  if (value == null || value === '') {
    return null
  }

  const numeric = Number(value)
  if (!Number.isFinite(numeric)) {
    return null
  }

  if (digits == null) {
    return numeric
  }

  return Number(numeric.toFixed(digits))
}

function ensureNullableText(value) {
  const normalized = String(value || '').trim()
  return normalized || null
}

function normalizeConfidenceStatus(value) {
  const normalized = String(value || '').trim().toLowerCase()
  return ALLOWED_CONFIDENCE_STATUSES.has(normalized) ? normalized : null
}

function normalizeMlStatus(value) {
  const normalized = String(value || '').trim().toLowerCase()
  return ALLOWED_ML_STATUSES.has(normalized) ? normalized : null
}

function normalizePredictedLabel(value) {
  const normalized = String(value || '').trim().toLowerCase()
  return ALLOWED_PREDICTED_LABELS.has(normalized) ? normalized : null
}

function normalizeReviewQueueItem(item) {
  const predictedLabel = normalizePredictedLabel(item?.predictedLabel)
  const reviewVerdict = ensureNullableText(item?.reviewVerdict)

  return {
    displayId: item?.displayId || 'INC-UNKNOWN',
    reportId: item?.reportId || '',
    location: item?.location || 'Unknown location',
    severity: ['high', 'medium', 'low'].includes(item?.severity) ? item.severity : 'low',
    confidence: ensureNullableNumber(item?.confidence, 0),
    confidenceStatus: normalizeConfidenceStatus(item?.confidenceStatus),
    mlStatus: normalizeMlStatus(item?.mlStatus),
    predictedLabel,
    spamScore: ensureNullableNumber(item?.spamScore, 2),
    mlConfidence: ensureNullableNumber(item?.mlConfidence, 2),
    modelVersion: ensureNullableText(item?.modelVersion),
    classifiedAt: item?.classifiedAt || null,
    reviewVerdict,
    pendingSpamReview: Boolean(item?.pendingSpamReview ?? (predictedLabel === 'spam' && !reviewVerdict)),
    status: item?.status || 'pending',
    reporterScore: ensureNullableNumber(item?.reporterScore, 2),
    ago: item?.ago || '\u2014',
    createdAt: item?.createdAt || null,
  }
}

function normalizeCriticalAlert(item) {
  return {
    type: item?.type || 'queue',
    text: item?.text || '',
    count: ensureNumber(item?.count, 0),
    action: item?.action || 'Open',
    route: item?.route || '/admin/overview',
  }
}

function normalizeZone(item, index) {
  return {
    zone: item?.zone || `Zone ${index + 1}`,
    incidents: ensureNumber(item?.incidents, 0),
    risk: item?.risk === 'high' ? 'high' : 'medium',
  }
}

export function normalizeRange(range) {
  const normalized = String(range || '').trim().toLowerCase()
  return ALLOWED_RANGES.has(normalized) ? normalized : DEFAULT_RANGE
}

export function normalizeOverviewResponse(data) {
  const weeklyByLabel = new Map(
    (Array.isArray(data?.weeklyVolume) ? data.weeklyVolume : []).map((entry) => [
      entry?.label,
      {
        label: entry?.label,
        count: ensureNumber(entry?.count, 0),
      },
    ]),
  )

  return {
    criticalAlerts: Array.isArray(data?.criticalAlerts)
      ? data.criticalAlerts.map(normalizeCriticalAlert).filter((alert) => alert.text)
      : [],
    kpis: {
      incidents: {
        value: ensureNumber(data?.kpis?.incidents?.value, 0),
        trend: data?.kpis?.incidents?.trend ?? null,
      },
      pendingReview: {
        value: ensureNumber(data?.kpis?.pendingReview?.value, 0),
        trend: data?.kpis?.pendingReview?.trend ?? null,
      },
      aiConfidence: {
        value: ensureNullableNumber(data?.kpis?.aiConfidence?.value, 1),
        trend: data?.kpis?.aiConfidence?.trend ?? null,
      },
      highRiskZones: {
        value: ensureNumber(data?.kpis?.highRiskZones?.value, 0),
        trend: data?.kpis?.highRiskZones?.trend ?? null,
      },
      activeAlerts: {
        value: ensureNumber(data?.kpis?.activeAlerts?.value, 0),
        trend: data?.kpis?.activeAlerts?.trend ?? null,
      },
      reportsPerMin: {
        value: ensureNullableNumber(data?.kpis?.reportsPerMin?.value, 1) ?? 0,
        trend: data?.kpis?.reportsPerMin?.trend ?? null,
      },
    },
    reviewQueue: Array.isArray(data?.reviewQueue) ? data.reviewQueue.map(normalizeReviewQueueItem) : [],
    weeklyVolume: DEFAULT_WEEKLY_LABELS.map((label) => weeklyByLabel.get(label) || { label, count: 0 }),
    severityDistribution: {
      high: ensureNumber(data?.severityDistribution?.high, 0),
      medium: ensureNumber(data?.severityDistribution?.medium, 0),
      low: ensureNumber(data?.severityDistribution?.low, 0),
    },
    topRiskZones: Array.isArray(data?.topRiskZones) ? data.topRiskZones.map(normalizeZone) : [],
  }
}

export async function fetchAdminOverview(range = DEFAULT_RANGE, options = {}) {
  try {
    const response = await userRequest.get('/admin/overview', {
      params: {
        range: normalizeRange(range),
      },
      signal: options.signal,
    })

    return normalizeOverviewResponse(response.data)
  } catch (error) {
    throw normalizeApiError(error, 'Failed to load admin overview')
  }
}

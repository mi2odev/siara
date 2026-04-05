import { userRequest } from '../requestMethodes'

const DEFAULT_FILTER = 'all'
const DEFAULT_SORT_FIELD = 'spamScore'
const DEFAULT_SORT_DIR = 'desc'
const ALLOWED_FILTERS = new Set([
  'all',
  'pending',
  'suspicious',
  'pending-review',
  'ai-flagged',
  'community',
  'merged',
  'archived',
])
const ALLOWED_SORT_FIELDS = new Set([
  'id',
  'incidentType',
  'location',
  'severity',
  'spamScore',
  'confidence',
  'reporterScore',
  'createdAt',
  'classifiedAt',
  'status',
])
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

function normalizeReporterScore(value) {
  return ensureNullableNumber(value, 2)
}

function normalizeCounts(counts) {
  return {
    all: ensureNumber(counts?.all, 0),
    pending: ensureNumber(counts?.pending, 0),
    suspicious: ensureNumber(counts?.suspicious, 0),
    'pending-review': ensureNumber(counts?.['pending-review'], 0),
    'ai-flagged': ensureNumber(counts?.['ai-flagged'], 0),
    community: ensureNumber(counts?.community, 0),
    merged: ensureNumber(counts?.merged, 0),
    archived: ensureNumber(counts?.archived, 0),
    completedAiReports: ensureNumber(counts?.completedAiReports, 0),
  }
}

function normalizeSpamAnalysis(rawItem) {
  const item = rawItem?.spamAnalysis || rawItem || {}
  const predictedLabel = normalizePredictedLabel(item?.predictedLabel ?? rawItem?.predictedLabel)
  const reviewVerdict = ensureNullableText(item?.reviewVerdict ?? rawItem?.reviewVerdict)
  const status = normalizeMlStatus(item?.status ?? rawItem?.mlStatus)
  const pendingReview = Boolean(
    item?.pendingReview
      ?? rawItem?.pendingSpamReview
      ?? (predictedLabel === 'spam' && !reviewVerdict),
  )

  return {
    status,
    predictedLabel,
    spamScore: ensureNullableNumber(item?.spamScore ?? rawItem?.spamScore, 2),
    confidence: ensureNullableNumber(item?.confidence ?? rawItem?.mlConfidence, 2),
    modelVersion: ensureNullableText(item?.modelVersion ?? rawItem?.modelVersion),
    classifiedAt: item?.classifiedAt ?? rawItem?.classifiedAt ?? null,
    reviewVerdict,
    reviewedBy: ensureNullableText(item?.reviewedBy),
    reviewedAt: item?.reviewedAt || null,
    reviewNotes: item?.reviewNotes || '',
    pendingReview,
  }
}

function normalizeIncidentRow(item) {
  const spamAnalysis = normalizeSpamAnalysis(item)
  const reporterScore = normalizeReporterScore(
    item?.reporterScore
      ?? item?.trustScore
      ?? item?.reporter?.reporterScore
      ?? item?.reporter?.trustScore,
  )

  return {
    reportId: item?.reportId || '',
    displayId: item?.displayId || 'INC-UNKNOWN',
    incidentType: item?.incidentType || 'other',
    title: item?.title || '',
    location: item?.location || 'Unknown location',
    severity: ['high', 'medium', 'low'].includes(item?.severity) ? item.severity : 'low',
    severitySource: item?.severitySource === 'ai' ? 'ai' : 'hint',
    confidence: ensureNullableNumber(item?.confidence, 0),
    confidenceStatus: normalizeConfidenceStatus(item?.confidenceStatus),
    mlStatus: spamAnalysis.status,
    predictedLabel: spamAnalysis.predictedLabel,
    spamScore: spamAnalysis.spamScore,
    mlConfidence: spamAnalysis.confidence,
    modelVersion: spamAnalysis.modelVersion,
    classifiedAt: spamAnalysis.classifiedAt,
    reviewVerdict: spamAnalysis.reviewVerdict,
    pendingSpamReview: spamAnalysis.pendingReview,
    reporterScore,
    spamAnalysis,
    createdAt: item?.createdAt || null,
    ago: item?.ago || '\u2014',
    status: item?.status || 'pending',
    openFlagCount: ensureNumber(item?.openFlagCount, 0),
    mergedIntoReportId: item?.mergedIntoReportId || null,
  }
}

function normalizeNearbyReport(item) {
  return {
    reportId: item?.reportId || '',
    displayId: item?.displayId || 'INC-UNKNOWN',
    location: item?.location || 'Unknown location',
    status: item?.status || 'pending',
    severity: ['high', 'medium', 'low'].includes(item?.severity) ? item.severity : 'low',
    distanceKm: ensureNullableNumber(item?.distanceKm, 1),
  }
}

function normalizeFlag(item) {
  return {
    id: item?.id || '',
    reason: item?.reason || 'flagged',
    comment: item?.comment || '',
    status: item?.status || 'open',
    createdAt: item?.createdAt || null,
    resolvedAt: item?.resolvedAt || null,
    flaggedBy: item?.flaggedBy || null,
    open: Boolean(item?.open),
  }
}

function normalizeReviewAction(item) {
  return {
    id: item?.id || '',
    action: item?.action || '',
    fromStatus: item?.fromStatus || null,
    toStatus: item?.toStatus || null,
    note: item?.note || '',
    createdAt: item?.createdAt || null,
    reviewedBy: item?.reviewedBy || 'Admin',
  }
}

function normalizeTimelineEntry(item) {
  return {
    id: item?.id || '',
    time: item?.time || null,
    timeLabel: item?.timeLabel || '--:--',
    event: item?.event || '',
  }
}

function normalizeNote(item) {
  return {
    id: item?.id || '',
    author: item?.author || 'Admin',
    time: item?.time || null,
    text: item?.text || '',
  }
}

function normalizeIncidentDetail(item) {
  const spamAnalysis = normalizeSpamAnalysis(item)
  const reporterScore = normalizeReporterScore(
    item?.reporterScore
      ?? item?.trustScore
      ?? item?.reporter?.reporterScore
      ?? item?.reporter?.trustScore,
  )

  return {
    reportId: item?.reportId || '',
    displayId: item?.displayId || 'INC-UNKNOWN',
    incidentType: item?.incidentType || 'other',
    title: item?.title || '',
    description: item?.description || '',
    location: item?.location || 'Unknown location',
    coordinates: {
      lat: ensureNullableNumber(item?.coordinates?.lat),
      lng: ensureNullableNumber(item?.coordinates?.lng),
    },
    severity: ['high', 'medium', 'low'].includes(item?.severity) ? item.severity : 'low',
    severitySource: item?.severitySource === 'ai' ? 'ai' : 'hint',
    confidence: ensureNullableNumber(item?.confidence, 0),
    confidenceStatus: normalizeConfidenceStatus(item?.confidenceStatus),
    mlStatus: spamAnalysis.status,
    predictedLabel: spamAnalysis.predictedLabel,
    spamScore: spamAnalysis.spamScore,
    mlConfidence: spamAnalysis.confidence,
    modelVersion: spamAnalysis.modelVersion,
    classifiedAt: spamAnalysis.classifiedAt,
    reviewVerdict: spamAnalysis.reviewVerdict,
    pendingSpamReview: spamAnalysis.pendingReview,
    reporterScore,
    spamAnalysis,
    createdAt: item?.createdAt || null,
    occurredAt: item?.occurredAt || null,
    ago: item?.ago || '\u2014',
    status: item?.status || 'pending',
    mergedIntoReportId: item?.mergedIntoReportId || null,
    mergedAt: item?.mergedAt || null,
    mergeReason: item?.mergeReason || '',
    openFlagCount: ensureNumber(item?.openFlagCount, 0),
    reporter: {
      id: item?.reporter?.id || null,
      name: item?.reporter?.name || 'Unknown reporter',
      email: item?.reporter?.email || null,
      totalReports: ensureNumber(item?.reporter?.totalReports, 0),
      joinedAt: item?.reporter?.joinedAt || null,
      reporterScore,
      accuracy: null,
    },
    aiAssessment: {
      status: normalizeConfidenceStatus(item?.aiAssessment?.status),
      confidence: ensureNullableNumber(item?.aiAssessment?.confidence, 0),
      severity: ['high', 'medium', 'low'].includes(item?.aiAssessment?.severity) ? item.aiAssessment.severity : null,
      assessedAt: item?.aiAssessment?.assessedAt || null,
      modelVersionId: item?.aiAssessment?.modelVersionId || null,
    },
    media: Array.isArray(item?.media) ? item.media.map((mediaItem) => ({
      id: mediaItem?.id || '',
      mediaType: mediaItem?.mediaType || 'image',
      url: mediaItem?.url || '',
      uploadedAt: mediaItem?.uploadedAt || null,
    })) : [],
    nearbyReports: Array.isArray(item?.nearbyReports) ? item.nearbyReports.map(normalizeNearbyReport) : [],
    flags: Array.isArray(item?.flags) ? item.flags.map(normalizeFlag) : [],
    reviewActions: Array.isArray(item?.reviewActions) ? item.reviewActions.map(normalizeReviewAction) : [],
    timeline: Array.isArray(item?.timeline) ? item.timeline.map(normalizeTimelineEntry) : [],
    notes: Array.isArray(item?.notes) ? item.notes.map(normalizeNote) : [],
  }
}

export function normalizeIncidentFilter(filter) {
  const normalized = String(filter || '').trim().toLowerCase()
  return ALLOWED_FILTERS.has(normalized) ? normalized : DEFAULT_FILTER
}

export function normalizeIncidentSortField(sortField) {
  return ALLOWED_SORT_FIELDS.has(sortField) ? sortField : DEFAULT_SORT_FIELD
}

export function normalizeIncidentSortDir(sortDir) {
  const normalized = String(sortDir || '').trim().toLowerCase()
  return normalized === 'asc' ? 'asc' : DEFAULT_SORT_DIR
}

export async function fetchAdminIncidents(params = {}, options = {}) {
  try {
    const response = await userRequest.get('/admin/incidents', {
      params: {
        filter: normalizeIncidentFilter(params.filter),
        search: params.search || '',
        sortField: normalizeIncidentSortField(params.sortField),
        sortDir: normalizeIncidentSortDir(params.sortDir),
        limit: Number.isInteger(params.limit) ? params.limit : undefined,
        offset: Number.isInteger(params.offset) ? params.offset : undefined,
      },
      signal: options.signal,
    })

    return {
      incidents: Array.isArray(response.data?.incidents)
        ? response.data.incidents.map(normalizeIncidentRow)
        : [],
      counts: normalizeCounts(response.data?.counts),
      meta: {
        filter: normalizeIncidentFilter(response.data?.meta?.filter || params.filter),
        search: response.data?.meta?.search || '',
        sortField: normalizeIncidentSortField(response.data?.meta?.sortField || params.sortField),
        sortDir: normalizeIncidentSortDir(response.data?.meta?.sortDir || params.sortDir),
        returned: ensureNumber(response.data?.meta?.returned, 0),
        completedAiReports: ensureNumber(response.data?.meta?.completedAiReports, 0),
      },
    }
  } catch (error) {
    throw normalizeApiError(error, 'Failed to load admin incidents')
  }
}

export async function fetchAdminIncidentCounts(options = {}) {
  const payload = await fetchAdminIncidents({ limit: 0 }, options)
  return payload.counts
}

export async function fetchAdminIncident(reportId, options = {}) {
  try {
    const response = await userRequest.get(`/admin/incidents/${reportId}`, {
      signal: options.signal,
    })

    return normalizeIncidentDetail(response.data?.incident)
  } catch (error) {
    throw normalizeApiError(error, 'Failed to load incident details')
  }
}

export async function submitAdminIncidentAction(reportId, payload) {
  try {
    const response = await userRequest.post(`/admin/incidents/${reportId}/actions`, {
      action: payload?.action,
      note: payload?.note || null,
      severity: payload?.severity || null,
      mergeTargetReportId: payload?.mergeTargetReportId || null,
    })

    return normalizeIncidentDetail(response.data?.incident)
  } catch (error) {
    throw normalizeApiError(error, 'Failed to submit incident action')
  }
}

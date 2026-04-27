import { API_ORIGIN, publicRequest, userRequest } from '../requestMethodes'

function normalizeApiError(error, fallbackMessage) {
  return new Error(
    error?.response?.data?.message
      || error?.response?.data?.error
      || error?.message
      || fallbackMessage,
  )
}

function tryParseJson(value) {
  if (typeof value !== 'string') {
    return null
  }

  const trimmed = value.trim()
  if (!trimmed || (trimmed[0] !== '{' && trimmed[0] !== '[' && trimmed[0] !== '"')) {
    return null
  }

  try {
    return JSON.parse(trimmed)
  } catch {
    return null
  }
}

export function extractMediaUrlCandidate(value) {
  if (!value) {
    return ''
  }

  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) {
      return ''
    }

    const parsed = tryParseJson(trimmed)
    if (parsed != null) {
      return extractMediaUrlCandidate(parsed)
    }

    return trimmed
  }

  if (typeof value === 'object') {
    const candidate =
      value.url
      || value.secure_url
      || value.secureUrl
      || value.media_url
      || value.mediaUrl
      || value.path
      || ''

    return extractMediaUrlCandidate(candidate)
  }

  return ''
}

export function normalizeReportMediaUrl(value) {
  const candidate = extractMediaUrlCandidate(value)
  if (!candidate) {
    return ''
  }

  if (/^https?:\/\//i.test(candidate) || /^data:/i.test(candidate) || /^blob:/i.test(candidate)) {
    return candidate
  }

  if (candidate.startsWith('//')) {
    return `https:${candidate}`
  }

  const normalizedPath = candidate.replace(/\\/g, '/')

  if (normalizedPath.startsWith('local:')) {
    const relativePath = normalizedPath.slice('local:'.length).replace(/^\/+/, '')
    return `${API_ORIGIN}/uploads/${relativePath}`
  }

  if (normalizedPath.startsWith('/api/uploads/')) {
    return `${API_ORIGIN}${normalizedPath.slice('/api'.length)}`
  }

  if (normalizedPath.startsWith('api/uploads/')) {
    return `${API_ORIGIN}/${normalizedPath.slice('api/'.length)}`
  }

  const uploadsIndex = normalizedPath.toLowerCase().indexOf('/uploads/')
  if (uploadsIndex >= 0) {
    return `${API_ORIGIN}${normalizedPath.slice(uploadsIndex)}`
  }

  if (normalizedPath.startsWith('/uploads/')) {
    return `${API_ORIGIN}${normalizedPath}`
  }

  if (normalizedPath.startsWith('uploads/')) {
    return `${API_ORIGIN}/${normalizedPath}`
  }

  return normalizedPath
}

function normalizeMediaItem(mediaItem) {
  if (!mediaItem) {
    return null
  }

  if (typeof mediaItem === 'string') {
    const url = normalizeReportMediaUrl(mediaItem)
    return url ? { mediaType: 'image', url } : null
  }

  const url = normalizeReportMediaUrl(mediaItem)
  if (!url) {
    return null
  }

  return {
    ...mediaItem,
    url,
    mediaUrl: url,
    secureUrl: mediaItem.secureUrl || mediaItem.secure_url || url,
  }
}

function normalizeReportedBy(reportedBy) {
  if (!reportedBy || typeof reportedBy !== 'object') {
    return null
  }

  const avatarUrl = normalizeReportMediaUrl(
    reportedBy.avatarUrl
      || reportedBy.avatar_url
      || reportedBy.avatar
      || reportedBy.photoUrl
      || reportedBy.photo_url,
  )

  return {
    ...reportedBy,
    avatarUrl,
    avatar_url: avatarUrl,
  }
}

function normalizeReport(report) {
  if (!report || typeof report !== 'object') {
    return null
  }

  const media = Array.isArray(report.media)
    ? report.media.map(normalizeMediaItem).filter(Boolean)
    : []

  const reportedBy = normalizeReportedBy(report.reportedBy || report.reported_by)

  return {
    ...report,
    media,
    reportedBy,
    reported_by: reportedBy,
  }
}

function buildReportPayload(data) {
  return {
    incidentType: data.incidentType,
    title: data.title,
    description: data.description || '',
    severity: data.severity,
    occurredAt: data.occurredAt,
    status: data.status,
    location: {
      lat: data.location?.lat,
      lng: data.location?.lng,
      label: data.location?.label || '',
    },
  }
}

export async function createReport(data) {
  try {
    const response = await userRequest.post('/reports', buildReportPayload(data))
    return normalizeReport(response.data?.report)
  } catch (error) {
    throw normalizeApiError(error, 'Failed to create report')
  }
}

export async function getReport(reportId) {
  try {
    const response = await publicRequest.get(`/reports/${reportId}`)
    return normalizeReport(response.data?.report)
  } catch (error) {
    throw normalizeApiError(error, 'Failed to load report')
  }
}

export async function updateReport(reportId, data) {
  try {
    const response = await userRequest.put(`/reports/${reportId}`, buildReportPayload(data))
    return normalizeReport(response.data?.report)
  } catch (error) {
    throw normalizeApiError(error, 'Failed to update report')
  }
}

export async function deleteReport(reportId) {
  try {
    const response = await userRequest.delete(`/reports/${reportId}`)
    return response.data
  } catch (error) {
    throw normalizeApiError(error, 'Failed to delete report')
  }
}

export async function uploadReportMedia(reportId, files) {
  try {
    const formData = new FormData()

    files.forEach((file) => {
      formData.append('images', file)
    })

    const response = await userRequest.post(`/reports/${reportId}/media`, formData)
    return normalizeReport(response.data?.report)
  } catch (error) {
    throw normalizeApiError(error, 'Failed to upload report images')
  }
}

function normalizeAuthor(author) {
  if (!author || typeof author !== 'object') {
    return null
  }
  const avatarUrl = normalizeReportMediaUrl(
    author.avatarUrl || author.avatar_url || author.avatar || '',
  )
  return {
    ...author,
    avatarUrl,
    avatar_url: avatarUrl,
  }
}

function normalizeComment(comment) {
  if (!comment || typeof comment !== 'object') {
    return null
  }
  return {
    ...comment,
    author: normalizeAuthor(comment.author),
  }
}

export async function getReportComments(reportId, params = {}) {
  try {
    const response = await publicRequest.get(`/reports/${reportId}/comments`, {
      params: {
        limit: params.limit,
        offset: params.offset,
      },
    })
    const comments = Array.isArray(response.data?.comments)
      ? response.data.comments.map(normalizeComment).filter(Boolean)
      : []
    return {
      comments,
      pagination: response.data?.pagination || {
        limit: params.limit || 20,
        offset: params.offset || 0,
        hasMore: false,
        returned: comments.length,
      },
    }
  } catch (error) {
    throw normalizeApiError(error, 'Failed to load comments')
  }
}

export async function addReportComment(reportId, body) {
  try {
    const response = await userRequest.post(`/reports/${reportId}/comments`, { body })
    return normalizeComment(response.data?.comment)
  } catch (error) {
    throw normalizeApiError(error, 'Failed to add comment')
  }
}

export async function deleteReportComment(reportId, commentId) {
  try {
    const response = await userRequest.delete(`/reports/${reportId}/comments/${commentId}`)
    return response.data
  } catch (error) {
    throw normalizeApiError(error, 'Failed to delete comment')
  }
}

export async function toggleReportReaction(reportId, reactionType) {
  try {
    const response = await userRequest.post(`/reports/${reportId}/reactions`, { reactionType })
    return response.data
  } catch (error) {
    throw normalizeApiError(error, 'Failed to update reaction')
  }
}

export async function removeReportReaction(reportId, reactionType) {
  try {
    const response = await userRequest.delete(`/reports/${reportId}/reactions/${reactionType}`)
    return response.data
  } catch (error) {
    throw normalizeApiError(error, 'Failed to remove reaction')
  }
}

export async function listReports(params = {}) {
  try {
    const response = await publicRequest.get('/reports', {
      params: {
        limit: params.limit,
        offset: params.offset,
        feed: params.feed,
        sort: params.sort,
        lat: params.lat,
        lng: params.lng,
        radiusKm: params.radiusKm,
      },
    })

    const normalizedReports = Array.isArray(response.data?.reports)
      ? response.data.reports.map(normalizeReport).filter(Boolean)
      : []

    return {
      reports: normalizedReports,
      pagination: response.data?.pagination || {
        limit: params.limit || 10,
        offset: params.offset || 0,
        hasMore: false,
        returned: 0,
      },
      meta: response.data?.meta || null,
    }
  } catch (error) {
    throw normalizeApiError(error, 'Failed to load reports feed')
  }
}

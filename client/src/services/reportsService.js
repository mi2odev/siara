import { publicRequest, userRequest } from '../requestMethodes'

function normalizeApiError(error, fallbackMessage) {
  return new Error(
    error?.response?.data?.message
      || error?.response?.data?.error
      || error?.message
      || fallbackMessage,
  )
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
    return response.data?.report
  } catch (error) {
    throw normalizeApiError(error, 'Failed to create report')
  }
}

export async function getReport(reportId) {
  try {
    const response = await publicRequest.get(`/reports/${reportId}`)
    return response.data?.report
  } catch (error) {
    throw normalizeApiError(error, 'Failed to load report')
  }
}

export async function updateReport(reportId, data) {
  try {
    const response = await userRequest.put(`/reports/${reportId}`, buildReportPayload(data))
    return response.data?.report
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
    return response.data?.report
  } catch (error) {
    throw normalizeApiError(error, 'Failed to upload report images')
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

    return {
      reports: response.data?.reports || [],
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

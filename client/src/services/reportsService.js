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

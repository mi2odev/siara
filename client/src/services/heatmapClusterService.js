import { publicRequest } from '../requestMethodes'

function normalizeError(error, fallback) {
  return new Error(
    error?.response?.data?.message
      || error?.response?.data?.error
      || error?.message
      || fallback,
  )
}

export async function getHeatmapClusterDetail({ lat, lng, radiusMeters = 250, hours = null, limit = 30 } = {}) {
  try {
    const params = { lat, lng, radiusMeters, limit }
    if (hours != null) params.hours = hours
    const response = await publicRequest.get('/map/report-danger-heatmap/cluster-detail', { params })
    return response.data || null
  } catch (error) {
    throw normalizeError(error, 'Could not load cluster details')
  }
}

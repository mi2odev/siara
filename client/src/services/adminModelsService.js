import { userRequest, API_ORIGIN } from '../requestMethodes'

function normalizeApiError(error, fallbackMessage) {
  return new Error(
    error?.response?.data?.message
      || error?.response?.data?.error
      || error?.message
      || fallbackMessage,
  )
}

export async function getOccurrenceBetaV1Metrics() {
  try {
    const response = await userRequest.get('/admin/models/occurrence-beta-v1')
    const data = response.data || {}

    // Prefer the file served from client/public (Vite serves it directly);
    // fall back to the backend-hosted artifact path if the dev copy is missing.
    const publicUrl = data.calibration_curve_url || null
    const apiUrl = data.calibration_curve_api_url
      ? `${API_ORIGIN}${data.calibration_curve_api_url}`
      : null

    return {
      ...data,
      calibrationCurveUrl: publicUrl || apiUrl,
      calibrationCurveApiUrl: apiUrl,
    }
  } catch (error) {
    throw normalizeApiError(error, 'Failed to load occurrence model metrics')
  }
}

import { publicRequest } from '../requestMethodes'

function normalizeError(error, fallback) {
  return new Error(
    error?.response?.data?.message
      || error?.response?.data?.error
      || error?.message
      || fallback,
  )
}

export async function fetchRouteAlerts(payload) {
  try {
    const response = await publicRequest.post('/navigation/route-alerts', payload)
    return response.data || null
  } catch (error) {
    throw normalizeError(error, 'Could not fetch live route alerts')
  }
}

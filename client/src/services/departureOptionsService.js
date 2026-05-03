import { publicRequest } from '../requestMethodes'

function normalizeError(error, fallback) {
  return new Error(
    error?.response?.data?.message
      || error?.response?.data?.error
      || error?.message
      || fallback,
  )
}

export async function fetchDepartureOptions({ origin, destination, timestamps }) {
  try {
    const response = await publicRequest.post('/risk/route/departure-options', {
      origin,
      destination,
      timestamps,
    })
    return response.data || null
  } catch (error) {
    throw normalizeError(error, 'Could not check safer departure times')
  }
}

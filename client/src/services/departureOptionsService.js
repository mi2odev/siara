import { publicRequest } from '../requestMethodes'

function normalizeError(error, fallback) {
  return new Error(
    error?.response?.data?.message
      || error?.response?.data?.error
      || error?.message
      || fallback,
  )
}

export async function fetchDepartureOptions({
  origin,
  destination,
  timestamps,
  signal,
  maxAlternatives,
}) {
  try {
    const payload = {
      origin,
      destination,
      timestamps,
    }
    if (Number.isFinite(Number(maxAlternatives))) {
      payload.max_alternatives = Number(maxAlternatives)
    }
    const response = await publicRequest.post('/risk/route/departure-options', payload, {
      signal,
    })
    return response.data || null
  } catch (error) {
    if (error?.name === 'CanceledError' || error?.code === 'ERR_CANCELED') {
      throw error
    }
    throw normalizeError(error, 'Could not check safer departure times')
  }
}

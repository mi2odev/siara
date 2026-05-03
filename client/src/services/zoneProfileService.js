import { publicRequest } from '../requestMethodes'

function normalizeError(error, fallback) {
  return new Error(
    error?.response?.data?.message
      || error?.response?.data?.error
      || error?.message
      || fallback,
  )
}

export async function getZoneProfile({ lat, lng, radiusMeters = 500 } = {}) {
  try {
    const response = await publicRequest.get('/zone-profiles', {
      params: { lat, lng, radiusMeters },
    })
    return response.data || null
  } catch (error) {
    throw normalizeError(error, 'Failed to load zone profile')
  }
}

export async function getRoadProfile(roadId, { lat, lng, radiusMeters = 250 } = {}) {
  try {
    const response = await publicRequest.get(`/road-profiles/${encodeURIComponent(roadId)}`, {
      params: { lat, lng, radiusMeters },
    })
    return response.data || null
  } catch (error) {
    throw normalizeError(error, 'Failed to load road profile')
  }
}

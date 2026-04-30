import { userRequest } from '../requestMethodes'

function normalizeError(error, fallback) {
  return new Error(
    error?.response?.data?.message
      || error?.response?.data?.error
      || error?.message
      || fallback,
  )
}

export async function getMyTravelHistory(params = {}) {
  try {
    const response = await userRequest.get('/travel-history/me', {
      params: {
        limit: params.limit || undefined,
        offset: params.offset || undefined,
      },
    })
    return (
      response.data || {
        items: [],
        pagination: { limit: 50, offset: 0, hasMore: false },
      }
    )
  } catch (error) {
    throw normalizeError(error, 'Failed to load travel history')
  }
}

export async function getTravelHistoryDetail(id) {
  try {
    const response = await userRequest.get(`/travel-history/${id}`)
    return response.data || null
  } catch (error) {
    throw normalizeError(error, 'Failed to load trip details')
  }
}

export async function completeTravelHistory(payload) {
  try {
    const response = await userRequest.post('/travel-history/complete', payload)
    return response.data || null
  } catch (error) {
    throw normalizeError(error, 'Failed to save completed trip')
  }
}

export async function updateTravelHistoryRating(id, rating, feedbackText) {
  try {
    const response = await userRequest.patch(`/travel-history/${id}/rating`, {
      rating,
      feedbackText,
    })
    return response.data || null
  } catch (error) {
    throw normalizeError(error, 'Failed to update trip rating')
  }
}

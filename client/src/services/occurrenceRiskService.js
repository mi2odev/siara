import { userRequest } from '../requestMethodes'

function normalizeError(error, fallback) {
  return new Error(
    error?.response?.data?.message
      || error?.response?.data?.error
      || error?.message
      || fallback,
  )
}

export async function predictOccurrenceForSegment(payload) {
  try {
    const response = await userRequest.post('/occurrence-risk/segment', payload)
    return response.data
  } catch (error) {
    throw normalizeError(error, 'Failed to compute occurrence risk')
  }
}

export async function getMyOccurrenceRiskHistory(params = {}) {
  try {
    const response = await userRequest.get('/occurrence-risk/me/history', {
      params: { limit: params.limit, offset: params.offset },
    })
    return response.data
  } catch (error) {
    throw normalizeError(error, 'Failed to load occurrence risk history')
  }
}

export async function getUserOccurrenceRiskForAdmin(userId) {
  try {
    const response = await userRequest.get(`/admin/users/${userId}/occurrence-risk`)
    return response.data
  } catch (error) {
    throw normalizeError(error, 'Failed to load user occurrence risk')
  }
}

export async function getUserOccurrenceRiskForPolice(userId) {
  try {
    const response = await userRequest.get(`/police/users/${userId}/occurrence-risk`)
    return response.data
  } catch (error) {
    throw normalizeError(error, 'Failed to load user occurrence risk')
  }
}

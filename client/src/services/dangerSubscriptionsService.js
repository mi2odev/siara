import { userRequest } from '../requestMethodes'

function normalizeError(error, fallback) {
  return new Error(
    error?.response?.data?.message
      || error?.response?.data?.error
      || error?.message
      || fallback,
  )
}

export async function listMyDangerSubscriptions() {
  try {
    const response = await userRequest.get('/danger-subscriptions')
    return Array.isArray(response.data?.items) ? response.data.items : []
  } catch (error) {
    throw normalizeError(error, 'Failed to load danger subscriptions')
  }
}

export async function createDangerSubscription(payload) {
  try {
    const response = await userRequest.post('/danger-subscriptions', payload)
    return response.data || null
  } catch (error) {
    throw normalizeError(error, 'Failed to create subscription')
  }
}

export async function updateDangerSubscription(id, payload) {
  try {
    const response = await userRequest.patch(`/danger-subscriptions/${id}`, payload)
    return response.data || null
  } catch (error) {
    throw normalizeError(error, 'Failed to update subscription')
  }
}

export async function deleteDangerSubscription(id) {
  try {
    const response = await userRequest.delete(`/danger-subscriptions/${id}`)
    return response.data || null
  } catch (error) {
    throw normalizeError(error, 'Failed to delete subscription')
  }
}

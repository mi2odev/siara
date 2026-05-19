import { userRequest } from '../requestMethodes'

function normalizeError(error, fallback) {
  return new Error(
    error?.response?.data?.error
    || error?.response?.data?.message
    || error?.message
    || fallback,
  )
}

export async function fetchAdminSystemSettings() {
  try {
    const response = await userRequest.get('/admin/system-settings')
    return response.data || null
  } catch (error) {
    throw normalizeError(error, 'Failed to load system settings')
  }
}

/**
 * Save one or more setting keys.
 * @param {Array<{key: string, value: any}>} updates
 */
export async function saveAdminSystemSettings(updates) {
  try {
    const response = await userRequest.patch('/admin/system-settings', { settings: updates })
    return response.data || null
  } catch (error) {
    throw normalizeError(error, 'Failed to save system settings')
  }
}

export async function resetAdminSystemSettings() {
  try {
    const response = await userRequest.post('/admin/system-settings/reset')
    return response.data || null
  } catch (error) {
    throw normalizeError(error, 'Failed to reset system settings')
  }
}

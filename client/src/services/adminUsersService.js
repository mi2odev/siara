import { userRequest } from '../requestMethodes'

function normalizeError(error, fallback) {
  return new Error(
    error?.response?.data?.message
      || error?.response?.data?.error
      || error?.message
      || fallback,
  )
}

export async function fetchAdminUsers(params = {}) {
  try {
    const response = await userRequest.get('/admin/users', {
      params: {
        search: params.search || undefined,
        filter: params.filter || undefined,
        sort: params.sort || undefined,
        limit: params.limit || undefined,
        offset: params.offset || undefined,
      },
    })
    return (
      response.data || {
        users: [],
        counts: {
          all: 0,
          active: 0,
          trusted: 0,
          atRisk: 0,
          banned: 0,
          police: 0,
          supervisor: 0,
          admin: 0,
        },
        pagination: { limit: 20, offset: 0, hasMore: false, total: 0 },
      }
    )
  } catch (error) {
    throw normalizeError(error, 'Failed to load admin users')
  }
}

export async function fetchAdminUserDetails(userId) {
  try {
    const response = await userRequest.get(`/admin/users/${userId}`)
    return response.data?.user || null
  } catch (error) {
    throw normalizeError(error, 'Failed to load user details')
  }
}

/**
 * Update a user's moderation state.
 *
 * @param {string} userId
 * @param {string} status      'active' | 'warned' | 'banned'
 * @param {object} [options]
 * @param {string|null} [options.bannedUntil]  ISO timestamp; null/omitted means
 *                                              permanent ban when status is 'banned'.
 * @param {string} [options.reason]            User-visible reason.
 * @param {string} [options.note]              Private admin note.
 */
export async function updateAdminUserStatus(userId, status, options = {}) {
  try {
    const body = { status }
    if (options && typeof options === 'object') {
      if ('bannedUntil' in options) body.bannedUntil = options.bannedUntil
      if (options.reason) body.reason = options.reason
      if (options.note) body.note = options.note
      if (options.warningReason) body.warningReason = options.warningReason
      if ('warningExpiresAt' in options) body.warningExpiresAt = options.warningExpiresAt
    } else if (typeof options === 'string') {
      // Back-compat: previous signature was updateAdminUserStatus(id, status, note)
      body.note = options
    }
    const response = await userRequest.patch(`/admin/users/${userId}/status`, body)
    return response.data?.user || null
  } catch (error) {
    throw normalizeError(error, 'Failed to update user status')
  }
}

/** User-facing — dismisses the warning banner. Returns the refreshed user. */
export async function acknowledgeMyWarning() {
  try {
    const response = await userRequest.post('/account/warning/acknowledge')
    return response.data?.user || null
  } catch (error) {
    throw normalizeError(error, 'Failed to acknowledge warning')
  }
}

export async function fetchAdminRoles() {
  try {
    const response = await userRequest.get('/admin/users/roles')
    return Array.isArray(response.data?.roles) ? response.data.roles : []
  } catch (error) {
    throw normalizeError(error, 'Failed to load available roles')
  }
}

export async function updateAdminUserRoles(userId, roles) {
  try {
    const response = await userRequest.patch(`/admin/users/${userId}/roles`, {
      roles,
    })
    return response.data?.user || null
  } catch (error) {
    throw normalizeError(error, 'Failed to update user roles')
  }
}

export async function recalculateAdminUserTrust(userId) {
  try {
    const response = await userRequest.post(`/admin/users/${userId}/recalculate-trust`)
    return response.data?.user || null
  } catch (error) {
    throw normalizeError(error, 'Failed to recalculate trust score')
  }
}

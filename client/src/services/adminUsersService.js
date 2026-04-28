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
          suspended: 0,
          banned: 0,
          police: 0,
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

export async function updateAdminUserStatus(userId, status, note) {
  try {
    const response = await userRequest.patch(`/admin/users/${userId}/status`, {
      status,
      note,
    })
    return response.data?.user || null
  } catch (error) {
    throw normalizeError(error, 'Failed to update user status')
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

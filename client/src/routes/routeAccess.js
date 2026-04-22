export const ADMIN_LANDING_PATH = '/admin/overview'
export const POLICE_LANDING_PATH = '/police'
export const USER_LANDING_PATH = '/dashboard'

export function isAdminUser(user) {
  if (!user || typeof user !== 'object') {
    return false
  }

  if (Array.isArray(user.roles)) {
    return user.roles.includes('admin')
  }

  return user.role === 'admin'
}

export function isPoliceUser(user) {
  if (!user || typeof user !== 'object') {
    return false
  }

  const roles = Array.isArray(user.roles) ? user.roles : [user.role]
  return roles
    .map((entry) => String(entry || '').trim().toLowerCase().replace(/[\s_-]+/g, ''))
    .some((entry) => entry === 'police' || entry === 'policeofficer')
}

export function buildVerifyEmailRedirect(user) {
  const params = new URLSearchParams()

  if (user?.email) {
    params.set('email', user.email)
  }

  const search = params.toString()
  return `/verify-email${search ? `?${search}` : ''}`
}

export function getAuthenticatedRedirect(user, isEmailVerified = true) {
  if (!isEmailVerified) {
    return buildVerifyEmailRedirect(user)
  }

  if (isAdminUser(user)) {
    return ADMIN_LANDING_PATH
  }

  if (isPoliceUser(user)) {
    return POLICE_LANDING_PATH
  }

  return USER_LANDING_PATH
}

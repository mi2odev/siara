export const ADMIN_LANDING_PATH = '/admin/overview'
export const SUPERVISOR_LANDING_PATH = '/police/supervisor'
export const POLICE_LANDING_PATH = '/police'
export const EMERGENCY_LANDING_PATH = '/emergency'
export const USER_LANDING_PATH = '/dashboard'

export function isAdminUser(user) {
  return normalizeRoles(user).some((entry) => entry === 'admin')
}

function normalizeRoles(user) {
  if (!user || typeof user !== 'object') return []
  const roles = Array.isArray(user.roles) ? user.roles : [user.role]
  return roles
    .map((entry) => {
      if (entry && typeof entry === 'object') {
        return entry.name || entry.role || entry.slug || ''
      }
      return entry
    })
    .map((entry) => String(entry || '').trim().toLowerCase().replace(/[\s_-]+/g, ''))
    .filter(Boolean)
}

export function isPoliceUser(user) {
  return normalizeRoles(user).some((entry) => entry === 'police' || entry === 'policeofficer')
}

export function isSupervisorUser(user) {
  return normalizeRoles(user).some((entry) => entry === 'policesupervisor')
}

export function isEmergencyUser(user) {
  return normalizeRoles(user).some((entry) => entry === 'emergencyservice' || entry === 'emergency')
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

  if (isSupervisorUser(user)) {
    return SUPERVISOR_LANDING_PATH
  }

  if (isPoliceUser(user)) {
    return POLICE_LANDING_PATH
  }

  if (isEmergencyUser(user)) {
    return EMERGENCY_LANDING_PATH
  }

  return USER_LANDING_PATH
}

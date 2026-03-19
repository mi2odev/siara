export const ADMIN_LANDING_PATH = '/admin/overview'
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

  return isAdminUser(user) ? ADMIN_LANDING_PATH : USER_LANDING_PATH
}

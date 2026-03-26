function normalizeRole(role) {
  return String(role || '')
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, '')
}

const ROLE_ID_MAP = {
  1: 'admin',
  2: 'police',
  3: 'plumber',
  4: 'citizen',
}

function toKnownRoleFromId(value) {
  const numeric = Number(value)
  if (!Number.isInteger(numeric)) {
    return ''
  }

  return ROLE_ID_MAP[numeric] || ''
}

export function getUserRoles(user) {
  if (!user || typeof user !== 'object') {
    return []
  }

  const roleCandidates = []

  if (Array.isArray(user.roles)) {
    user.roles.forEach((entry) => {
      if (entry && typeof entry === 'object') {
        roleCandidates.push(entry.name, entry.role, entry.slug)
        roleCandidates.push(toKnownRoleFromId(entry.id), toKnownRoleFromId(entry.role_id), toKnownRoleFromId(entry.roleId))
      } else {
        roleCandidates.push(entry)
      }
    })
  }

  roleCandidates.push(user.role, user.roleName, user.role_name)
  roleCandidates.push(toKnownRoleFromId(user.roleId), toKnownRoleFromId(user.role_id), toKnownRoleFromId(user.roleid))

  const normalized = roleCandidates
    .map(normalizeRole)
    .filter(Boolean)

  return [...new Set(normalized)]
}

export function isPoliceOfficerUser(user) {
  const normalizedRoles = getUserRoles(user)
  return normalizedRoles.includes('police') || normalizedRoles.includes('policeofficer')
}

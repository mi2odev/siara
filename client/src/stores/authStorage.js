const USER_STORAGE_KEY = 'siara_user'
const TOKEN_STORAGE_KEY = 'accessToken'

function hasWindow() {
  return typeof window !== 'undefined'
}

function getStorageEntries() {
  if (!hasWindow()) {
    return []
  }

  return [
    { mode: 'local', storage: window.localStorage },
    { mode: 'session', storage: window.sessionStorage },
  ]
}

function getStorageByMode(mode) {
  return getStorageEntries().find((entry) => entry.mode === mode)?.storage || null
}

export function normalizeAuthUser(rawUser, persistMode = 'session') {
  if (!rawUser || typeof rawUser !== 'object') {
    return null
  }

  const roles = Array.isArray(rawUser.roles)
    ? rawUser.roles
    : rawUser.role
      ? [rawUser.role]
      : []
  const role = roles.includes('admin') ? 'admin' : roles[0] || rawUser.role || 'citizen'
  const name = rawUser.name
    || [rawUser.first_name, rawUser.last_name].filter(Boolean).join(' ')
    || rawUser.email
    || rawUser.phone
    || 'User'

  return {
    ...rawUser,
    roles,
    role,
    name,
    _persist: persistMode || rawUser._persist || 'session',
  }
}

export function clearPersistedSession() {
  getStorageEntries().forEach(({ storage }) => {
    storage.removeItem(USER_STORAGE_KEY)
    storage.removeItem(TOKEN_STORAGE_KEY)
  })
}

export function persistSession({ user, token, persistMode = 'session' }) {
  const normalizedUser = normalizeAuthUser({ ...user, token }, persistMode)
  const storage = getStorageByMode(persistMode)

  clearPersistedSession()

  if (!storage || !normalizedUser) {
    return normalizedUser
  }

  storage.setItem(USER_STORAGE_KEY, JSON.stringify(normalizedUser))

  if (token) {
    storage.setItem(TOKEN_STORAGE_KEY, token)
  }

  return normalizedUser
}

export function readPersistedSession() {
  for (const { mode, storage } of getStorageEntries()) {
    const storedUser = storage.getItem(USER_STORAGE_KEY)
    const storedToken = storage.getItem(TOKEN_STORAGE_KEY)

    if (!storedUser && !storedToken) {
      continue
    }

    try {
      const parsedUser = storedUser ? JSON.parse(storedUser) : null
      const token = storedToken || parsedUser?.token || null

      if (!parsedUser || !token) {
        continue
      }

      return {
        user: normalizeAuthUser(parsedUser, mode),
        token,
        persistMode: mode,
      }
    } catch {
      storage.removeItem(USER_STORAGE_KEY)
      storage.removeItem(TOKEN_STORAGE_KEY)
    }
  }

  return null
}

export function getStoredAccessToken() {
  return readPersistedSession()?.token || null
}

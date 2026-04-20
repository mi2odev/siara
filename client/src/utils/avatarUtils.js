import { API_ORIGIN } from '../requestMethodes'

function tryParseJson(value) {
  if (typeof value !== 'string') {
    return null
  }

  const trimmed = value.trim()
  if (!trimmed || (trimmed[0] !== '{' && trimmed[0] !== '[' && trimmed[0] !== '"')) {
    return null
  }

  try {
    return JSON.parse(trimmed)
  } catch {
    return null
  }
}

export function getInitialsFromName(name, fallback = 'U') {
  const normalized = String(name || '').trim()
  if (!normalized) {
    return fallback
  }

  return normalized
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('')
}

export function extractAvatarUrlCandidate(value) {
  if (!value) {
    return ''
  }

  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) {
      return ''
    }

    const parsed = tryParseJson(trimmed)
    if (parsed != null) {
      return extractAvatarUrlCandidate(parsed)
    }

    return trimmed
  }

  if (typeof value === 'object') {
    const candidate =
      value.url
      || value.secure_url
      || value.secureUrl
      || value.avatar_url
      || value.avatarUrl
      || value.media_url
      || value.mediaUrl
      || value.path
      || ''

    return extractAvatarUrlCandidate(candidate)
  }

  return ''
}

export function normalizeAvatarUrl(value) {
  const candidate = extractAvatarUrlCandidate(value)
  if (!candidate) {
    return ''
  }

  if (/^https?:\/\//i.test(candidate) || /^data:/i.test(candidate) || /^blob:/i.test(candidate)) {
    return candidate
  }

  if (candidate.startsWith('//')) {
    return `https:${candidate}`
  }

  const normalizedPath = candidate.replace(/\\/g, '/')

  if (normalizedPath.startsWith('local:')) {
    const relativePath = normalizedPath.slice('local:'.length).replace(/^\/+/, '')
    return `${API_ORIGIN}/uploads/${relativePath}`
  }

  if (normalizedPath.startsWith('/api/uploads/')) {
    return `${API_ORIGIN}${normalizedPath.slice('/api'.length)}`
  }

  if (normalizedPath.startsWith('api/uploads/')) {
    return `${API_ORIGIN}/${normalizedPath.slice('api/'.length)}`
  }

  const uploadsIndex = normalizedPath.toLowerCase().indexOf('/uploads/')
  if (uploadsIndex >= 0) {
    return `${API_ORIGIN}${normalizedPath.slice(uploadsIndex)}`
  }

  if (normalizedPath.startsWith('/uploads/')) {
    return `${API_ORIGIN}${normalizedPath}`
  }

  if (normalizedPath.startsWith('uploads/')) {
    return `${API_ORIGIN}/${normalizedPath}`
  }

  return normalizedPath
}

export function getUserAvatarUrl(user) {
  if (!user || typeof user !== 'object') {
    return ''
  }

  return normalizeAvatarUrl(
    user.avatarUrl
      || user.avatar_url
      || user.avatar
      || user.profilePicture
      || user.profile_picture
      || user.photoUrl
      || user.photo_url,
  )
}

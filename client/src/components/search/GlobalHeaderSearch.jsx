import React, { useEffect, useMemo, useRef, useState } from 'react'
import { listReports } from '../../services/reportsService'
import { getUserAvatarUrl } from '../../utils/avatarUtils'
import profileAvatar from '../../assets/logos/siara-logo1.png'
import '../../styles/GlobalHeaderSearch.css'

function getInitials(name) {
  const normalized = String(name || '').trim()
  if (!normalized) return 'U'

  return normalized
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('')
}

function getReportAuthorProfile(report) {
  const author = report?.reportedBy || report?.reported_by || {}

  return {
    id: author?.id
      ?? report?.reportedById
      ?? report?.reported_by_id
      ?? report?.userId
      ?? report?.user_id
      ?? report?.createdBy
      ?? report?.created_by
      ?? null,
    name: author?.name || report?.authorName || 'Citizen',
    email: author?.email || report?.createdByEmail || report?.created_by_email || '',
    avatarUrl: getUserAvatarUrl(author),
  }
}

export default function GlobalHeaderSearch({
  navigate,
  query,
  setQuery,
  placeholder = 'Search for an incident, a road, a wilaya...',
  ariaLabel = 'Search',
  currentUser = null,
}) {
  const [reports, setReports] = useState([])
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const closeTimeoutRef = useRef(null)

  useEffect(() => {
    let ignore = false

    ;(async () => {
      try {
        setIsLoading(true)
        const response = await listReports({ limit: 100, offset: 0, sort: 'recent' })
        if (!ignore) {
          setReports(Array.isArray(response?.reports) ? response.reports : [])
        }
      } catch {
        if (!ignore) {
          setReports([])
        }
      } finally {
        if (!ignore) {
          setIsLoading(false)
        }
      }
    })()

    return () => {
      ignore = true
      if (closeTimeoutRef.current) {
        window.clearTimeout(closeTimeoutRef.current)
      }
    }
  }, [])

  const normalizedQuery = String(query || '').trim().toLowerCase()

  const filteredReports = useMemo(() => {
    if (!normalizedQuery) return []

    return reports
      .filter((report) => {
        const authorProfile = getReportAuthorProfile(report)
        const title = String(report?.title || '').toLowerCase()
        const location = String(report?.locationLabel || '').toLowerCase()
        const type = String(report?.incidentType || '').toLowerCase()
        const description = String(report?.description || '').toLowerCase()
        const status = String(report?.status || '').toLowerCase()
        const severity = String(report?.severity || '').toLowerCase()
        const authorName = String(authorProfile?.name || '').toLowerCase()
        const authorEmail = String(authorProfile?.email || '').toLowerCase()

        return (
          title.includes(normalizedQuery)
          || location.includes(normalizedQuery)
          || type.includes(normalizedQuery)
          || description.includes(normalizedQuery)
          || status.includes(normalizedQuery)
          || severity.includes(normalizedQuery)
          || authorName.includes(normalizedQuery)
          || authorEmail.includes(normalizedQuery)
        )
      })
      .slice(0, 6)
  }, [normalizedQuery, reports])

  const filteredUsers = useMemo(() => {
    if (!normalizedQuery) return []

    const uniqueUsers = new Map()

    reports.forEach((report) => {
      const profile = getReportAuthorProfile(report)
      if (!profile?.name) return

      const identityKey = profile.id != null
        ? `id:${String(profile.id)}`
        : `name:${String(profile.name).trim().toLowerCase()}`

      if (!uniqueUsers.has(identityKey)) {
        uniqueUsers.set(identityKey, profile)
      }
    })

    return Array.from(uniqueUsers.values())
      .filter((profile) => {
        const name = String(profile.name || '').toLowerCase()
        const email = String(profile.email || '').toLowerCase()
        return name.includes(normalizedQuery) || email.includes(normalizedQuery)
      })
      .slice(0, 5)
  }, [normalizedQuery, reports])

  const suggestions = useMemo(() => {
    if (!normalizedQuery) return []

    const accountItems = filteredUsers.map((profile) => ({
      kind: 'account',
      id: profile.id != null ? `account-${profile.id}` : `account-${profile.name}`,
      title: profile.name,
      subtitle: profile.email || 'Feed contributor',
      avatarUrl: getUserAvatarUrl(profile) || profileAvatar,
      payload: profile,
    }))

    const reportItems = filteredReports.map((report) => ({
      kind: 'report',
      id: `report-${report.id}`,
      title: report?.title || 'Reported incident',
      subtitle: report?.locationLabel || report?.incidentType || 'Incident report',
      avatarUrl: '',
      payload: report,
    }))

    return [...accountItems, ...reportItems].slice(0, 10)
  }, [filteredReports, filteredUsers, normalizedQuery])

  const openProfile = (profile) => {
    if (!profile || !profile.name) return

    const currentUserId = currentUser?.id ?? currentUser?.userId ?? currentUser?.user_id
    const targetUserId = profile?.id ?? profile?.userId ?? profile?.user_id
    const currentUserEmail = String(currentUser?.email || '').trim().toLowerCase()
    const targetUserEmail = String(profile?.email || '').trim().toLowerCase()
    const currentUserName = String(currentUser?.name || '').trim().toLowerCase()
    const targetUserName = String(profile?.name || '').trim().toLowerCase()

    const sameById = currentUserId != null && targetUserId != null && String(currentUserId) === String(targetUserId)
    const sameByEmail = Boolean(currentUserEmail && targetUserEmail && currentUserEmail === targetUserEmail)
    const sameByName = Boolean(currentUserName && targetUserName && currentUserName === targetUserName)

    if (sameById || sameByEmail || sameByName) {
      navigate('/profile')
      setIsOpen(false)
      return
    }

    navigate('/profile', { state: { profileUser: profile, source: 'header-search' } })
    setIsOpen(false)
  }

  const openReport = (report) => {
    if (!report?.id) return
    navigate(`/incident/${report.id}`)
    setIsOpen(false)
  }

  const runSearch = (rawValue) => {
    const value = String(rawValue || '').trim()
    if (!value) return

    if (suggestions.length > 0) {
      const first = suggestions[0]
      if (first.kind === 'account') {
        openProfile(first.payload)
      } else {
        openReport(first.payload)
      }
      return
    }

    navigate(`/news?q=${encodeURIComponent(value)}`)
    setIsOpen(false)
  }

  const handleFocus = () => {
    if (closeTimeoutRef.current) {
      window.clearTimeout(closeTimeoutRef.current)
      closeTimeoutRef.current = null
    }
    setIsOpen(true)
  }

  const handleBlur = () => {
    closeTimeoutRef.current = window.setTimeout(() => {
      setIsOpen(false)
    }, 120)
  }

  return (
    <div className="global-header-search">
      <input
        type="search"
        className="dash-search"
        placeholder={placeholder}
        aria-label={ariaLabel}
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onSearch={(event) => runSearch(event.currentTarget.value)}
        onKeyDown={(event) => {
          if (event.key !== 'Enter') return
          event.preventDefault()
          runSearch(event.currentTarget.value)
        }}
      />

      {isOpen && normalizedQuery && (
        <div className="global-header-search-menu" role="listbox" aria-label="Search suggestions">
          {isLoading ? (
            <div className="global-header-search-empty">Loading suggestions...</div>
          ) : suggestions.length > 0 ? (
            suggestions.map((item) => (
              <button
                key={item.id}
                className="global-header-search-item"
                onMouseDown={() => {
                  if (item.kind === 'account') {
                    openProfile(item.payload)
                  } else {
                    openReport(item.payload)
                  }
                }}
              >
                <span className={`global-header-search-avatar ${item.avatarUrl ? 'has-image' : ''}`}>
                  {item.avatarUrl ? (
                    <img
                      src={item.avatarUrl}
                      alt={`${item.title} avatar`}
                      className="global-header-search-avatar-image"
                      loading="lazy"
                      onError={(event) => {
                        if (event.currentTarget.src !== profileAvatar) {
                          event.currentTarget.src = profileAvatar
                          return
                        }

                        const avatarElement = event.currentTarget.closest('.global-header-search-avatar')
                        if (!avatarElement) {
                          return
                        }

                        avatarElement.classList.remove('has-image')
                        event.currentTarget.remove()
                      }}
                    />
                  ) : null}
                  <span className="global-header-search-avatar-fallback">{getInitials(item.title)}</span>
                </span>
                <span className="global-header-search-labels">
                  <span className="global-header-search-name-row">
                    <span className="global-header-search-name">{item.title}</span>
                    <span className={`global-header-search-type ${item.kind}`}>
                      {item.kind === 'account' ? 'Account' : 'Report'}
                    </span>
                  </span>
                  <span className="global-header-search-meta">{item.subtitle}</span>
                </span>
              </button>
            ))
          ) : (
            <div className="global-header-search-empty">No matching account or accident found.</div>
          )}
        </div>
      )}
    </div>
  )
}

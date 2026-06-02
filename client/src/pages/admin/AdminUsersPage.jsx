/**
 * @file AdminUsersPage.jsx
 * @description Admin user-governance page connected to /api/admin/users.
 *
 * Features:
 *   - Server-side filter / search / sort / pagination
 *   - Real moderation actions (warn, ban, unban)
 *   - Promote to trusted (role mutation)
 *   - Recalculate trust score on demand
 *   - Details modal showing report stats, driver quiz, occurrence risk
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import FancySelect from '../../components/ui/FancySelect'
import { useSearchParams } from 'react-router-dom'
import ArrowUpwardRoundedIcon from '@mui/icons-material/ArrowUpwardRounded'
import ArrowDownwardRoundedIcon from '@mui/icons-material/ArrowDownwardRounded'
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded'
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded'
import VisibilityRoundedIcon from '@mui/icons-material/VisibilityRounded'
import CloseRoundedIcon from '@mui/icons-material/CloseRounded'
import VerifiedRoundedIcon from '@mui/icons-material/VerifiedRounded'
import MailOutlineRoundedIcon from '@mui/icons-material/MailOutlineRounded'
import BadgeOutlinedIcon from '@mui/icons-material/BadgeOutlined'

import {
  fetchAdminRoles,
  fetchAdminUserDetails,
  fetchAdminUsers,
  recalculateAdminUserTrust,
  updateAdminUserRoles,
  updateAdminUserStatus,
} from '../../services/adminUsersService'

/* Moderation action icons — plain inline SVGs with hard-coded sizes so they
   never depend on MUI / inherited font-size (which rendered them blank here). */
const ACTION_ICON_PROPS = {
  width: 18,
  height: 18,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
}

function IconWarn() {
  return (
    <svg {...ACTION_ICON_PROPS}>
      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  )
}

function IconBan() {
  return (
    <svg {...ACTION_ICON_PROPS}>
      <circle cx="12" cy="12" r="9" />
      <line x1="5.6" y1="5.6" x2="18.4" y2="18.4" />
    </svg>
  )
}

function IconUnban() {
  return (
    <svg {...ACTION_ICON_PROPS}>
      <rect x="3" y="11" width="18" height="10" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 9.9-1" />
    </svg>
  )
}

function IconPromote() {
  return (
    <svg {...ACTION_ICON_PROPS}>
      <circle cx="12" cy="8" r="6" />
      <path d="M15.5 12.9 17 22l-5-3-5 3 1.5-9.1" />
    </svg>
  )
}

function IconRecalc() {
  return (
    <svg {...ACTION_ICON_PROPS}>
      <polyline points="23 4 23 10 17 10" />
      <polyline points="1 20 1 14 7 14" />
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
    </svg>
  )
}

/* Inline-styled action chips — colours applied directly on the element so the
   buttons stay visible even if the stylesheet is cached/stale. */
const ACTION_CHIP_BASE = {
  width: 30,
  height: 30,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 0,
  borderRadius: 8,
  border: '1px solid transparent',
  cursor: 'pointer',
}
const ACTION_CHIP_VARIANTS = {
  warn: { background: '#FEF3C7', color: '#B45309', borderColor: '#FDE68A' },
  ban: { background: '#FEE2E2', color: '#DC2626', borderColor: '#FECACA' },
  restore: { background: '#DCFCE7', color: '#15803D', borderColor: '#BBF7D0' },
  promote: { background: '#DCFCE7', color: '#15803D', borderColor: '#BBF7D0' },
  neutral: { background: '#EDE9FE', color: '#6D28D9', borderColor: '#DDD6FE' },
}
const actionChipStyle = (variant) => ({ ...ACTION_CHIP_BASE, ...ACTION_CHIP_VARIANTS[variant] })

const FILTER_TABS = [
  { key: 'all', label: 'All Users', countKey: 'all' },
  { key: 'active', label: 'Active', countKey: 'active' },
  { key: 'trusted', label: 'Trusted', countKey: 'trusted' },
  { key: 'at-risk', label: 'At Risk', countKey: 'atRisk' },
  { key: 'banned', label: 'Banned', countKey: 'banned' },
  { key: 'police', label: 'Police', countKey: 'police' },
  { key: 'supervisor', label: 'Supervisor', countKey: 'supervisor' },
  { key: 'admin', label: 'Admins', countKey: 'admin' },
]

const SORT_OPTIONS = [
  { value: 'trust_asc', label: 'Trust ascending (riskiest first)' },
  { value: 'trust_desc', label: 'Trust descending (most trusted first)' },
  { value: 'reports_desc', label: 'Most reports first' },
  { value: 'created_desc', label: 'Newest accounts' },
  { value: 'last_active_desc', label: 'Recently active' },
]

const PAGE_SIZE = 20

// FancySelect is imported from ../../components/ui/FancySelect.

function shortId(value) {
  if (!value) return ''
  const text = String(value)
  if (text.length <= 8) return text
  return `${text.slice(0, 6)}…${text.slice(-4)}`
}

function formatRelative(value) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  const diffMs = Date.now() - date.getTime()
  const diffMin = Math.max(0, Math.round(diffMs / 60000))
  if (diffMin < 1) return 'just now'
  if (diffMin < 60) return `${diffMin} min ago`
  const diffH = Math.round(diffMin / 60)
  if (diffH < 24) return `${diffH} h ago`
  const diffD = Math.round(diffH / 24)
  return `${diffD} day${diffD > 1 ? 's' : ''} ago`
}

function formatScore(value) {
  if (value == null) return '—'
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return '—'
  return Math.round(numeric)
}

function formatPercent(value, digits = 1) {
  if (value == null) return '—'
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return '—'
  return `${numeric.toFixed(digits)}%`
}

function formatOccurrence(value) {
  if (value == null) return '—'
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return '—'
  return `${Math.round(numeric * 100)}%`
}

function getUserInitials(name) {
  const text = String(name || '').trim()
  if (!text) return '?'
  const parts = text.split(/\s+/).slice(0, 2)
  const initials = parts.map((part) => part.charAt(0).toUpperCase()).join('')
  return initials || '?'
}

/** Turn a raw role name (e.g. "POLICE_SUPERVISOR") into a display label. */
function formatRoleLabel(name) {
  return String(name || '')
    .replace(/[_-]+/g, ' ')
    .trim()
    .toLowerCase()
    .replace(/\b\w/g, (ch) => ch.toUpperCase())
}

/** Map a trust score to a fill class for the progress bar. */
function trustFillClass(score) {
  if (score == null) return 'warning'
  if (score >= 75) return 'success'
  if (score >= 40) return 'warning'
  return 'danger'
}

const initialCounts = {
  all: 0,
  active: 0,
  trusted: 0,
  atRisk: 0,
  banned: 0,
  police: 0,
  supervisor: 0,
  admin: 0,
}

export default function AdminUsersPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const currentTab = searchParams.get('filter') || 'all'

  const [searchInput, setSearchInput] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [sort, setSort] = useState('trust_asc')
  const [offset, setOffset] = useState(0)

  const [users, setUsers] = useState([])
  const [counts, setCounts] = useState(initialCounts)
  const [pagination, setPagination] = useState({
    limit: PAGE_SIZE,
    offset: 0,
    hasMore: false,
    total: 0,
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [reloadTick, setReloadTick] = useState(0)

  const [busyUserId, setBusyUserId] = useState(null)
  const [actionError, setActionError] = useState('')
  const [actionMessage, setActionMessage] = useState('')
  const [detailsUser, setDetailsUser] = useState(null)
  const [detailsLoading, setDetailsLoading] = useState(false)

  /** Roles available in `auth.roles` — loaded once when the page mounts. */
  const [availableRoles, setAvailableRoles] = useState([])
  /** Selected role names for the user currently being edited in the modal. */
  const [editingRoles, setEditingRoles] = useState(new Set())
  const [rolesSaving, setRolesSaving] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetchAdminRoles()
      .then((roles) => {
        if (!cancelled) setAvailableRoles(roles)
      })
      .catch(() => {
        if (!cancelled) setAvailableRoles([])
      })
    return () => { cancelled = true }
  }, [])

  /** Sync the editor's selection with whichever user is currently open. */
  useEffect(() => {
    if (!detailsUser) {
      setEditingRoles(new Set())
      return
    }
    setEditingRoles(new Set(detailsUser.roles || []))
  }, [detailsUser?.id, detailsUser?.roles])

  /** Single-role selector: clicking a role replaces the entire selection.
   * Clicking the already-selected role is a no-op (a user must have one role). */
  const toggleEditingRole = (roleName) => {
    setEditingRoles((prev) => {
      if (prev.size === 1 && prev.has(roleName)) return prev
      return new Set([roleName])
    })
  }

  const saveRoles = async () => {
    if (!detailsUser) return
    setRolesSaving(true)
    setActionError('')
    try {
      const updated = await updateAdminUserRoles(detailsUser.id, Array.from(editingRoles))
      if (updated) setDetailsUser(updated)
      triggerReload()
    } catch (err) {
      setActionError(err?.message || 'Failed to update user roles')
    } finally {
      setRolesSaving(false)
    }
  }

  const currentRolesSet = useMemo(
    () => new Set((detailsUser?.roles) || []),
    [detailsUser?.roles],
  )
  const rolesDirty = useMemo(() => {
    if (editingRoles.size !== currentRolesSet.size) return true
    for (const role of editingRoles) {
      if (!currentRolesSet.has(role)) return true
    }
    return false
  }, [editingRoles, currentRolesSet])

  useEffect(() => {
    const handle = setTimeout(() => setDebouncedSearch(searchInput.trim()), 300)
    return () => clearTimeout(handle)
  }, [searchInput])

  useEffect(() => {
    setOffset(0)
  }, [currentTab, debouncedSearch, sort])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')
    fetchAdminUsers({
      search: debouncedSearch || undefined,
      filter: currentTab,
      sort,
      limit: PAGE_SIZE,
      offset,
    })
      .then((response) => {
        if (cancelled) return
        setUsers(Array.isArray(response.users) ? response.users : [])
        setCounts(response.counts || initialCounts)
        setPagination(response.pagination || { limit: PAGE_SIZE, offset, hasMore: false, total: 0 })
      })
      .catch((err) => {
        if (cancelled) return
        setError(err?.message || 'Failed to load users')
        setUsers([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [currentTab, debouncedSearch, sort, offset, reloadTick])

  const triggerReload = useCallback(() => setReloadTick((tick) => tick + 1), [])

  // Auto-dismiss the success banner so it doesn't linger.
  useEffect(() => {
    if (!actionMessage) return undefined
    const timer = setTimeout(() => setActionMessage(''), 4000)
    return () => clearTimeout(timer)
  }, [actionMessage])

  const tabBadge = useCallback((countKey) => counts?.[countKey] ?? 0, [counts])

  const setTab = (key) => {
    if (key === 'all') setSearchParams({})
    else setSearchParams({ filter: key })
  }

  const runStatusUpdate = async (user, status, options) => {
    setBusyUserId(user.id)
    setActionError('')
    try {
      await updateAdminUserStatus(user.id, status, options)
      triggerReload()
      if (detailsUser?.id === user.id) {
        const refreshed = await fetchAdminUserDetails(user.id)
        if (refreshed) setDetailsUser(refreshed)
      }
    } catch (err) {
      setActionError(err?.message || 'Failed to update user status')
    } finally {
      setBusyUserId(null)
    }
  }

  /* ── Warn modal: reason + optional expiry ─────────────────────────────── */
  const [warnModalUser, setWarnModalUser] = useState(null)
  const [warnDuration, setWarnDuration] = useState('ack')
  const [warnReason, setWarnReason] = useState('')
  const [warnCustomUntil, setWarnCustomUntil] = useState('')
  const [warnSubmitting, setWarnSubmitting] = useState(false)

  const openWarnModal = (user) => {
    setWarnModalUser(user)
    setWarnDuration('ack')
    setWarnReason('')
    setWarnCustomUntil('')
  }
  const closeWarnModal = () => {
    if (warnSubmitting) return
    setWarnModalUser(null)
  }

  const resolveWarningExpiresAt = () => {
    if (warnDuration === 'ack') return null // null = until user acknowledges
    const now = Date.now()
    const DAY = 24 * 60 * 60 * 1000
    switch (warnDuration) {
      case '7d':  return new Date(now + 7 * DAY).toISOString()
      case '30d': return new Date(now + 30 * DAY).toISOString()
      case '90d': return new Date(now + 90 * DAY).toISOString()
      case 'custom': {
        if (!warnCustomUntil) return undefined
        const dt = new Date(warnCustomUntil)
        if (Number.isNaN(dt.getTime()) || dt.getTime() <= now) return undefined
        return dt.toISOString()
      }
      default: return null
    }
  }

  const confirmWarn = async () => {
    if (!warnModalUser) return
    const trimmedReason = warnReason.trim()
    if (!trimmedReason) {
      setActionError('A reason is required so the user knows what the warning is for.')
      return
    }
    const warningExpiresAt = resolveWarningExpiresAt()
    if (warningExpiresAt === undefined) {
      setActionError('Pick a future date/time for the custom warning expiry.')
      return
    }
    setWarnSubmitting(true)
    try {
      await runStatusUpdate(warnModalUser, 'warned', {
        warningReason: trimmedReason,
        warningExpiresAt,
      })
      setWarnModalUser(null)
    } finally {
      setWarnSubmitting(false)
    }
  }

  /* ── Ban modal: preset durations, custom date, permanent ───────────────── */
  const [banModalUser, setBanModalUser] = useState(null)
  const [banDuration, setBanDuration] = useState('24h')
  const [banReason, setBanReason] = useState('')
  const [banCustomUntil, setBanCustomUntil] = useState('')
  const [banSubmitting, setBanSubmitting] = useState(false)

  const openBanModal = (user) => {
    setBanModalUser(user)
    setBanDuration('24h')
    setBanReason('')
    setBanCustomUntil('')
  }
  const closeBanModal = () => {
    if (banSubmitting) return
    setBanModalUser(null)
  }

  /** Resolve the picked preset/custom into an ISO timestamp or null (permanent). */
  const resolveBannedUntil = () => {
    if (banDuration === 'permanent') return null
    const now = Date.now()
    const HOUR = 60 * 60 * 1000
    const DAY = 24 * HOUR
    switch (banDuration) {
      case '1h':   return new Date(now + 1 * HOUR).toISOString()
      case '24h':  return new Date(now + 1 * DAY).toISOString()
      case '7d':   return new Date(now + 7 * DAY).toISOString()
      case '30d':  return new Date(now + 30 * DAY).toISOString()
      case '6mo':  return new Date(now + 180 * DAY).toISOString()
      case 'custom': {
        if (!banCustomUntil) return undefined
        const dt = new Date(banCustomUntil)
        if (Number.isNaN(dt.getTime()) || dt.getTime() <= now) return undefined
        return dt.toISOString()
      }
      default: return new Date(now + DAY).toISOString()
    }
  }

  const confirmBan = async () => {
    if (!banModalUser) return
    const bannedUntil = resolveBannedUntil()
    if (bannedUntil === undefined) {
      setActionError('Pick a future date/time for the custom ban.')
      return
    }
    setBanSubmitting(true)
    try {
      await runStatusUpdate(banModalUser, 'banned', { bannedUntil, reason: banReason.trim() || undefined })
      setBanModalUser(null)
    } finally {
      setBanSubmitting(false)
    }
  }

  const promoteToTrusted = async (user) => {
    setBusyUserId(user.id)
    setActionError('')
    try {
      const nextRoles = Array.from(new Set([...(user.roles || []), 'trusted']))
      await updateAdminUserRoles(user.id, nextRoles)
      triggerReload()
    } catch (err) {
      setActionError(err?.message || 'Failed to promote user')
    } finally {
      setBusyUserId(null)
    }
  }

  const recalcTrust = async (user) => {
    setBusyUserId(user.id)
    setActionError('')
    setActionMessage('')
    const previousScore = user.trustScore == null ? null : Math.round(Number(user.trustScore))
    const label = user.name || user.email || 'user'
    try {
      const updated = await recalculateAdminUserTrust(user.id)
      const newScore = updated?.trustScore == null ? null : Math.round(Number(updated.trustScore))
      if (newScore == null) {
        setActionMessage(`Trust score recalculated for ${label}.`)
      } else if (previousScore != null && previousScore !== newScore) {
        setActionMessage(`Trust score for ${label} recalculated: ${previousScore} → ${newScore}.`)
      } else {
        setActionMessage(`Trust score for ${label} recalculated — unchanged at ${newScore}.`)
      }
      // Update only this user's row in place so the table doesn't refetch and
      // re-sort, which would make the row jump and the change hard to see.
      if (updated?.trustScore != null) {
        setUsers((prev) => prev.map((row) => (
          row.id === user.id
            ? {
                ...row,
                trustScore: updated.trustScore,
                riskTier: updated.riskTier ?? row.riskTier,
                trustTier: updated.trustTier ?? row.trustTier,
                trustLastUpdatedAt: updated.trustLastUpdatedAt ?? row.trustLastUpdatedAt,
              }
            : row
        )))
      } else {
        triggerReload()
      }
    } catch (err) {
      setActionError(err?.message || 'Failed to recalculate trust score')
    } finally {
      setBusyUserId(null)
    }
  }

  const openDetails = async (user) => {
    setDetailsUser(user)
    setDetailsLoading(true)
    try {
      const detailed = await fetchAdminUserDetails(user.id)
      if (detailed) setDetailsUser(detailed)
    } catch (err) {
      setActionError(err?.message || 'Failed to load user details')
    } finally {
      setDetailsLoading(false)
    }
  }

  const closeDetails = () => setDetailsUser(null)

  const showingFrom = useMemo(
    () => (pagination.total === 0 ? 0 : offset + 1),
    [offset, pagination.total],
  )
  const showingTo = useMemo(
    () => Math.min(offset + users.length, pagination.total || offset + users.length),
    [offset, users.length, pagination.total],
  )

  return (
    <>
      <div className="admin-page-header">
        <div>
          <h1 className="admin-page-title">User Governance</h1>
          <p className="admin-page-subtitle">Trust scoring, risk assessment and user management</p>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <input
            className="admin-input"
            type="text"
            placeholder="Search name, email, ID…"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            style={{ width: 240, height: 32, fontSize: 11.5 }}
          />
          <FancySelect
            value={sort}
            onChange={setSort}
            options={SORT_OPTIONS}
            label="Sort by"
            icon={(
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                <path d="M3 6h18M6 12h12M10 18h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            )}
          />
        </div>
      </div>

      <div className="admin-tabs" style={{ marginBottom: 12 }}>
        {FILTER_TABS.map((tab) => (
          <button
            key={tab.key}
            className={`admin-tab ${currentTab === tab.key ? 'active' : ''}`}
            onClick={() => setTab(tab.key)}
          >
            {tab.label} <span style={{ opacity: 0.7 }}>({tabBadge(tab.countKey)})</span>
          </button>
        ))}
      </div>

      {actionError && (
        <div
          role="alert"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 10,
            marginBottom: 14,
            padding: '11px 16px 11px 12px',
            background: '#FEF2F2',
            border: '1px solid #FECACA',
            borderRadius: 12,
            color: '#991B1B',
            fontSize: 13.5,
            fontWeight: 600,
            boxShadow: '0 10px 26px rgba(220, 38, 38, 0.16)',
            animation: 'siara-admin-toast-pop 0.28s cubic-bezier(0.34, 1.56, 0.64, 1) both',
          }}
        >
          <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 22, height: 22, borderRadius: '50%', background: '#DC2626', color: '#fff', flexShrink: 0 }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><line x1="12" y1="7.5" x2="12" y2="13" /><line x1="12" y1="16.5" x2="12.01" y2="16.5" /></svg>
          </span>
          {actionError}
        </div>
      )}

      {actionMessage && (
        <div
          role="status"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 10,
            marginBottom: 14,
            padding: '11px 16px 11px 12px',
            background: '#ECFDF5',
            border: '1px solid #A7F3D0',
            borderRadius: 12,
            color: '#065F46',
            fontSize: 13.5,
            fontWeight: 600,
            boxShadow: '0 10px 26px rgba(16, 185, 129, 0.18)',
            animation: 'siara-admin-toast-pop 0.28s cubic-bezier(0.34, 1.56, 0.64, 1) both',
          }}
        >
          <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 22, height: 22, borderRadius: '50%', background: '#10B981', color: '#fff', flexShrink: 0 }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12" /></svg>
          </span>
          {actionMessage}
        </div>
      )}

      <div className="admin-card">
        <div className="admin-table-wrapper">
          <table className="admin-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Name</th>
                <th>Role</th>
                <th>Trust</th>
                <th>Reports</th>
                <th>False Ratio</th>
                <th>Risk</th>
                <th>Status</th>
                <th>Last Active</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={10} style={{ textAlign: 'center', padding: 24, color: 'var(--admin-text-muted)' }}>
                    Loading users…
                  </td>
                </tr>
              )}
              {!loading && error && (
                <tr>
                  <td colSpan={10} style={{ textAlign: 'center', padding: 24, color: 'var(--admin-danger)' }}>
                    {error}
                  </td>
                </tr>
              )}
              {!loading && !error && users.length === 0 && (
                <tr>
                  <td colSpan={10} style={{ textAlign: 'center', padding: 32, color: 'var(--admin-text-muted)' }}>
                    No users match the current filters.
                  </td>
                </tr>
              )}
              {!loading && !error && users.map((user) => {
                const trustScore = user.trustScore == null ? null : Math.round(Number(user.trustScore))
                const trustNumeric = trustScore ?? 0
                const totalReports = user.reportStats?.totalReports ?? 0
                const verifiedReports = user.reportStats?.verifiedReports ?? 0
                const falseRatio = user.reportStats?.falseRatio ?? 0
                const riskCode = user.riskTier?.code || 'low'
                const isBusy = busyUserId === user.id
                return (
                  <tr key={user.id} className={riskCode === 'high' ? 'row-highlight' : ''}>
                    <td style={{ fontWeight: 600, fontSize: 11, fontVariantNumeric: 'tabular-nums' }} title={user.id}>
                      {shortId(user.id)}
                    </td>
                    <td>
                      <div>
                        <div style={{ fontSize: 11.5, fontWeight: 500 }}>{user.name}</div>
                        <div style={{ fontSize: 10, color: 'var(--admin-text-muted)' }}>{user.email || user.phone || '—'}</div>
                      </div>
                    </td>
                    <td><span className={`admin-pill ${user.primaryRole}`}>{user.primaryRole}</span></td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div className="admin-progress" style={{ width: 44 }}>
                          <div
                            className={`admin-progress-fill ${trustNumeric >= 75 ? 'success' : trustNumeric >= 40 ? 'warning' : 'danger'}`}
                            style={{ width: `${Math.max(0, Math.min(100, trustNumeric))}%` }}
                          />
                        </div>
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 700,
                            fontVariantNumeric: 'tabular-nums',
                            color:
                              trustNumeric >= 75
                                ? 'var(--admin-success)'
                                : trustNumeric >= 40
                                  ? 'var(--admin-warning)'
                                  : 'var(--admin-danger)',
                          }}
                        >
                          {trustScore == null ? '—' : trustScore}
                        </span>
                      </div>
                    </td>
                    <td style={{ fontVariantNumeric: 'tabular-nums', fontSize: 11 }}>
                      <span style={{ fontWeight: 600 }}>{verifiedReports}</span>
                      <span style={{ color: 'var(--admin-text-muted)' }}> / {totalReports}</span>
                    </td>
                    <td>
                      <span style={{
                        fontWeight: 600,
                        fontSize: 11,
                        color:
                          falseRatio <= 15
                            ? 'var(--admin-success)'
                            : falseRatio <= 40
                              ? 'var(--admin-warning)'
                              : 'var(--admin-danger)',
                      }}>
                        {formatPercent(falseRatio, 1)}
                      </span>
                    </td>
                    <td><span className={`admin-pill ${riskCode}`}>{user.riskTier?.label || '—'}</span></td>
                    <td><span className={`admin-pill ${user.status}`}>{user.status}</span></td>
                    <td style={{ fontSize: 10.5, color: 'var(--admin-text-muted)' }}>{formatRelative(user.lastActiveAt)}</td>
                    <td style={{ width: 240, whiteSpace: 'nowrap' }}>
                      <div className="admin-user-actions">
                        {/* Moderation icon group */}
                        <div className="admin-user-actions-group" role="group" aria-label="Moderation" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          {user.status !== 'banned' && (
                            <button
                              type="button"
                              className="admin-user-icon-btn warn"
                              style={actionChipStyle('warn')}
                              onClick={() => openWarnModal(user)}
                              disabled={isBusy}
                              title="Warn user…"
                              aria-label="Warn user"
                            >
                              <IconWarn />
                            </button>
                          )}
                          {user.status !== 'banned' && (
                            <button
                              type="button"
                              className="admin-user-icon-btn ban"
                              style={actionChipStyle('ban')}
                              onClick={() => openBanModal(user)}
                              disabled={isBusy}
                              title="Ban user…"
                              aria-label="Ban user"
                            >
                              <IconBan />
                            </button>
                          )}
                          {user.status === 'banned' && (
                            <button
                              type="button"
                              className="admin-user-icon-btn restore"
                              style={actionChipStyle('restore')}
                              onClick={() => {
                                // Lifts both temporary and permanent bans. For permanent
                                // ones we confirm first because is_active flips back on
                                // and the user can sign in again immediately.
                                const isPerm = user.isPermanentlyBanned || (!user.bannedUntil && user.moderationStatus === 'banned')
                                if (isPerm && !window.confirm(`Lift the permanent ban on ${user.name}? They will be able to sign in again immediately.`)) {
                                  return
                                }
                                runStatusUpdate(user, 'active')
                              }}
                              disabled={isBusy}
                              title={user.bannedUntil
                                ? `Unban now (current ban ends ${new Date(user.bannedUntil).toLocaleString()})`
                                : 'Lift permanent ban'}
                              aria-label="Unban user"
                            >
                              <IconUnban />
                            </button>
                          )}
                          {user.primaryRole !== 'trusted' && trustScore != null && trustScore >= 80 && (
                            <button
                              type="button"
                              className="admin-user-icon-btn promote"
                              style={actionChipStyle('promote')}
                              onClick={() => promoteToTrusted(user)}
                              disabled={isBusy}
                              title="Promote to Trusted reporter"
                              aria-label="Promote to Trusted reporter"
                            >
                              <IconPromote />
                            </button>
                          )}
                          <button
                            type="button"
                            className="admin-user-icon-btn neutral"
                            style={actionChipStyle('neutral')}
                            onClick={() => recalcTrust(user)}
                            disabled={isBusy}
                            title="Recalculate trust score"
                            aria-label="Recalculate trust score"
                          >
                            <IconRecalc />
                          </button>
                        </div>

                        {/* Primary action — sits inline to the right of the icon group */}
                        <button
                          type="button"
                          className="admin-user-details-btn"
                          onClick={() => openDetails(user)}
                          disabled={isBusy}
                        >
                          <VisibilityRoundedIcon className="siara-eye-dot" fontSize="inherit" />
                          Details
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '10px 14px',
          borderTop: '1px solid var(--admin-border)',
          fontSize: 11,
          color: 'var(--admin-text-muted)',
        }}>
          <span>
            Showing {showingFrom}–{showingTo} of {pagination.total || users.length}
          </span>
          <div style={{ display: 'flex', gap: 4 }}>
            <button
              className="admin-btn admin-btn-sm admin-btn-ghost"
              onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
              disabled={offset === 0 || loading}
            >
              <ArrowBackRoundedIcon fontSize="inherit" /> Prev
            </button>
            <button
              className="admin-btn admin-btn-sm admin-btn-ghost"
              onClick={() => setOffset(offset + PAGE_SIZE)}
              disabled={!pagination.hasMore || loading}
            >
              Next <ArrowForwardRoundedIcon fontSize="inherit" />
            </button>
          </div>
        </div>
      </div>

      {detailsUser && (
        <div
          className="admin-modal-backdrop"
          role="dialog"
          aria-modal="true"
          onClick={closeDetails}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.45)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
        >
          {(() => {
            const trustScoreNum = detailsUser.trustScore == null ? null : Math.round(Number(detailsUser.trustScore))
            const trustClass = trustFillClass(trustScoreNum)
            const trustWidth = Math.max(0, Math.min(100, trustScoreNum ?? 0))
            const trustColor = trustClass === 'success' ? 'var(--admin-success)' : trustClass === 'warning' ? 'var(--admin-warning)' : 'var(--admin-danger)'
            const stats = detailsUser.reportStats || {}
            const reportTiles = [
              { label: 'Total', value: stats.totalReports ?? 0 },
              { label: 'Verified', value: stats.verifiedReports ?? 0, color: 'var(--admin-success)' },
              { label: 'Resolved', value: stats.resolvedReports ?? 0, color: 'var(--admin-primary)' },
              { label: 'Suspicious', value: stats.suspiciousReports ?? 0, color: 'var(--admin-warning)' },
              { label: 'Spam', value: stats.spamReports ?? 0, color: 'var(--admin-danger)' },
              { label: 'Out of Context', value: stats.outOfContextReports ?? 0 },
              { label: 'Invalid Location', value: stats.invalidLocationReports ?? 0 },
              { label: 'Rejected', value: stats.rejectedReports ?? 0 },
            ]
            const falseRatio = stats.falseRatio ?? 0
            const falseRatioColor = falseRatio <= 15 ? 'var(--admin-success)' : falseRatio <= 40 ? 'var(--admin-warning)' : 'var(--admin-danger)'

            return (
              <div
                className="admin-card"
                onClick={(event) => event.stopPropagation()}
                style={{
                  maxWidth: 920,
                  width: 'calc(100% - 32px)',
                  maxHeight: '92vh',
                  overflow: 'auto',
                  padding: 0,
                }}
              >
                {/* ═══ HEADER ═══ */}
                <div style={{
                  padding: '18px 22px 14px',
                  borderBottom: '1px solid var(--admin-border)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14,
                  position: 'sticky',
                  top: 0,
                  background: 'var(--admin-surface)',
                  zIndex: 2,
                }}>
                  <div style={{
                    width: 56,
                    height: 56,
                    flexShrink: 0,
                    borderRadius: '50%',
                    background: 'var(--admin-primary)',
                    color: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 20,
                    fontWeight: 700,
                    letterSpacing: '0.02em',
                    boxShadow: '0 6px 18px -6px rgba(124, 58, 237, 0.55)',
                  }}>
                    {getUserInitials(detailsUser.name)}
                  </div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: 'var(--admin-text)' }}>
                        {detailsUser.name || 'Unnamed user'}
                      </h2>
                      <span className={`admin-pill ${detailsUser.status}`}>{detailsUser.status}</span>
                      {detailsUser.emailVerifiedAt && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 10.5, color: 'var(--admin-success)', fontWeight: 600 }}>
                          <VerifiedRoundedIcon fontSize="inherit" /> Verified
                        </span>
                      )}
                    </div>
                    <div style={{ marginTop: 4, fontSize: 11.5, color: 'var(--admin-text-muted)', display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <MailOutlineRoundedIcon sx={{ fontSize: 13 }} />
                        {detailsUser.email || detailsUser.phone || '—'}
                      </span>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontVariantNumeric: 'tabular-nums' }} title={detailsUser.id}>
                        <BadgeOutlinedIcon sx={{ fontSize: 13 }} />
                        {shortId(detailsUser.id)}
                      </span>
                    </div>
                  </div>
                  <button
                    className="admin-btn admin-btn-icon admin-btn-ghost"
                    onClick={closeDetails}
                    aria-label="Close"
                  >
                    <CloseRoundedIcon fontSize="inherit" />
                  </button>
                </div>

                {detailsLoading && (
                  <p style={{ padding: '12px 22px', margin: 0, fontSize: 12, color: 'var(--admin-text-muted)' }}>
                    Loading details…
                  </p>
                )}

                {/* ═══ BODY ═══ */}
                <div style={{ padding: '16px 22px 22px', display: 'flex', flexDirection: 'column', gap: 16 }}>

                  {/* ── Hero row: Trust score + Account meta ── */}
                  <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 12 }}>
                    {/* Trust score hero */}
                    <div style={{
                      padding: '16px 18px',
                      borderRadius: 10,
                      border: '1px solid var(--admin-border)',
                      background: 'linear-gradient(135deg, var(--admin-surface-2) 0%, var(--admin-surface) 100%)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 10,
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--admin-text-muted)' }}>
                          Trust Score
                        </span>
                        <span className={`admin-pill ${detailsUser.riskTier?.code || 'low'}`}>
                          Risk: {detailsUser.riskTier?.label || '—'}
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                        <span style={{ fontSize: 38, fontWeight: 800, lineHeight: 1, color: trustColor, fontVariantNumeric: 'tabular-nums' }}>
                          {trustScoreNum ?? '—'}
                        </span>
                        <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--admin-text-muted)' }}>/ 100</span>
                      </div>
                      <div className="admin-progress">
                        <div className={`admin-progress-fill ${trustClass}`} style={{ width: `${trustWidth}%` }} />
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--admin-text-secondary)', fontWeight: 600 }}>
                        {detailsUser.trustTier?.label || '—'}
                      </div>
                      <div style={{ fontSize: 10.5, color: 'var(--admin-text-muted)' }}>
                        Updated {detailsUser.trustLastUpdatedAt ? formatRelative(detailsUser.trustLastUpdatedAt) : '—'}
                      </div>
                    </div>

                    {/* Account meta grid */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, alignContent: 'start' }}>
                      <div className="admin-mini-stat">
                        <span className="admin-mini-stat-label">Auth Provider</span>
                        <span className="admin-mini-stat-value" style={{ textTransform: 'capitalize' }}>{detailsUser.authProvider || '—'}</span>
                      </div>
                      <div className="admin-mini-stat">
                        <span className="admin-mini-stat-label">Email Verified</span>
                        <span className="admin-mini-stat-value" style={{ color: detailsUser.emailVerifiedAt ? 'var(--admin-success)' : 'var(--admin-text-muted)' }}>
                          {detailsUser.emailVerifiedAt ? 'Yes' : 'No'}
                        </span>
                      </div>
                      <div className="admin-mini-stat">
                        <span className="admin-mini-stat-label">Joined</span>
                        <span className="admin-mini-stat-value">
                          {detailsUser.createdAt ? new Date(detailsUser.createdAt).toLocaleDateString() : '—'}
                        </span>
                      </div>
                      <div className="admin-mini-stat">
                        <span className="admin-mini-stat-label">Last Active</span>
                        <span className="admin-mini-stat-value">{formatRelative(detailsUser.lastActiveAt)}</span>
                      </div>
                      {/* Moderation history — counts pulled from app.user_moderation_actions */}
                      <div className="admin-mini-stat">
                        <span className="admin-mini-stat-label">Times Banned</span>
                        <span
                          className="admin-mini-stat-value"
                          style={{
                            color: (detailsUser.moderationHistory?.banCount || 0) > 0
                              ? 'var(--admin-danger)'
                              : 'var(--admin-text)',
                            fontVariantNumeric: 'tabular-nums',
                          }}
                          title={detailsUser.moderationHistory?.lastBannedAt
                            ? `Last banned ${formatRelative(detailsUser.moderationHistory.lastBannedAt)}`
                            : 'Never banned'}
                        >
                          {detailsUser.moderationHistory?.banCount || 0}
                          {detailsUser.moderationHistory?.lastBannedAt ? (
                            <span style={{ fontSize: 10, fontWeight: 500, color: 'var(--admin-text-muted)', marginLeft: 6 }}>
                              · last {formatRelative(detailsUser.moderationHistory.lastBannedAt)}
                            </span>
                          ) : null}
                        </span>
                      </div>
                      <div className="admin-mini-stat">
                        <span className="admin-mini-stat-label">Times Warned</span>
                        <span
                          className="admin-mini-stat-value"
                          style={{
                            color: (detailsUser.moderationHistory?.warnCount || 0) > 0
                              ? 'var(--admin-warning)'
                              : 'var(--admin-text)',
                            fontVariantNumeric: 'tabular-nums',
                          }}
                          title={detailsUser.moderationHistory?.lastWarnedAt
                            ? `Last warned ${formatRelative(detailsUser.moderationHistory.lastWarnedAt)}`
                            : 'Never warned'}
                        >
                          {detailsUser.moderationHistory?.warnCount || 0}
                          {detailsUser.moderationHistory?.lastWarnedAt ? (
                            <span style={{ fontSize: 10, fontWeight: 500, color: 'var(--admin-text-muted)', marginLeft: 6 }}>
                              · last {formatRelative(detailsUser.moderationHistory.lastWarnedAt)}
                            </span>
                          ) : null}
                        </span>
                      </div>
                      <div className="admin-mini-stat" style={{ gridColumn: '1 / -1' }}>
                        <span className="admin-mini-stat-label">Current Roles</span>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 2 }}>
                          {(detailsUser.roles || []).length === 0 ? (
                            <span style={{ fontSize: 11.5, color: 'var(--admin-text-muted)' }}>None</span>
                          ) : (
                            (detailsUser.roles || []).map((roleName) => (
                              <span key={roleName} className={`admin-pill ${roleName.toLowerCase()}`}>
                                {formatRoleLabel(roleName)}
                              </span>
                            ))
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* ── Report activity ── */}
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                      <h3 className="admin-card-title">Report Activity</h3>
                      <div style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: '4px 10px',
                        borderRadius: 999,
                        background: 'var(--admin-surface-2)',
                        fontSize: 11,
                        fontWeight: 600,
                      }}>
                        <span style={{ color: 'var(--admin-text-muted)' }}>False ratio</span>
                        <span style={{ color: falseRatioColor, fontVariantNumeric: 'tabular-nums' }}>
                          {formatPercent(falseRatio, 1)}
                        </span>
                      </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                      {reportTiles.map((tile) => (
                        <div className="admin-mini-stat" key={tile.label}>
                          <span className="admin-mini-stat-label">{tile.label}</span>
                          <span
                            className="admin-mini-stat-value"
                            style={{ fontSize: 18, fontWeight: 700, color: tile.color || 'var(--admin-text)', fontVariantNumeric: 'tabular-nums' }}
                          >
                            {tile.value}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* ── Driver behavior + Occurrence risk ── */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div style={{ padding: 14, border: '1px solid var(--admin-border)', borderRadius: 10, background: 'var(--admin-surface-2)' }}>
                      <h3 className="admin-card-title">Driver Behavior</h3>
                      {detailsUser.driverQuiz?.lastCompletedAt ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 10, fontSize: 12 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: 'var(--admin-text-muted)' }}>Risk score</span>
                            <span style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                              {formatScore(detailsUser.driverQuiz.latestRiskScore)} / 100
                            </span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: 'var(--admin-text-muted)' }}>Result</span>
                            <span style={{ fontWeight: 600 }}>
                              {detailsUser.driverQuiz.latestResultTitle || detailsUser.driverQuiz.latestResultLabel || '—'}
                            </span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: 'var(--admin-text-muted)' }}>Attempts</span>
                            <span style={{ fontWeight: 600 }}>{detailsUser.driverQuiz.completedAttemptsCount}</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: 'var(--admin-text-muted)' }}>Last completed</span>
                            <span>{formatRelative(detailsUser.driverQuiz.lastCompletedAt)}</span>
                          </div>
                        </div>
                      ) : (
                        <p style={{ marginTop: 10, fontSize: 11.5, color: 'var(--admin-text-muted)', fontStyle: 'italic' }}>
                          No driver quiz completed yet.
                        </p>
                      )}
                    </div>
                    <div style={{ padding: 14, border: '1px solid var(--admin-border)', borderRadius: 10, background: 'var(--admin-surface-2)' }}>
                      <h3 className="admin-card-title">Latest Occurrence Risk</h3>
                      {detailsUser.occurrenceRisk?.latestAt ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 10, fontSize: 12 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: 'var(--admin-text-muted)' }}>Personalized</span>
                            <span style={{ fontWeight: 700 }}>
                              {formatOccurrence(detailsUser.occurrenceRisk.latestPersonalizedScore)}
                              <span style={{ marginLeft: 6, fontSize: 10.5, color: 'var(--admin-text-muted)', textTransform: 'capitalize' }}>
                                ({detailsUser.occurrenceRisk.latestPersonalizedLevel || '—'})
                              </span>
                            </span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: 'var(--admin-text-muted)' }}>Global</span>
                            <span style={{ fontWeight: 700 }}>
                              {formatOccurrence(detailsUser.occurrenceRisk.latestGlobalScore)}
                              <span style={{ marginLeft: 6, fontSize: 10.5, color: 'var(--admin-text-muted)', textTransform: 'capitalize' }}>
                                ({detailsUser.occurrenceRisk.latestGlobalLevel || '—'})
                              </span>
                            </span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: 'var(--admin-text-muted)' }}>Recorded</span>
                            <span>{formatRelative(detailsUser.occurrenceRisk.latestAt)}</span>
                          </div>
                        </div>
                      ) : (
                        <p style={{ marginTop: 10, fontSize: 11.5, color: 'var(--admin-text-muted)', fontStyle: 'italic' }}>
                          No occurrence-risk prediction yet.
                        </p>
                      )}
                    </div>
                  </div>

                  {/* ── Account Type editor ── */}
                  <div style={{ padding: 16, border: '1px solid var(--admin-border)', borderRadius: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
                      <h3 className="admin-card-title">Account Type</h3>
                      {rolesDirty && (
                        <span style={{ fontSize: 10.5, color: 'var(--admin-warning)', fontWeight: 600 }}>
                          Unsaved changes
                        </span>
                      )}
                    </div>

                    {availableRoles.length === 0 ? (
                      <p style={{ fontSize: 12, color: 'var(--admin-text-muted)', marginTop: 10 }}>No roles available.</p>
                    ) : (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
                        {availableRoles.map((role) => {
                          const checked = editingRoles.has(role.name)
                          return (
                            <label
                              key={role.id}
                              title={role.description || role.name}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 6,
                                padding: '7px 12px',
                                borderRadius: 999,
                                border: `1px solid ${checked ? 'var(--admin-primary)' : 'var(--admin-border)'}`,
                                background: checked ? 'var(--admin-primary-subtle)' : 'var(--admin-surface)',
                                color: checked ? 'var(--admin-primary)' : 'var(--admin-text-secondary)',
                                fontSize: 11.5,
                                fontWeight: 600,
                                cursor: rolesSaving ? 'not-allowed' : 'pointer',
                                transition: 'all 120ms ease',
                                opacity: rolesSaving ? 0.6 : 1,
                                userSelect: 'none',
                              }}
                            >
                              <input
                                type="radio"
                                name="user-role"
                                checked={checked}
                                onChange={() => toggleEditingRole(role.name)}
                                disabled={rolesSaving}
                                style={{ accentColor: 'var(--admin-primary)', cursor: 'inherit' }}
                              />
                              {formatRoleLabel(role.name)}
                            </label>
                          )
                        })}
                      </div>
                    )}

                    <div style={{ display: 'flex', gap: 6, marginTop: 14, alignItems: 'center' }}>
                      <button
                        className="admin-btn admin-btn-sm admin-btn-primary"
                        onClick={saveRoles}
                        disabled={!rolesDirty || rolesSaving || editingRoles.size === 0}
                      >
                        {rolesSaving ? 'Saving…' : 'Save Roles'}
                      </button>
                      <button
                        className="admin-btn admin-btn-sm admin-btn-ghost"
                        onClick={() => setEditingRoles(new Set(detailsUser.roles || []))}
                        disabled={!rolesDirty || rolesSaving}
                      >
                        Reset
                      </button>
                      {editingRoles.size === 0 && (
                        <span style={{ fontSize: 10.5, color: 'var(--admin-warning)', marginLeft: 'auto' }}>
                          At least one role is required.
                        </span>
                      )}
                    </div>
                  </div>

                  {/* ── Recent reports ── */}
                  {Array.isArray(detailsUser.recentReports) && detailsUser.recentReports.length > 0 && (
                    <div>
                      <h3 className="admin-card-title" style={{ marginBottom: 8 }}>Recent Reports</h3>
                      <div style={{ border: '1px solid var(--admin-border)', borderRadius: 8, overflow: 'hidden' }}>
                        {detailsUser.recentReports.map((report, index) => (
                          <div
                            key={report.id}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: 12,
                              padding: '10px 12px',
                              borderBottom: index < detailsUser.recentReports.length - 1 ? '1px solid var(--admin-border)' : 'none',
                              fontSize: 11.5,
                            }}
                          >
                            <div style={{ minWidth: 0, flex: 1 }}>
                              <div style={{ fontWeight: 600, color: 'var(--admin-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {report.title || '(untitled)'}
                              </div>
                              <div style={{ fontSize: 10.5, color: 'var(--admin-text-muted)', marginTop: 2 }}>
                                {formatRelative(report.createdAt)}
                                {report.latestPredictedLabel ? ` · ${report.latestPredictedLabel}` : ''}
                                {report.reviewVerdict ? ` · verdict: ${report.reviewVerdict}` : ''}
                              </div>
                            </div>
                            <span className={`admin-pill ${report.status}`}>{report.status}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )
          })()}
        </div>
      )}

      {/* ═══ WARN MODAL ═══ */}
      {warnModalUser && (() => {
        const previewExpires = resolveWarningExpiresAt()
        const previewLabel =
          warnDuration === 'ack'
            ? 'Stays visible until the user dismisses it'
            : previewExpires === undefined
              ? 'Pick a future date/time'
              : previewExpires === null
                ? 'Until acknowledged'
                : `Auto-clears on ${new Date(previewExpires).toLocaleString()}`
        const presets = [
          { key: 'ack', label: 'Until acknowledged' },
          { key: '7d', label: '7 days' },
          { key: '30d', label: '30 days' },
          { key: '90d', label: '90 days' },
          { key: 'custom', label: 'Custom date…' },
        ]
        return (
          <div
            role="dialog"
            aria-modal="true"
            onClick={closeWarnModal}
            style={{
              position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.5)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              zIndex: 1100, backdropFilter: 'blur(2px)',
            }}
          >
            <div
              className="admin-card"
              onClick={(e) => e.stopPropagation()}
              style={{ width: 'min(480px, 92vw)', padding: 0, overflow: 'hidden' }}
            >
              <div style={{
                padding: '14px 18px',
                borderBottom: '1px solid var(--admin-border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--admin-warning)' }}>
                    Warn user
                  </h2>
                  <p style={{ margin: '2px 0 0', fontSize: 11.5, color: 'var(--admin-text-muted)' }}>
                    {warnModalUser.name} · {warnModalUser.email || warnModalUser.phone || '—'}
                  </p>
                </div>
                <button className="admin-btn admin-btn-icon admin-btn-ghost" onClick={closeWarnModal} aria-label="Close">×</button>
              </div>

              <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4, color: 'var(--admin-text-muted)', marginBottom: 6 }}>
                    Reason (shown to the user)
                  </label>
                  <textarea
                    className="admin-textarea"
                    value={warnReason}
                    onChange={(e) => setWarnReason(e.target.value)}
                    placeholder="e.g. Posted an unverified incident with missing details"
                    disabled={warnSubmitting}
                    rows={3}
                    style={{ width: '100%', fontSize: 12, resize: 'vertical' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4, color: 'var(--admin-text-muted)', marginBottom: 8 }}>
                    Auto-clear after
                  </label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {presets.map((preset) => {
                      const active = warnDuration === preset.key
                      return (
                        <button
                          key={preset.key}
                          type="button"
                          onClick={() => setWarnDuration(preset.key)}
                          disabled={warnSubmitting}
                          style={{
                            padding: '6px 12px',
                            borderRadius: 999,
                            border: `1px solid ${active ? 'var(--admin-warning)' : 'var(--admin-border)'}`,
                            background: active ? 'var(--admin-warning-subtle)' : 'var(--admin-surface-2)',
                            color: active ? 'var(--admin-warning)' : 'var(--admin-text-secondary)',
                            fontSize: 11.5,
                            fontWeight: 600,
                            cursor: warnSubmitting ? 'not-allowed' : 'pointer',
                          }}
                        >
                          {preset.label}
                        </button>
                      )
                    })}
                  </div>
                </div>

                {warnDuration === 'custom' && (
                  <div>
                    <label style={{ display: 'block', fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4, color: 'var(--admin-text-muted)', marginBottom: 6 }}>
                      Clear on
                    </label>
                    <input
                      type="datetime-local"
                      className="admin-input"
                      value={warnCustomUntil}
                      onChange={(e) => setWarnCustomUntil(e.target.value)}
                      disabled={warnSubmitting}
                      style={{ width: '100%', height: 34, fontSize: 12 }}
                    />
                  </div>
                )}

                <div style={{
                  padding: '10px 12px',
                  borderRadius: 8,
                  background: 'var(--admin-warning-subtle)',
                  border: '1px solid rgba(245, 158, 11, 0.25)',
                  fontSize: 11.5,
                  color: 'var(--admin-warning)',
                }}>
                  <strong>How it shows:</strong> {previewLabel}
                  <div style={{ marginTop: 4, fontSize: 10.5, color: 'var(--admin-text-muted)' }}>
                    A yellow banner appears at the top of every page for this user. They can still post and comment.
                  </div>
                </div>
              </div>

              <div style={{
                padding: '12px 18px',
                borderTop: '1px solid var(--admin-border)',
                display: 'flex',
                gap: 6,
                justifyContent: 'flex-end',
              }}>
                <button className="admin-btn admin-btn-sm admin-btn-ghost" onClick={closeWarnModal} disabled={warnSubmitting}>
                  Cancel
                </button>
                <button
                  className="admin-btn admin-btn-sm admin-btn-warning"
                  onClick={confirmWarn}
                  disabled={warnSubmitting || !warnReason.trim() || (warnDuration === 'custom' && !warnCustomUntil)}
                >
                  {warnSubmitting ? 'Sending…' : 'Send warning'}
                </button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* ═══ BAN MODAL ═══ */}
      {banModalUser && (() => {
        const previewUntil = resolveBannedUntil()
        const previewLabel = banDuration === 'permanent'
          ? 'Permanent (user cannot log in ever again)'
          : previewUntil === undefined
            ? 'Pick a future date/time'
            : new Date(previewUntil).toLocaleString()
        const presets = [
          { key: '1h', label: '1 hour' },
          { key: '24h', label: '24 hours' },
          { key: '7d', label: '7 days' },
          { key: '30d', label: '30 days' },
          { key: '6mo', label: '6 months' },
          { key: 'custom', label: 'Custom date…' },
          { key: 'permanent', label: 'Permanent' },
        ]
        return (
          <div
            role="dialog"
            aria-modal="true"
            onClick={closeBanModal}
            style={{
              position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.5)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              zIndex: 1100, backdropFilter: 'blur(2px)',
            }}
          >
            <div
              className="admin-card"
              onClick={(e) => e.stopPropagation()}
              style={{ width: 'min(480px, 92vw)', padding: 0, overflow: 'hidden' }}
            >
              <div style={{
                padding: '14px 18px',
                borderBottom: '1px solid var(--admin-border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--admin-danger)' }}>
                    Ban user
                  </h2>
                  <p style={{ margin: '2px 0 0', fontSize: 11.5, color: 'var(--admin-text-muted)' }}>
                    {banModalUser.name} · {banModalUser.email || banModalUser.phone || '—'}
                  </p>
                </div>
                <button className="admin-btn admin-btn-icon admin-btn-ghost" onClick={closeBanModal} aria-label="Close">×</button>
              </div>

              <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4, color: 'var(--admin-text-muted)', marginBottom: 8 }}>
                    Ban duration
                  </label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {presets.map((preset) => {
                      const active = banDuration === preset.key
                      const isPerm = preset.key === 'permanent'
                      return (
                        <button
                          key={preset.key}
                          type="button"
                          onClick={() => setBanDuration(preset.key)}
                          disabled={banSubmitting}
                          style={{
                            padding: '6px 12px',
                            borderRadius: 999,
                            border: `1px solid ${active ? (isPerm ? 'var(--admin-danger)' : 'var(--admin-primary)') : 'var(--admin-border)'}`,
                            background: active
                              ? (isPerm ? 'rgba(239, 68, 68, 0.12)' : 'var(--admin-primary-subtle)')
                              : 'var(--admin-surface-2)',
                            color: active
                              ? (isPerm ? 'var(--admin-danger)' : 'var(--admin-primary)')
                              : 'var(--admin-text-secondary)',
                            fontSize: 11.5,
                            fontWeight: 600,
                            cursor: banSubmitting ? 'not-allowed' : 'pointer',
                          }}
                        >
                          {preset.label}
                        </button>
                      )
                    })}
                  </div>
                </div>

                {banDuration === 'custom' && (
                  <div>
                    <label style={{ display: 'block', fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4, color: 'var(--admin-text-muted)', marginBottom: 6 }}>
                      Ban until
                    </label>
                    <input
                      type="datetime-local"
                      className="admin-input"
                      value={banCustomUntil}
                      onChange={(e) => setBanCustomUntil(e.target.value)}
                      disabled={banSubmitting}
                      style={{ width: '100%', height: 34, fontSize: 12 }}
                    />
                  </div>
                )}

                <div>
                  <label style={{ display: 'block', fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4, color: 'var(--admin-text-muted)', marginBottom: 6 }}>
                    Reason (shown to the user)
                  </label>
                  <textarea
                    className="admin-textarea"
                    value={banReason}
                    onChange={(e) => setBanReason(e.target.value)}
                    placeholder="e.g. Repeatedly posted false incidents"
                    disabled={banSubmitting}
                    rows={3}
                    style={{ width: '100%', fontSize: 12, resize: 'vertical' }}
                  />
                </div>

                <div style={{
                  padding: '10px 12px',
                  borderRadius: 8,
                  background: banDuration === 'permanent' ? 'rgba(239, 68, 68, 0.08)' : 'var(--admin-surface-2)',
                  border: `1px solid ${banDuration === 'permanent' ? 'rgba(239, 68, 68, 0.25)' : 'var(--admin-border)'}`,
                  fontSize: 11.5,
                  color: banDuration === 'permanent' ? 'var(--admin-danger)' : 'var(--admin-text-secondary)',
                }}>
                  <strong>{banDuration === 'permanent' ? 'Permanent ban' : 'Effective until'}:</strong> {previewLabel}
                  {banDuration !== 'permanent' && (
                    <div style={{ marginTop: 4, fontSize: 10.5, color: 'var(--admin-text-muted)' }}>
                      User can still log in to see the ban notice but cannot post or comment until then.
                    </div>
                  )}
                </div>
              </div>

              <div style={{
                padding: '12px 18px',
                borderTop: '1px solid var(--admin-border)',
                display: 'flex',
                gap: 6,
                justifyContent: 'flex-end',
              }}>
                <button className="admin-btn admin-btn-sm admin-btn-ghost" onClick={closeBanModal} disabled={banSubmitting}>
                  Cancel
                </button>
                <button
                  className="admin-btn admin-btn-sm admin-btn-danger"
                  onClick={confirmBan}
                  disabled={banSubmitting || (banDuration === 'custom' && !banCustomUntil)}
                >
                  {banSubmitting ? 'Banning…' : (banDuration === 'permanent' ? 'Ban permanently' : 'Apply ban')}
                </button>
              </div>
            </div>
          </div>
        )
      })()}
    </>
  )
}

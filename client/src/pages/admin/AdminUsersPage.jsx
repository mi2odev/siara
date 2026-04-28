/**
 * @file AdminUsersPage.jsx
 * @description Admin user-governance page connected to /api/admin/users.
 *
 * Features:
 *   - Server-side filter / search / sort / pagination
 *   - Real moderation actions (warn, suspend, ban, unsuspend, unban)
 *   - Promote to trusted (role mutation)
 *   - Recalculate trust score on demand
 *   - Details modal showing report stats, driver quiz, occurrence risk
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'

import {
  fetchAdminUserDetails,
  fetchAdminUsers,
  recalculateAdminUserTrust,
  updateAdminUserRoles,
  updateAdminUserStatus,
} from '../../services/adminUsersService'

const FILTER_TABS = [
  { key: 'all', label: 'All Users', countKey: 'all' },
  { key: 'active', label: 'Active', countKey: 'active' },
  { key: 'trusted', label: 'Trusted', countKey: 'trusted' },
  { key: 'at-risk', label: 'At Risk', countKey: 'atRisk' },
  { key: 'suspended', label: 'Suspended', countKey: 'suspended' },
  { key: 'banned', label: 'Banned', countKey: 'banned' },
  { key: 'police', label: 'Police', countKey: 'police' },
  { key: 'admin', label: 'Admins', countKey: 'admin' },
]

const SORT_OPTIONS = [
  { value: 'trust_asc', label: 'Trust ↑ (riskiest first)' },
  { value: 'trust_desc', label: 'Trust ↓ (most trusted first)' },
  { value: 'reports_desc', label: 'Reports ↓' },
  { value: 'created_desc', label: 'Newest accounts' },
  { value: 'last_active_desc', label: 'Recently active' },
]

const PAGE_SIZE = 20

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

const initialCounts = {
  all: 0,
  active: 0,
  trusted: 0,
  atRisk: 0,
  suspended: 0,
  banned: 0,
  police: 0,
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
  const [detailsUser, setDetailsUser] = useState(null)
  const [detailsLoading, setDetailsLoading] = useState(false)

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

  const tabBadge = useCallback((countKey) => counts?.[countKey] ?? 0, [counts])

  const setTab = (key) => {
    if (key === 'all') setSearchParams({})
    else setSearchParams({ filter: key })
  }

  const runStatusUpdate = async (user, status) => {
    setBusyUserId(user.id)
    setActionError('')
    try {
      await updateAdminUserStatus(user.id, status)
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
    try {
      await recalculateAdminUserTrust(user.id)
      triggerReload()
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
          <select
            className="admin-input"
            value={sort}
            onChange={(event) => setSort(event.target.value)}
            style={{ height: 32, fontSize: 11.5 }}
          >
            {SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
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
        <div className="admin-card" style={{ marginBottom: 12, padding: '8px 12px', color: 'var(--admin-danger)' }}>
          {actionError}
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
                  <tr key={user.id} className={riskCode === 'critical' ? 'row-highlight' : ''}>
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
                    <td>
                      <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                        {user.status !== 'banned' && user.status !== 'suspended' && (
                          <>
                            <button className="admin-btn admin-btn-sm admin-btn-ghost" onClick={() => runStatusUpdate(user, 'warned')} disabled={isBusy}>Warn</button>
                            <button className="admin-btn admin-btn-sm admin-btn-warning" onClick={() => runStatusUpdate(user, 'suspended')} disabled={isBusy}>Suspend</button>
                          </>
                        )}
                        {user.status === 'suspended' && (
                          <button className="admin-btn admin-btn-sm admin-btn-primary" onClick={() => runStatusUpdate(user, 'active')} disabled={isBusy}>Unsuspend</button>
                        )}
                        {user.status !== 'banned' && (
                          <button className="admin-btn admin-btn-sm admin-btn-danger" onClick={() => runStatusUpdate(user, 'banned')} disabled={isBusy}>Ban</button>
                        )}
                        {user.status === 'banned' && (
                          <button className="admin-btn admin-btn-sm admin-btn-primary" onClick={() => runStatusUpdate(user, 'active')} disabled={isBusy}>Unban</button>
                        )}
                        {user.primaryRole !== 'trusted' && trustScore != null && trustScore >= 80 && (
                          <button className="admin-btn admin-btn-sm admin-btn-primary" onClick={() => promoteToTrusted(user)} disabled={isBusy}>Promote</button>
                        )}
                        <button className="admin-btn admin-btn-sm admin-btn-ghost" onClick={() => recalcTrust(user)} disabled={isBusy}>↻ Trust</button>
                        <button className="admin-btn admin-btn-sm admin-btn-ghost" onClick={() => openDetails(user)}>Details</button>
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
              ← Prev
            </button>
            <button
              className="admin-btn admin-btn-sm admin-btn-ghost"
              onClick={() => setOffset(offset + PAGE_SIZE)}
              disabled={!pagination.hasMore || loading}
            >
              Next →
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
          <div
            className="admin-card"
            onClick={(event) => event.stopPropagation()}
            style={{
              maxWidth: 720,
              width: 'calc(100% - 32px)',
              maxHeight: '90vh',
              overflow: 'auto',
              padding: 18,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
              <div>
                <h2 className="admin-card-title" style={{ margin: 0 }}>{detailsUser.name}</h2>
                <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--admin-text-muted)' }}>
                  {detailsUser.email || detailsUser.phone || '—'} · {detailsUser.id}
                </p>
              </div>
              <button className="admin-btn admin-btn-sm admin-btn-ghost" onClick={closeDetails}>Close</button>
            </div>

            {detailsLoading && (
              <p style={{ marginTop: 12, color: 'var(--admin-text-muted)' }}>Loading details…</p>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, marginTop: 14 }}>
              <div>
                <h3 className="admin-card-title">Account</h3>
                <ul style={{ listStyle: 'none', padding: 0, margin: '6px 0 0', fontSize: 12, lineHeight: 1.7 }}>
                  <li><strong>Status:</strong> {detailsUser.status} {detailsUser.moderationStatus ? `(${detailsUser.moderationStatus})` : ''}</li>
                  <li><strong>Roles:</strong> {(detailsUser.roles || []).join(', ') || '—'}</li>
                  <li><strong>Auth provider:</strong> {detailsUser.authProvider || '—'}</li>
                  <li><strong>Email verified:</strong> {detailsUser.emailVerifiedAt ? 'yes' : 'no'}</li>
                  <li><strong>Created:</strong> {detailsUser.createdAt ? new Date(detailsUser.createdAt).toLocaleString() : '—'}</li>
                  <li><strong>Last active:</strong> {formatRelative(detailsUser.lastActiveAt)}</li>
                </ul>
              </div>
              <div>
                <h3 className="admin-card-title">Trust & risk</h3>
                <ul style={{ listStyle: 'none', padding: 0, margin: '6px 0 0', fontSize: 12, lineHeight: 1.7 }}>
                  <li><strong>Trust score:</strong> {formatScore(detailsUser.trustScore)} / 100 ({detailsUser.trustTier?.label || '—'})</li>
                  <li><strong>Risk tier:</strong> {detailsUser.riskTier?.label || '—'}</li>
                  <li><strong>Trust updated:</strong> {detailsUser.trustLastUpdatedAt ? new Date(detailsUser.trustLastUpdatedAt).toLocaleString() : '—'}</li>
                </ul>
              </div>
              <div>
                <h3 className="admin-card-title">Report stats</h3>
                <ul style={{ listStyle: 'none', padding: 0, margin: '6px 0 0', fontSize: 12, lineHeight: 1.7 }}>
                  <li><strong>Total:</strong> {detailsUser.reportStats?.totalReports ?? 0}</li>
                  <li><strong>Verified:</strong> {detailsUser.reportStats?.verifiedReports ?? 0}</li>
                  <li><strong>Spam:</strong> {detailsUser.reportStats?.spamReports ?? 0}</li>
                  <li><strong>Out of context:</strong> {detailsUser.reportStats?.outOfContextReports ?? 0}</li>
                  <li><strong>Invalid location:</strong> {detailsUser.reportStats?.invalidLocationReports ?? 0}</li>
                  <li><strong>Suspicious:</strong> {detailsUser.reportStats?.suspiciousReports ?? 0}</li>
                  <li><strong>Rejected:</strong> {detailsUser.reportStats?.rejectedReports ?? 0}</li>
                  <li><strong>Resolved:</strong> {detailsUser.reportStats?.resolvedReports ?? 0}</li>
                  <li><strong>False ratio:</strong> {formatPercent(detailsUser.reportStats?.falseRatio)}</li>
                </ul>
              </div>
              <div>
                <h3 className="admin-card-title">Driver behavior</h3>
                {detailsUser.driverQuiz?.lastCompletedAt ? (
                  <ul style={{ listStyle: 'none', padding: 0, margin: '6px 0 0', fontSize: 12, lineHeight: 1.7 }}>
                    <li><strong>Risk score:</strong> {formatScore(detailsUser.driverQuiz.latestRiskScore)} / 100</li>
                    <li><strong>Result:</strong> {detailsUser.driverQuiz.latestResultTitle || detailsUser.driverQuiz.latestResultLabel || '—'}</li>
                    <li><strong>Attempts:</strong> {detailsUser.driverQuiz.completedAttemptsCount}</li>
                    <li><strong>Last completed:</strong> {formatRelative(detailsUser.driverQuiz.lastCompletedAt)}</li>
                  </ul>
                ) : (
                  <p style={{ fontSize: 12, color: 'var(--admin-text-muted)' }}>No driver quiz completed.</p>
                )}
              </div>
              <div>
                <h3 className="admin-card-title">Latest occurrence risk</h3>
                {detailsUser.occurrenceRisk?.latestAt ? (
                  <ul style={{ listStyle: 'none', padding: 0, margin: '6px 0 0', fontSize: 12, lineHeight: 1.7 }}>
                    <li><strong>Personalized:</strong> {formatOccurrence(detailsUser.occurrenceRisk.latestPersonalizedScore)} ({detailsUser.occurrenceRisk.latestPersonalizedLevel || '—'})</li>
                    <li><strong>Global:</strong> {formatOccurrence(detailsUser.occurrenceRisk.latestGlobalScore)} ({detailsUser.occurrenceRisk.latestGlobalLevel || '—'})</li>
                    <li><strong>Recorded:</strong> {formatRelative(detailsUser.occurrenceRisk.latestAt)}</li>
                  </ul>
                ) : (
                  <p style={{ fontSize: 12, color: 'var(--admin-text-muted)' }}>No occurrence-risk prediction yet.</p>
                )}
              </div>
              {Array.isArray(detailsUser.recentReports) && detailsUser.recentReports.length > 0 && (
                <div style={{ gridColumn: '1 / -1' }}>
                  <h3 className="admin-card-title">Recent reports</h3>
                  <ul style={{ listStyle: 'none', padding: 0, margin: '6px 0 0', fontSize: 12, lineHeight: 1.6 }}>
                    {detailsUser.recentReports.map((report) => (
                      <li key={report.id} style={{ borderBottom: '1px solid var(--admin-border)', padding: '4px 0' }}>
                        <strong>{report.title || '(untitled)'}</strong> — {report.status}
                        {report.latestPredictedLabel ? ` · ${report.latestPredictedLabel}` : ''}
                        {report.reviewVerdict ? ` · verdict: ${report.reviewVerdict}` : ''}
                        <span style={{ marginLeft: 8, color: 'var(--admin-text-muted)' }}>
                          {formatRelative(report.createdAt)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}

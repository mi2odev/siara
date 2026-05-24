import React, { useContext, useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import CheckRoundedIcon from '@mui/icons-material/CheckRounded'
import EditNoteOutlinedIcon from '@mui/icons-material/EditNoteOutlined'
import NotificationsOutlinedIcon from '@mui/icons-material/NotificationsOutlined'

import { AuthContext } from '../../contexts/AuthContext'
import PoliceModeTab from '../../components/layout/PoliceModeTab'
import FeedSidebarNav from '../../components/layout/FeedSidebarNav'
import GlobalHeaderSearch from '../../components/search/GlobalHeaderSearch'
import { getUserRoles } from '../../utils/roleUtils'
import { getInitialsFromName, getUserAvatarUrl } from '../../utils/avatarUtils'
import { deleteReport, listReports, respondToInfoRequest } from '../../services/reportsService'
import FancySelect from '../../components/ui/FancySelect'
import '../../styles/NewsPage.css'
import '../../styles/AlertsPage.css'
import '../../styles/DashboardPage.css'
import siaraLogo from '../../assets/logos/siara-logo.png'
import profileAvatar from '../../assets/logos/siara-logo1.png'

function toTitleCase(value) {
  const normalized = String(value || '').trim()
  if (!normalized) return 'Unknown'
  return normalized.charAt(0).toUpperCase() + normalized.slice(1)
}

function PinIcon() {
  return (
    <svg className="info-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 2C8.68 2 6 4.68 6 8c0 5.25 6 12 6 12s6-6.75 6-12c0-3.32-2.68-6-6-6Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/>
      <circle cx="12" cy="8" r="2.2" stroke="currentColor" strokeWidth="1.5"/>
    </svg>
  )
}

function ClockIcon() {
  return (
    <svg className="info-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6"/>
      <path d="M12 7.5v4.5l3 2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

function TagIcon() {
  return (
    <svg className="info-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/>
      <circle cx="7" cy="7" r="1.5" fill="currentColor"/>
    </svg>
  )
}

function formatReportTime(value) {
  if (!value) return 'Unknown time'

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Unknown time'

  return date.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function getSeverityColor(severity) {
  return { high: '#DC2626', medium: '#F59E0B', low: '#10B981' }[severity] || '#64748B'
}

function getStatusValue(report) {
  return report?.status || 'pending'
}

function getStatusClass(status) {
  if (status === 'verified') return 'active'
  if (status === 'resolved') return 'archived'
  if (status === 'rejected') return 'expired'
  return 'paused'
}

function getReportTitle(report) {
  return report?.title || report?.incidentTitle || 'Untitled report'
}

function getReportType(report) {
  return report?.incidentType || report?.type || 'other'
}

function getReportLocation(report) {
  return report?.location?.label || report?.locationLabel || 'Unknown location'
}

function isOwnedByUser(report, userIdentity) {
  if (!report || !userIdentity) {
    return false
  }

  const reportOwnerIds = [
    report?.reportedBy?.id,
    report?.reported_by?.id,
    report?.userId,
    report?.user_id,
    report?.createdBy,
    report?.created_by,
    report?.authorId,
  ].filter(Boolean)

  const reportOwnerEmails = [
    report?.reportedBy?.email,
    report?.reported_by?.email,
    report?.email,
    report?.createdByEmail,
    report?.created_by_email,
  ].filter(Boolean)

  if (userIdentity.id && reportOwnerIds.some((id) => String(id) === String(userIdentity.id))) {
    return true
  }

  if (userIdentity.email) {
    const emailNeedle = String(userIdentity.email).toLowerCase()
    if (reportOwnerEmails.some((email) => String(email).toLowerCase() === emailNeedle)) {
      return true
    }
  }

  if (userIdentity.name) {
    const ownerName = report?.reportedBy?.name || report?.reported_by?.name || report?.authorName
    if (ownerName && String(ownerName).trim().toLowerCase() === String(userIdentity.name).trim().toLowerCase()) {
      return true
    }
  }

  return false
}

export default function ReportsPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, logout } = useContext(AuthContext)

  const [showDropdown, setShowDropdown] = useState(false)
  const [headerSearchQuery, setHeaderSearchQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')
  const [toast, setToast] = useState('')
  const [reports, setReports] = useState([])
  const [selectedReportId, setSelectedReportId] = useState(null)
  const [severityFilter, setSeverityFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [infoModalReport, setInfoModalReport] = useState(null)
  const [infoModalText, setInfoModalText] = useState('')
  const [infoModalSubmitting, setInfoModalSubmitting] = useState(false)
  const [infoModalError, setInfoModalError] = useState('')

  function openInfoModal(report) {
    setInfoModalReport(report)
    setInfoModalText('')
    setInfoModalError('')
  }
  function closeInfoModal() {
    if (infoModalSubmitting) return
    setInfoModalReport(null)
    setInfoModalText('')
    setInfoModalError('')
  }
  async function submitInfoResponse() {
    if (!infoModalReport || !infoModalText.trim() || infoModalSubmitting) return
    setInfoModalSubmitting(true)
    setInfoModalError('')
    try {
      const updated = await respondToInfoRequest(infoModalReport.id, infoModalText.trim())
      if (updated) {
        setReports((prev) => prev.map((r) => (r.id === updated.id ? updated : r)))
        setToast('Response sent — thanks for the extra info.')
        setInfoModalReport(null)
        setInfoModalText('')
      }
    } catch (err) {
      setInfoModalError(err?.message || 'Failed to send response')
    } finally {
      setInfoModalSubmitting(false)
    }
  }

  const userIdentity = useMemo(() => ({
    id: user?.id,
    email: user?.email,
    name: user?.name,
  }), [user?.email, user?.id, user?.name])

  useEffect(() => {
    let ignore = false

    ;(async () => {
      try {
        const response = await listReports({ limit: 100, offset: 0, sort: 'recent' })
        if (ignore) {
          return
        }

        const ownedReports = (response?.reports || []).filter((report) => isOwnedByUser(report, userIdentity))
        setReports(ownedReports)
      } catch (error) {
        if (!ignore) {
          setErrorMessage(error.message || 'Unable to load your reports.')
          setReports([])
        }
      } finally {
        if (!ignore) {
          setLoading(false)
        }
      }
    })()

    return () => {
      ignore = true
    }
  }, [userIdentity])

  useEffect(() => {
    if (location.state?.newReport) {
      setToast(`Report \"${location.state.newReport}\" submitted successfully`)
      window.history.replaceState({}, '')
    }
  }, [location.state])

  useEffect(() => {
    if (!toast) return undefined
    const timer = setTimeout(() => setToast(''), 4000)
    return () => clearTimeout(timer)
  }, [toast])

  const filteredReports = useMemo(
    () => reports.filter((report) => {
      if (severityFilter !== 'all' && report?.severity !== severityFilter) {
        return false
      }

      if (statusFilter !== 'all' && getStatusValue(report) !== statusFilter) {
        return false
      }

      return true
    }),
    [reports, severityFilter, statusFilter],
  )

  useEffect(() => {
    if (filteredReports.length === 0) {
      setSelectedReportId(null)
      return
    }

    if (selectedReportId && filteredReports.some((report) => report.id === selectedReportId)) {
      return
    }

    setSelectedReportId(filteredReports[0].id)
  }, [filteredReports, selectedReportId])

  const selectedReport = filteredReports.find((report) => report.id === selectedReportId) || null

  const stats = useMemo(() => ({
    all: reports.length,
    pending: reports.filter((report) => getStatusValue(report) === 'pending').length,
    verified: reports.filter((report) => getStatusValue(report) === 'verified').length,
    rejected: reports.filter((report) => getStatusValue(report) === 'rejected').length,
    resolved: reports.filter((report) => getStatusValue(report) === 'resolved').length,
  }), [reports])

  const profileName = user?.name || user?.email || 'SIARA User'
  const normalizedRoles = getUserRoles(user)
  const primaryRole = normalizedRoles.includes('admin')
    ? 'admin'
    : normalizedRoles.includes('police') || normalizedRoles.includes('policeofficer')
      ? 'police'
      : normalizedRoles[0] || 'citizen'
  const roleLabel = primaryRole.charAt(0).toUpperCase() + primaryRole.slice(1)
  const roleClass = primaryRole === 'admin'
    ? 'role-admin'
    : primaryRole === 'police'
      ? 'role-police'
      : 'role-citoyen'
  const userAvatarUrl = getUserAvatarUrl(user)
  const profileAvatarUrl = userAvatarUrl || profileAvatar
  const profileInitials = getInitialsFromName(profileName)

  async function handleDelete(event, reportId) {
    event.stopPropagation()
    if (!window.confirm('Delete this report?')) return

    try {
      await deleteReport(reportId)
      setReports((prev) => prev.filter((report) => report.id !== reportId))
      setToast('Report deleted')
    } catch (error) {
      setErrorMessage(error.message || 'Unable to delete report.')
    }
  }

  return (
    <div className="alerts-page">
      <header className="siara-dashboard-header">
        <div className="dash-header-inner">
          <div className="dash-header-left">
            <div className="dash-logo-block">
              <img src={siaraLogo} alt="SIARA" className="header-logo" />
            </div>
            <nav className="dash-header-tabs">
              <button className="dash-tab" onClick={() => navigate('/news')}>Feed</button>
              <button className="dash-tab" onClick={() => navigate('/map')}>Map</button>
              <button className="dash-tab" onClick={() => navigate('/alerts')}>Alerts</button>
              <button className="dash-tab dash-tab-active">Report</button>
              <button className="dash-tab" onClick={() => navigate('/dashboard')}>Dashboard</button>
              <button className="dash-tab" onClick={() => navigate('/predictions')}>Predictions</button>
              <PoliceModeTab user={user} />
            </nav>
          </div>
          <div className="dash-header-center">
            <GlobalHeaderSearch
              navigate={navigate}
              query={headerSearchQuery}
              setQuery={setHeaderSearchQuery}
              placeholder="Search for an incident, a road, a wilaya..."
              ariaLabel="Search"
              currentUser={user}
            />
          </div>
          <div className="dash-header-right">
            <button className="dash-icon-btn dash-icon-btn-notification" aria-label="Notifications" onClick={() => navigate('/notifications')}>
              <NotificationsOutlinedIcon fontSize="small" />
              <span className="notification-badge"></span>
            </button>
            <div className="dash-avatar-wrapper">
              <button className={`dash-avatar ${userAvatarUrl ? 'has-image' : ''}`} onClick={() => setShowDropdown(!showDropdown)} aria-label="User profile">
                {userAvatarUrl ? (
                  <img src={userAvatarUrl} alt="User avatar" className="dash-avatar-image" loading="lazy" />
                ) : profileInitials}
              </button>
              {showDropdown && (
                <div className="user-dropdown">
                  <button className="dropdown-item" onClick={() => { setShowDropdown(false); navigate('/profile') }}>My Profile</button>
                  <button className="dropdown-item" onClick={() => { setShowDropdown(false); navigate('/settings') }}>Settings</button>
                  <button className="dropdown-item" onClick={() => { setShowDropdown(false); navigate('/notifications') }}>Notifications</button>
                  <div className="dropdown-divider"></div>
                  <button className="dropdown-item logout" onClick={() => { logout(); navigate('/home') }}>Log Out</button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {toast && <div className="al-toast" onClick={() => setToast('')}>{toast}</div>}

      <div className="al-grid">
        <aside className="al-left">
          <div className="card profile-summary">
            <div className="profile-avatar-container">
              <img src={profileAvatarUrl} alt="Profile" className="profile-avatar-large" loading="lazy" />
              <span className="verified-badge"><CheckRoundedIcon fontSize="inherit" /></span>
            </div>
            <div className="profile-info">
              <p className="profile-name">{profileName}</p>
              <span className={`role-badge ${roleClass}`}>{roleLabel}</span>
              <p className="profile-bio">Browse live road reports and share updates from the field.</p>
              <button className="profile-view-link" onClick={() => navigate('/profile')}>View Profile</button>
            </div>
          </div>

          <button className="al-cta" onClick={() => navigate('/report/create')}>+ New Report</button>

          <div className="card al-filter-section">
            <div className="nav-section-label">REPORT STATUS</div>
            <nav className="al-nav">
              <button className={`al-nav-btn ${statusFilter === 'all' ? 'active' : ''}`} onClick={() => setStatusFilter('all')}>
                <span className="nav-label">All</span>
                <span className="nav-count">{stats.all}</span>
              </button>
              <button className={`al-nav-btn ${statusFilter === 'pending' ? 'active' : ''}`} onClick={() => setStatusFilter('pending')}>
                <span className="nav-label">Pending</span>
                <span className="nav-count">{stats.pending}</span>
              </button>
              <button className={`al-nav-btn ${statusFilter === 'verified' ? 'active' : ''}`} onClick={() => setStatusFilter('verified')}>
                <span className="nav-label">Verified</span>
                <span className="nav-count">{stats.verified}</span>
              </button>
              <button className={`al-nav-btn ${statusFilter === 'resolved' ? 'active' : ''}`} onClick={() => setStatusFilter('resolved')}>
                <span className="nav-label">Resolved</span>
                <span className="nav-count">{stats.resolved}</span>
              </button>
              <button className={`al-nav-btn ${statusFilter === 'rejected' ? 'active' : ''}`} onClick={() => setStatusFilter('rejected')}>
                <span className="nav-label">Rejected</span>
                <span className="nav-count">{stats.rejected}</span>
              </button>
            </nav>
          </div>

          <FeedSidebarNav activeKey="reports" />
        </aside>

        <main className="al-center">
          <div className="al-page-head">
            <h1>My Reports</h1>
            <p>Track, review, and manage your incident reports.</p>
          </div>

          <div className="al-filters">
            <FancySelect
              value={severityFilter}
              onChange={setSeverityFilter}
              menuAlign="left"
              options={[
                { value: 'all',    label: 'Severity' },
                { value: 'high',   label: 'High' },
                { value: 'medium', label: 'Medium' },
                { value: 'low',    label: 'Low' },
              ]}
            />
          </div>

          {errorMessage && <div className="step-hint" style={{ color: '#b91c1c', marginBottom: 12 }}>{errorMessage}</div>}

          <div className="al-list">
            {loading ? (
              <div className="al-empty"><h3>Loading reports...</h3></div>
            ) : filteredReports.length === 0 ? (
              <div className="al-empty">
                <span className="empty-icon"><EditNoteOutlinedIcon fontSize="inherit" /></span>
                <h3>No Reports</h3>
                <p>Create your first report to share road incidents.</p>
                <button className="empty-btn" onClick={() => navigate('/report/create')}>Create a Report</button>
              </div>
            ) : (
              filteredReports.map((report) => (
                <div key={report.id} className={`al-card sev-${report.severity || 'unknown'} ${selectedReportId === report.id ? 'selected' : ''}`} onClick={() => setSelectedReportId(report.id)}>
                  <div className="card-head">
                    <h3 className="card-name">{getReportTitle(report)}</h3>
                    <span className={`card-status ${getStatusClass(getStatusValue(report))}`}>{toTitleCase(getStatusValue(report))}</span>
                    <span className="card-sev" style={{ background: `${getSeverityColor(report.severity)}15`, color: getSeverityColor(report.severity) }}>
                      <span className="sev-dot" style={{ background: getSeverityColor(report.severity) }}></span>
                      {toTitleCase(report.severity || 'unknown')}
                    </span>
                  </div>
                  <div className="card-body">
                    <div className="body-line">
                      <span className="info truncate">
                        <PinIcon />
                        {getReportLocation(report)}
                      </span>
                    </div>
                    <div className="body-line">
                      <span className="info">
                        <ClockIcon />
                        {formatReportTime(report.occurredAt || report.createdAt)}
                      </span>
                      <span className="info" style={{ marginLeft: 'auto' }}>
                        <TagIcon />
                        <span className="type-badge">{toTitleCase(getReportType(report))}</span>
                      </span>
                    </div>
                  </div>
                  {report.infoRequest?.pending && (
                    <div
                      className="info-request-banner"
                      onClick={(event) => event.stopPropagation()}
                      style={{
                        margin: '8px 12px 0',
                        padding: '10px 12px',
                        borderRadius: 8,
                        background: 'rgba(245, 158, 11, 0.10)',
                        border: '1px solid rgba(245, 158, 11, 0.35)',
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: 10,
                      }}
                    >
                      <span style={{ fontSize: 18, lineHeight: '20px', color: '#B45309' }}>?</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: 12.5, color: '#92400E' }}>
                          A moderator needs more info
                        </div>
                        {report.infoRequest.message ? (
                          <div style={{ fontSize: 12, color: '#78350F', marginTop: 2, whiteSpace: 'pre-wrap' }}>
                            "{report.infoRequest.message}"
                          </div>
                        ) : null}
                      </div>
                      <button
                        type="button"
                        className="act-btn act-edit"
                        onClick={(event) => { event.stopPropagation(); openInfoModal(report) }}
                      >
                        Respond
                      </button>
                    </div>
                  )}
                  {report.infoRequest && !report.infoRequest.pending && report.infoRequest.response && (
                    <div
                      onClick={(event) => event.stopPropagation()}
                      style={{
                        margin: '8px 12px 0',
                        padding: '8px 10px',
                        borderRadius: 8,
                        background: 'rgba(16, 185, 129, 0.08)',
                        border: '1px solid rgba(16, 185, 129, 0.25)',
                        fontSize: 11.5,
                        color: '#065F46',
                      }}
                    >
                      <strong>Your response was sent.</strong> Waiting on the moderator to follow up.
                    </div>
                  )}
                  <div className="card-foot">
                    <button className="act-btn act-edit" onClick={(event) => { event.stopPropagation(); navigate(`/incident/${report.id}`) }}>
                      View
                    </button>
                    <button className="act-btn act-delete" onClick={(event) => handleDelete(event, report.id)}>
                      Delete
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </main>

        <aside className="al-right">
          <div className="al-panel reports-overview-panel">
            <div className="panel-head">
              <span className="panel-label">Reports Overview</span>
            </div>
            <div className="reports-overview-grid">
              <div className="reports-overview-item">
                <span className="reports-overview-k">Total</span>
                <strong className="reports-overview-v">{stats.all}</strong>
              </div>
              <div className="reports-overview-item reports-overview-item-pending">
                <span className="reports-overview-k">Pending</span>
                <strong className="reports-overview-v">{stats.pending}</strong>
              </div>
              <div className="reports-overview-item reports-overview-item-verified">
                <span className="reports-overview-k">Verified</span>
                <strong className="reports-overview-v">{stats.verified}</strong>
              </div>
              <div className="reports-overview-item reports-overview-item-resolved">
                <span className="reports-overview-k">Resolved</span>
                <strong className="reports-overview-v">{stats.resolved}</strong>
              </div>
            </div>
          </div>

          <div className="al-panel reports-detail-panel">
            <div className="panel-head">
              <span className="panel-label">Selected Report</span>
            </div>

            {!selectedReport ? (
              <div className="al-no-sel">
                <span className="no-sel-icon">
                  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8L14 2Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/>
                    <path d="M14 2v6h6M9 13h6M9 17h4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
                  </svg>
                </span>
                <h4>No Report Selected</h4>
                <p>Select a report from the list to view complete details here.</p>
              </div>
            ) : (
              <>
                <h3 className="reports-detail-title">{getReportTitle(selectedReport)}</h3>

                <div className="reports-detail-chip-row">
                  <span className={`card-status ${getStatusClass(getStatusValue(selectedReport))}`}>
                    {toTitleCase(getStatusValue(selectedReport))}
                  </span>
                  <span
                    className="card-sev"
                    style={{
                      background: `${getSeverityColor(selectedReport.severity)}15`,
                      color: getSeverityColor(selectedReport.severity),
                    }}
                  >
                    <span className="sev-dot" style={{ background: getSeverityColor(selectedReport.severity) }}></span>
                    {toTitleCase(selectedReport.severity || 'unknown')}
                  </span>
                </div>

                {selectedReport.description && (
                  <p className="reports-detail-desc">{selectedReport.description}</p>
                )}

                <div className="reports-detail-list">
                  <div className="reports-detail-row">
                    <span>Type</span>
                    <strong>{toTitleCase(getReportType(selectedReport))}</strong>
                  </div>
                  <div className="reports-detail-row">
                    <span>Location</span>
                    <strong>{getReportLocation(selectedReport)}</strong>
                  </div>
                  <div className="reports-detail-row">
                    <span>Occurred</span>
                    <strong>{formatReportTime(selectedReport.occurredAt || selectedReport.createdAt)}</strong>
                  </div>
                  <div className="reports-detail-row">
                    <span>Reference</span>
                    <strong className="ref-id">{selectedReport.id}</strong>
                  </div>
                </div>

                <div className="reports-detail-actions">
                  <button className="act-btn act-edit" onClick={() => navigate(`/incident/${selectedReport.id}`)}>
                    View Full Report
                  </button>
                  <button className="act-btn" onClick={() => navigate('/report/create')}>
                    New Report
                  </button>
                </div>
              </>
            )}
          </div>
        </aside>
      </div>

      {infoModalReport && (
        <div
          onClick={closeInfoModal}
          style={{
            position: 'fixed', inset: 0, zIndex: 10000,
            background: 'rgba(15, 23, 42, 0.55)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
          }}
        >
          <div
            onClick={(event) => event.stopPropagation()}
            style={{
              width: 'min(520px, 100%)', background: '#fff', borderRadius: 12,
              boxShadow: '0 24px 60px rgba(15, 23, 42, 0.25)', padding: 20,
              display: 'flex', flexDirection: 'column', gap: 12,
            }}
          >
            <div>
              <h3 style={{ margin: 0, fontSize: 16, color: '#0F172A' }}>Respond to moderator</h3>
              <p style={{ margin: '4px 0 0', fontSize: 12.5, color: '#475569' }}>
                Your answer goes to the admin reviewing this report.
              </p>
            </div>
            {infoModalReport.infoRequest?.message ? (
              <div
                style={{
                  padding: '10px 12px', borderRadius: 8,
                  background: 'rgba(245, 158, 11, 0.10)',
                  border: '1px solid rgba(245, 158, 11, 0.30)',
                  fontSize: 12.5, color: '#78350F', whiteSpace: 'pre-wrap',
                }}
              >
                "{infoModalReport.infoRequest.message}"
              </div>
            ) : null}
            <textarea
              value={infoModalText}
              onChange={(event) => setInfoModalText(event.target.value)}
              placeholder="Type your response…"
              rows={5}
              maxLength={2000}
              disabled={infoModalSubmitting}
              style={{
                width: '100%', padding: 10, border: '1px solid #E2E8F0', borderRadius: 8,
                fontSize: 13, fontFamily: 'inherit', resize: 'vertical', minHeight: 100,
              }}
            />
            {infoModalError ? (
              <div style={{ fontSize: 12, color: '#B91C1C' }}>{infoModalError}</div>
            ) : null}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button
                type="button"
                className="act-btn"
                onClick={closeInfoModal}
                disabled={infoModalSubmitting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="act-btn act-edit"
                onClick={submitInfoResponse}
                disabled={!infoModalText.trim() || infoModalSubmitting}
              >
                {infoModalSubmitting ? 'Sending…' : 'Send response'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
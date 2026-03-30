import React, { useContext, useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

import { AuthContext } from '../../contexts/AuthContext'
import PoliceModeTab from '../../components/layout/PoliceModeTab'
import GlobalHeaderSearch from '../../components/search/GlobalHeaderSearch'
import { getUserRoles } from '../../utils/roleUtils'
import { deleteReport, listReports } from '../../services/reportsService'
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

function getUserInitials(name) {
  const normalized = String(name || 'User').trim()
  if (!normalized) return 'U'

  return normalized
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('')
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
            <div className="dash-logo-block" onClick={() => navigate('/home')} style={{ cursor: 'pointer' }}>
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
              <span className="notification-badge"></span>
            </button>
            <button className="dash-icon-btn dash-icon-btn-messages" aria-label="Messages"></button>
            <div className="dash-avatar-wrapper">
              <button className="dash-avatar" onClick={() => setShowDropdown(!showDropdown)} aria-label="User profile">
                {getUserInitials(user?.name)}
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
              <img src={profileAvatar} alt="Profile" className="profile-avatar-large" />
              <span className="verified-badge">✓</span>
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

          <div className="card nav-menu">
            <div className="nav-section-label">TOOLS</div>
            <button className="nav-item" onClick={() => navigate('/map')}><span className="nav-icon">🗺️</span><span className="nav-label">Open Map</span></button>
            <button className="nav-item" onClick={() => navigate('/alerts')}><span className="nav-icon">🔔</span><span className="nav-label">Manage Alerts</span></button>
            <button className="nav-item" onClick={() => navigate('/news')}><span className="nav-icon">📰</span><span className="nav-label">Back to Feed</span></button>
          </div>
        </aside>

        <main className="al-center">
          <div className="al-page-head">
            <h1>My Reports</h1>
            <p>Track, review, and manage your incident reports.</p>
          </div>

          <div className="al-filters">
            <select value={severityFilter} onChange={(event) => setSeverityFilter(event.target.value)}>
              <option value="all">Severity</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>

          {errorMessage && <div className="step-hint" style={{ color: '#b91c1c', marginBottom: 12 }}>{errorMessage}</div>}

          <div className="al-list">
            {loading ? (
              <div className="al-empty"><h3>Loading reports...</h3></div>
            ) : filteredReports.length === 0 ? (
              <div className="al-empty">
                <span className="empty-icon">📝</span>
                <h3>No Reports</h3>
                <p>Create your first report to share road incidents.</p>
                <button className="empty-btn" onClick={() => navigate('/report/create')}>Create a Report</button>
              </div>
            ) : (
              filteredReports.map((report) => (
                <div key={report.id} className={`al-card ${selectedReportId === report.id ? 'selected' : ''}`} onClick={() => setSelectedReportId(report.id)}>
                  <div className="card-head">
                    <h3 className="card-name">{getReportTitle(report)}</h3>
                    <span className={`card-status ${getStatusClass(getStatusValue(report))}`}>{toTitleCase(getStatusValue(report))}</span>
                    <span className="card-sev" style={{ background: `${getSeverityColor(report.severity)}18`, color: getSeverityColor(report.severity) }}>
                      <span className="sev-dot" style={{ background: getSeverityColor(report.severity) }}></span>
                      {toTitleCase(report.severity || 'unknown')}
                    </span>
                  </div>
                  <div className="card-body">
                    <div className="body-line">
                      <span className="info">📍 {getReportLocation(report)}</span>
                      <span className="info">🕐 {formatReportTime(report.occurredAt || report.createdAt)}</span>
                    </div>
                    <div className="body-line">
                      <span className="types">🏷️ {toTitleCase(getReportType(report))}</span>
                    </div>
                  </div>
                  <div className="card-foot">
                    <button className="act-btn act-edit" onClick={(event) => { event.stopPropagation(); navigate(`/incident/${report.id}`) }}>
                      <span>View</span>
                    </button>
                    <button className="act-btn act-delete" onClick={(event) => handleDelete(event, report.id)}>
                      <span>Delete</span>
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
                <span className="no-sel-icon">📝</span>
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
                      background: `${getSeverityColor(selectedReport.severity)}18`,
                      color: getSeverityColor(selectedReport.severity),
                    }}
                  >
                    <span className="sev-dot" style={{ background: getSeverityColor(selectedReport.severity) }}></span>
                    {toTitleCase(selectedReport.severity || 'unknown')}
                  </span>
                </div>

                <p className="reports-detail-desc">{selectedReport.description || 'No description provided.'}</p>

                <div className="reports-detail-list">
                  <div className="reports-detail-row"><span>Type</span><strong>{toTitleCase(getReportType(selectedReport))}</strong></div>
                  <div className="reports-detail-row"><span>Location</span><strong>{getReportLocation(selectedReport)}</strong></div>
                  <div className="reports-detail-row"><span>Occurred</span><strong>{formatReportTime(selectedReport.occurredAt || selectedReport.createdAt)}</strong></div>
                  <div className="reports-detail-row"><span>Reference</span><strong>{selectedReport.id}</strong></div>
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
    </div>
  )
}
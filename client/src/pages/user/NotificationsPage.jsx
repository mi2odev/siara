import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import '../../styles/NotificationsPage.css'
import '../../styles/DashboardPage.css'
import siaraLogo from '../../assets/logos/siara-logo.png'

export default function NotificationsPage() {
  const navigate = useNavigate()
  const [showDropdown, setShowDropdown] = useState(false)
  const [selectedNotification, setSelectedNotification] = useState(null)
  const [selectedIndex, setSelectedIndex] = useState(-1)
  
  // Filters
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [severityFilter, setSeverityFilter] = useState('all')
  const [timeFilter, setTimeFilter] = useState('all')

  // Mock notifications data
  const [notifications, setNotifications] = useState([
    {
      id: 1,
      type: 'alert',
      category: 'alerts',
      title: 'Alert triggered: Accidents A1 Highway',
      context: 'Multi-car collision detected in your monitored zone',
      location: 'A1 Highway, KM 23',
      alertName: 'Accidents A1 Highway',
      severity: 'high',
      time: '5 min ago',
      timestamp: new Date(Date.now() - 5 * 60000),
      read: false,
      incidentId: 101,
      explanation: 'You received this notification because you subscribed to "Accidents A1 Highway" alert which monitors high-severity incidents on the A1 corridor.',
      coordinates: { lat: 36.7538, lng: 3.0588 }
    },
    {
      id: 2,
      type: 'incident',
      category: 'incidents',
      title: 'New incident near your location',
      context: 'Traffic jam reported 2km from your saved route',
      location: 'Bab Ezzouar, Route N5',
      severity: 'medium',
      time: '23 min ago',
      timestamp: new Date(Date.now() - 23 * 60000),
      read: false,
      incidentId: 102,
      explanation: 'This incident was detected near your daily commute route "Home → Work". You have location-based notifications enabled.',
      coordinates: { lat: 36.7238, lng: 3.1088 }
    },
    {
      id: 3,
      type: 'ai',
      category: 'ai',
      title: 'AI Insight: Pattern detected',
      context: 'Recurring congestion predicted for tomorrow 8AM',
      location: 'Alger Centre',
      severity: 'low',
      time: '1 hour ago',
      timestamp: new Date(Date.now() - 60 * 60000),
      read: true,
      explanation: 'Our AI model detected a recurring traffic pattern based on 30 days of historical data. Confidence: 87%.',
      aiConfidence: 87,
      coordinates: { lat: 36.7738, lng: 3.0588 }
    },
    {
      id: 4,
      type: 'system',
      category: 'system',
      title: 'Weekly safety report available',
      context: 'Your region had 23% fewer incidents this week',
      severity: 'low',
      time: '3 hours ago',
      timestamp: new Date(Date.now() - 3 * 60 * 60000),
      read: true,
      explanation: 'You receive weekly reports because you enabled "Safety Digest" in your notification preferences.'
    },
    {
      id: 5,
      type: 'alert',
      category: 'alerts',
      title: 'Alert triggered: Zone Bab Ezzouar',
      context: 'Road works started in monitored area',
      location: 'Bab Ezzouar District',
      alertName: 'Zone Bab Ezzouar',
      severity: 'low',
      time: '5 hours ago',
      timestamp: new Date(Date.now() - 5 * 60 * 60000),
      read: true,
      incidentId: 103,
      explanation: 'You received this because your "Zone Bab Ezzouar" alert includes roadworks notifications.',
      coordinates: { lat: 36.7138, lng: 3.1788 }
    },
    {
      id: 6,
      type: 'incident',
      category: 'incidents',
      title: 'Incident resolved',
      context: 'The accident on A1 Highway has been cleared',
      location: 'A1 Highway, KM 20',
      severity: 'low',
      time: 'Yesterday',
      timestamp: new Date(Date.now() - 24 * 60 * 60000),
      read: true,
      incidentId: 100,
      explanation: 'You followed this incident and requested updates on its resolution.',
      coordinates: { lat: 36.7538, lng: 3.0388 }
    },
    {
      id: 7,
      type: 'alert',
      category: 'alerts',
      title: 'Alert triggered: Night Watch Oran',
      context: 'Dangerous driving conditions detected',
      location: 'Oran Centre',
      alertName: 'Night Watch Oran',
      severity: 'high',
      time: 'Yesterday',
      timestamp: new Date(Date.now() - 26 * 60 * 60000),
      read: true,
      incidentId: 104,
      explanation: 'Your "Night Watch Oran" alert monitors nighttime incidents in Oran.',
      coordinates: { lat: 35.6969, lng: -0.6331 }
    },
    {
      id: 8,
      type: 'system',
      category: 'system',
      title: 'Profile verification complete',
      context: 'Your citizen badge has been activated',
      severity: 'low',
      time: '3 days ago',
      timestamp: new Date(Date.now() - 3 * 24 * 60 * 60000),
      read: true,
      explanation: 'Your profile verification was completed. You now have full access to all SIARA features.'
    }
  ])

  // Filter notifications
  const filteredNotifications = notifications.filter(n => {
    if (categoryFilter !== 'all' && n.category !== categoryFilter) return false
    if (statusFilter === 'unread' && n.read) return false
    if (statusFilter === 'read' && !n.read) return false
    if (severityFilter !== 'all' && n.severity !== severityFilter) return false
    if (timeFilter === 'today') {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      if (n.timestamp < today) return false
    }
    if (timeFilter === 'week') {
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60000)
      if (n.timestamp < weekAgo) return false
    }
    return true
  })

  // Group notifications
  const groupNotifications = (notifs) => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)

    const groups = { today: [], yesterday: [], older: [] }
    
    notifs.forEach(n => {
      if (n.timestamp >= today) groups.today.push(n)
      else if (n.timestamp >= yesterday) groups.yesterday.push(n)
      else groups.older.push(n)
    })

    return groups
  }

  const groupedNotifications = groupNotifications(filteredNotifications)

  // Get icon for notification type
  const getIcon = (type) => {
    switch (type) {
      case 'alert': return '🔔'
      case 'incident': return '🚗'
      case 'ai': return '🤖'
      case 'system': return '⚙️'
      default: return '📌'
    }
  }

  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'high': return '#DC2626'
      case 'medium': return '#F59E0B'
      case 'low': return '#10B981'
      default: return '#64748B'
    }
  }

  // Handlers
  const selectNotification = (notif, index) => {
    setSelectedNotification(notif)
    setSelectedIndex(index)
  }

  const markAsRead = (id) => {
    setNotifications(prev => prev.map(n => 
      n.id === id ? { ...n, read: true } : n
    ))
  }

  const markAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
  }

  const handleAction = (action, notif) => {
    switch (action) {
      case 'view-incident':
        navigate(`/incident/${notif.incidentId}`)
        break
      case 'view-alert':
        navigate('/alerts')
        break
      case 'open-map':
        navigate('/map')
        break
      case 'mark-read':
        markAsRead(notif.id)
        break
      case 'mute':
        // Would mute similar notifications
        break
    }
  }

  // Keyboard navigation
  const handleKeyDown = useCallback((e) => {
    const allNotifs = [...groupedNotifications.today, ...groupedNotifications.yesterday, ...groupedNotifications.older]
    
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      const newIndex = Math.min(selectedIndex + 1, allNotifs.length - 1)
      setSelectedIndex(newIndex)
      setSelectedNotification(allNotifs[newIndex])
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      const newIndex = Math.max(selectedIndex - 1, 0)
      setSelectedIndex(newIndex)
      setSelectedNotification(allNotifs[newIndex])
    } else if (e.key === 'Enter' && selectedNotification) {
      if (!selectedNotification.read) markAsRead(selectedNotification.id)
    }
  }, [selectedIndex, groupedNotifications, selectedNotification])

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  const unreadCount = notifications.filter(n => !n.read).length
  const totalCount = filteredNotifications.length

  const renderNotificationItem = (notif, globalIndex) => (
    <div
      key={notif.id}
      className={`notif-item ${!notif.read ? 'unread' : ''} ${selectedNotification?.id === notif.id ? 'selected' : ''}`}
      onClick={() => selectNotification(notif, globalIndex)}
      tabIndex={0}
    >
      <div className="notif-icon" style={{ background: `${getSeverityColor(notif.severity)}15`, color: getSeverityColor(notif.severity) }}>
        {getIcon(notif.type)}
      </div>
      <div className="notif-content">
        <span className="notif-title">{notif.title}</span>
        <span className="notif-context">{notif.context}</span>
        {notif.location && <span className="notif-location">📍 {notif.location}</span>}
      </div>
      <div className="notif-meta">
        <span className="notif-time">{notif.time}</span>
        {!notif.read && <span className="notif-dot"></span>}
      </div>
    </div>
  )

  return (
    <div className="notifications-page">
      {/* HEADER */}
      <header className="siara-dashboard-header">
        <div className="dash-header-inner">
          <div className="dash-header-left">
            <div className="dash-logo-block" onClick={() => navigate('/home')} style={{cursor: 'pointer'}}>
              <img src={siaraLogo} alt="SIARA" className="dash-logo" />
            </div>
            <nav className="dash-header-tabs">
              <button className="dash-tab" onClick={() => navigate('/news')}>Feed</button>
              <button className="dash-tab" onClick={() => navigate('/map')}>Map</button>
              <button className="dash-tab" onClick={() => navigate('/alerts')}>Alerts</button>
              <button className="dash-tab" onClick={() => navigate('/dashboard')}>Dashboard</button>
            </nav>
          </div>
          <div className="dash-header-center">
            <input type="search" className="dash-search" placeholder="Rechercher..." aria-label="Search notifications" />
          </div>
          <div className="dash-header-right">
            <button className="dash-icon-btn dash-icon-active" aria-label="Notifications">
              🔔
              {unreadCount > 0 && <span className="notification-badge">{unreadCount}</span>}
            </button>
            <button className="dash-icon-btn" aria-label="Messages">💬</button>
            <div className="dash-avatar-wrapper">
              <button className="dash-avatar" onClick={() => setShowDropdown(!showDropdown)} aria-label="User profile">SA</button>
              {showDropdown && (
                <div className="user-dropdown">
                  <button className="dropdown-item" onClick={() => { setShowDropdown(false); navigate('/profile') }}>👤 Mon profil</button>
                  <button className="dropdown-item" onClick={() => { setShowDropdown(false); navigate('/settings') }}>⚙️ Paramètres</button>
                  <button className="dropdown-item" onClick={() => { setShowDropdown(false); navigate('/notifications') }}>🔔 Notifications</button>
                  <div className="dropdown-divider"></div>
                  <button className="dropdown-item logout">🚪 Déconnexion</button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* MAIN GRID */}
      <div className="notif-grid">
        {/* LEFT - FILTERS */}
        <aside className="notif-left">
          <div className="filter-section">
            <span className="filter-label">Catégories</span>
            {[
              { key: 'all', label: 'Toutes', icon: '📥' },
              { key: 'alerts', label: 'Alertes', icon: '🔔' },
              { key: 'incidents', label: 'Incidents', icon: '🚗' },
              { key: 'system', label: 'Système', icon: '⚙️' },
              { key: 'ai', label: 'IA Insights', icon: '🤖' }
            ].map(cat => (
              <button
                key={cat.key}
                className={`filter-btn ${categoryFilter === cat.key ? 'active' : ''}`}
                onClick={() => setCategoryFilter(cat.key)}
              >
                <span className="filter-icon">{cat.icon}</span>
                <span>{cat.label}</span>
              </button>
            ))}
          </div>

          <div className="filter-section">
            <span className="filter-label">Statut</span>
            {[
              { key: 'all', label: 'Toutes' },
              { key: 'unread', label: 'Non lues' },
              { key: 'read', label: 'Lues' }
            ].map(s => (
              <button
                key={s.key}
                className={`filter-btn ${statusFilter === s.key ? 'active' : ''}`}
                onClick={() => setStatusFilter(s.key)}
              >
                <span>{s.label}</span>
              </button>
            ))}
          </div>

          <div className="filter-section">
            <span className="filter-label">Sévérité</span>
            {[
              { key: 'all', label: 'Toutes' },
              { key: 'high', label: 'Haute', color: '#DC2626' },
              { key: 'medium', label: 'Moyenne', color: '#F59E0B' },
              { key: 'low', label: 'Basse', color: '#10B981' }
            ].map(s => (
              <button
                key={s.key}
                className={`filter-btn ${severityFilter === s.key ? 'active' : ''}`}
                onClick={() => setSeverityFilter(s.key)}
              >
                {s.color && <span className="sev-dot" style={{ background: s.color }}></span>}
                <span>{s.label}</span>
              </button>
            ))}
          </div>

          <div className="filter-section">
            <span className="filter-label">Période</span>
            {[
              { key: 'all', label: 'Tout' },
              { key: 'today', label: "Aujourd'hui" },
              { key: 'week', label: '7 derniers jours' }
            ].map(t => (
              <button
                key={t.key}
                className={`filter-btn ${timeFilter === t.key ? 'active' : ''}`}
                onClick={() => setTimeFilter(t.key)}
              >
                <span>{t.label}</span>
              </button>
            ))}
          </div>
        </aside>

        {/* CENTER - INBOX */}
        <main className="notif-center">
          <div className="notif-header">
            <div className="notif-header-left">
              <h1>Notifications</h1>
              <span className="notif-count">{unreadCount} non lues</span>
            </div>
            <div className="notif-header-right">
              {unreadCount > 0 && (
                <button className="mark-all-btn" onClick={markAllAsRead}>
                  ✓ Tout marquer comme lu
                </button>
              )}
            </div>
          </div>

          <div className="notif-list">
            {totalCount === 0 ? (
              <div className="notif-empty">
                <div className="empty-icon">✨</div>
                <h3>Vous êtes à jour</h3>
                <p>Aucune notification pour le moment.</p>
                <div className="empty-actions">
                  <button className="empty-btn primary" onClick={() => navigate('/alerts')}>
                    Créer une alerte
                  </button>
                  <button className="empty-btn secondary" onClick={() => navigate('/map')}>
                    Explorer la carte
                  </button>
                </div>
              </div>
            ) : (
              <>
                {groupedNotifications.today.length > 0 && (
                  <div className="notif-group">
                    <div className="group-header">Aujourd'hui</div>
                    {groupedNotifications.today.map((n, i) => renderNotificationItem(n, i))}
                  </div>
                )}
                {groupedNotifications.yesterday.length > 0 && (
                  <div className="notif-group">
                    <div className="group-header">Hier</div>
                    {groupedNotifications.yesterday.map((n, i) => 
                      renderNotificationItem(n, groupedNotifications.today.length + i)
                    )}
                  </div>
                )}
                {groupedNotifications.older.length > 0 && (
                  <div className="notif-group">
                    <div className="group-header">Plus ancien</div>
                    {groupedNotifications.older.map((n, i) => 
                      renderNotificationItem(n, groupedNotifications.today.length + groupedNotifications.yesterday.length + i)
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </main>

        {/* RIGHT - DETAIL PANEL */}
        <aside className="notif-right">
          {selectedNotification ? (
            <>
              {/* Header */}
              <div className="detail-header">
                <div className="detail-icon" style={{ background: `${getSeverityColor(selectedNotification.severity)}15`, color: getSeverityColor(selectedNotification.severity) }}>
                  {getIcon(selectedNotification.type)}
                </div>
                <div className="detail-title-block">
                  <h2 className="detail-title">{selectedNotification.title}</h2>
                  <div className="detail-meta">
                    <span className="detail-badge" style={{ background: `${getSeverityColor(selectedNotification.severity)}15`, color: getSeverityColor(selectedNotification.severity) }}>
                      {selectedNotification.severity === 'high' ? 'Haute' : selectedNotification.severity === 'medium' ? 'Moyenne' : 'Basse'}
                    </span>
                    <span className="detail-time">{selectedNotification.time}</span>
                  </div>
                </div>
              </div>

              {/* Explanation */}
              <div className="detail-section explanation">
                <span className="section-label">Pourquoi cette notification ?</span>
                <p className="explanation-text">{selectedNotification.explanation}</p>
              </div>

              {/* Context */}
              <div className="detail-section context">
                <span className="section-label">Contexte</span>
                <div className="context-card">
                  <div className="context-row">
                    <span className="context-label">Type</span>
                    <span className="context-value">{selectedNotification.type === 'alert' ? 'Alerte' : selectedNotification.type === 'incident' ? 'Incident' : selectedNotification.type === 'ai' ? 'IA Insight' : 'Système'}</span>
                  </div>
                  {selectedNotification.location && (
                    <div className="context-row">
                      <span className="context-label">Lieu</span>
                      <span className="context-value">{selectedNotification.location}</span>
                    </div>
                  )}
                  {selectedNotification.alertName && (
                    <div className="context-row">
                      <span className="context-label">Alerte</span>
                      <span className="context-value">{selectedNotification.alertName}</span>
                    </div>
                  )}
                  {selectedNotification.aiConfidence && (
                    <div className="context-row">
                      <span className="context-label">Confiance IA</span>
                      <span className="context-value">{selectedNotification.aiConfidence}%</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Mini Map */}
              {selectedNotification.coordinates && (
                <div className="detail-section map-section">
                  <span className="section-label">Localisation</span>
                  <div className="mini-map">
                    <div className="map-placeholder">
                      <span className="map-icon">🗺️</span>
                      <div className="map-pin" style={{ borderColor: getSeverityColor(selectedNotification.severity) }}>📍</div>
                    </div>
                    <span className="map-location">{selectedNotification.location}</span>
                    <button className="map-btn" onClick={() => handleAction('open-map', selectedNotification)}>
                      Ouvrir la carte
                    </button>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="detail-section actions">
                <span className="section-label">Actions</span>
                <div className="action-buttons">
                  {selectedNotification.incidentId && (
                    <button className="action-btn primary" onClick={() => handleAction('view-incident', selectedNotification)}>
                      👁️ Voir l'incident
                    </button>
                  )}
                  {selectedNotification.type === 'alert' && (
                    <button className="action-btn" onClick={() => handleAction('view-alert', selectedNotification)}>
                      🔔 Gérer l'alerte
                    </button>
                  )}
                  {!selectedNotification.read && (
                    <button className="action-btn" onClick={() => handleAction('mark-read', selectedNotification)}>
                      ✓ Marquer comme lu
                    </button>
                  )}
                  <button className="action-btn mute" onClick={() => handleAction('mute', selectedNotification)}>
                    🔇 Ignorer similaires
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="detail-empty">
              <div className="empty-illustration">📬</div>
              <p>Sélectionnez une notification pour voir les détails</p>
              <span className="empty-hint">Utilisez ↑ ↓ pour naviguer</span>
            </div>
          )}
        </aside>
      </div>
    </div>
  )
}

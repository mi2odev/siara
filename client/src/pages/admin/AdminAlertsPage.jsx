/**
 * @file AdminAlertsPage.jsx
 * @description Alert operations centre for managing geo-based alerts, emergency broadcasts and notifications.
 *
 * Layout:
 *   1. Emergency mode banner (conditional) — red bar when emergency mode is active
 *   2. Confirmation modal for emergency activation
 *   3. Page header with emergency toggle + "New Alert" button
 *   4. Create alert form (collapsible) — 3-column grid with title, zone, severity, type, duration, message
 *   5. Tab bar — 6 tabs: All | Active | Scheduled | Expiring/Expired | Emergency | Templates
 *   6. Templates gallery (card grid) OR alerts table with CRUD actions
 *
 * Features:
 *   - Emergency mode: broadcasts all alerts at max priority (requires confirmation)
 *   - Alert templates for quick creation
 *   - URL-driven tab routing via useSearchParams
 *
 * All data is currently mocked (allAlerts, templates).
 */
import React, { useState, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'

/* ═══════════════════════════════════════════════════════════
   MOCK DATA
   ═══════════════════════════════════════════════════════════ */

/* 6 sample alerts with severity, status, trigger type, audience reach */
const allAlerts = [
  { id: 'ALR-0501', title: 'Severe flooding — Algiers coastal road', zone: 'Algiers Centre', severity: 'critical', status: 'active', type: 'Weather', trigger: 'auto', duration: '4h remaining', created: '2025-01-18T06:00:00', audience: 12400 },
  { id: 'ALR-0500', title: 'Multi-vehicle collision — Highway E-W km120', zone: 'Sétif Corridor', severity: 'high', status: 'active', type: 'Incident', trigger: 'manual', duration: '2h remaining', created: '2025-01-18T07:15:00', audience: 8200 },
  { id: 'ALR-0499', title: 'Road construction — RN5 Blida exit', zone: 'Blida South', severity: 'medium', status: 'active', type: 'Roadwork', trigger: 'scheduled', duration: '3 days', created: '2025-01-16T08:00:00', audience: 5600 },
  { id: 'ALR-0498', title: 'Dense fog advisory — Constantine plateau', zone: 'Constantine', severity: 'medium', status: 'scheduled', type: 'Weather', trigger: 'scheduled', duration: 'Starts 05:00', created: '2025-01-17T22:00:00', audience: 7300 },
  { id: 'ALR-0497', title: 'Expired: Oran port road closure', zone: 'Oran Port', severity: 'low', status: 'expired', type: 'Roadwork', trigger: 'manual', duration: 'Expired', created: '2025-01-15T10:00:00', audience: 3100 },
  { id: 'ALR-0496', title: 'Icy road conditions — Batna mountain pass', zone: 'Batna', severity: 'high', status: 'active', type: 'Weather', trigger: 'auto', duration: '6h remaining', created: '2025-01-18T04:30:00', audience: 4500 },
]

/* Pre-built alert templates for quick creation with default durations */
const templates = [
  { name: 'Severe Weather', description: 'Standard weather advisory for extreme conditions', severity: 'high', defaultDuration: '6h' },
  { name: 'Road Closure', description: 'Full road closure notification', severity: 'medium', defaultDuration: '24h' },
  { name: 'Accident Zone', description: 'Active accident zone advisory', severity: 'high', defaultDuration: '4h' },
  { name: 'Construction', description: 'Long-term construction advisory', severity: 'low', defaultDuration: '7d' },
  { name: 'Emergency Evacuation', description: 'Critical — Immediate area evacuation', severity: 'critical', defaultDuration: '12h' },
]

/* Tab definitions — key maps to URL search param (?tab=<key>) */
const tabs = [
  { key: 'all', label: 'All Alerts' },
  { key: 'active', label: 'Active' },
  { key: 'scheduled', label: 'Scheduled' },
  { key: 'expired', label: 'Expiring / Expired' },
  { key: 'emergency', label: 'Emergency' },
  { key: 'templates', label: 'Templates' },
]

/* ═══════════════════════════════════════════════════════════
   COMPONENT
   ═══════════════════════════════════════════════════════════ */
export default function AdminAlertsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const currentTab = searchParams.get('tab') || 'all' // active tab from URL
  const [emergencyMode, setEmergencyMode] = useState(false)       // global emergency broadcast flag
  const [emergencyConfirm, setEmergencyConfirm] = useState(false) // controls confirmation modal visibility
  const [showCreate, setShowCreate] = useState(false)             // toggles create-alert form
  // Form state for new alert creation
  const [newAlert, setNewAlert] = useState({ title: '', zone: '', severity: 'medium', type: 'Incident', duration: '4h', message: '' })

  // Derive filtered alerts based on active tab
  const filtered = useMemo(() => {
    if (currentTab === 'active') return allAlerts.filter(a => a.status === 'active')
    if (currentTab === 'scheduled') return allAlerts.filter(a => a.status === 'scheduled')
    if (currentTab === 'expired') return allAlerts.filter(a => a.status === 'expired')
    if (currentTab === 'emergency') return allAlerts.filter(a => a.severity === 'critical')
    return allAlerts
  }, [currentTab])

  // Pre-compute counts per tab for badge display
  const tabCounts = {
    all: allAlerts.length,
    active: allAlerts.filter(a => a.status === 'active').length,
    scheduled: allAlerts.filter(a => a.status === 'scheduled').length,
    expired: allAlerts.filter(a => a.status === 'expired').length,
    emergency: allAlerts.filter(a => a.severity === 'critical').length,
    templates: templates.length,
  }

  // Toggle emergency mode; requires confirmation dialog before activating
  const handleEmergencyToggle = () => {
    if (!emergencyMode) {
      setEmergencyConfirm(true)
    } else {
      setEmergencyMode(false)
    }
  }

  return (
    <>
      {/* ═══ EMERGENCY MODE BANNER ═══ */}
      {/* Shown only when emergency mode is active — red prominent bar */}
      {/* Emergency Mode Banner */}
      {emergencyMode && (
        <div className="admin-critical-bar" style={{ background: 'rgba(239, 68, 68, 0.15)', borderColor: 'var(--admin-danger)' }}>
          <span className="critical-dot"></span>
          <span className="critical-text" style={{ color: 'var(--admin-danger)', fontWeight: 700 }}>
            EMERGENCY MODE ACTIVE — All alerts are broadcasting at maximum priority
          </span>
          <button className="critical-action" onClick={() => setEmergencyMode(false)}>Deactivate →</button>
        </div>
      )}

      {/* ═══ EMERGENCY CONFIRMATION MODAL ═══ */}
      {/* Full-screen overlay with confirm/cancel — warns about SMS/push impact */}
      {/* Confirmation Modal */}
      {emergencyConfirm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="admin-card" style={{ width: 420, padding: 24 }}>
            <h3 style={{ color: 'var(--admin-danger)', fontSize: 16, marginBottom: 8 }}>⚠ Activate Emergency Mode?</h3>
            <p style={{ fontSize: 12, color: 'var(--admin-text-secondary)', lineHeight: 1.7, marginBottom: 16 }}>
              This will immediately broadcast all active alerts at maximum priority to ALL users in affected zones.
              Push notifications, SMS and in-app alerts will be triggered. This action is logged and audited.
            </p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="admin-btn admin-btn-ghost" onClick={() => setEmergencyConfirm(false)}>Cancel</button>
              <button className="admin-btn admin-btn-danger" onClick={() => { setEmergencyMode(true); setEmergencyConfirm(false) }}>
                Confirm Activation
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ PAGE HEADER ═══ */}
      {/* Emergency toggle switch + New Alert CTA */}
      <div className="admin-page-header">
        <div>
          <h1 className="admin-page-title">Alert Operations</h1>
          <p className="admin-page-subtitle">Manage geo-based alerts, emergency broadcasts and notifications</p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px', borderRadius: 6, background: emergencyMode ? 'rgba(239, 68, 68, 0.12)' : 'var(--admin-surface-alt)', border: `1px solid ${emergencyMode ? 'var(--admin-danger)' : 'var(--admin-border)'}` }}>
            <span style={{ fontSize: 11, color: emergencyMode ? 'var(--admin-danger)' : 'var(--admin-text-muted)', fontWeight: 600 }}>Emergency Mode</span>
            <div className={`admin-toggle ${emergencyMode ? 'active' : ''}`} onClick={handleEmergencyToggle}>
              <div className="admin-toggle-thumb"></div>
            </div>
          </div>
          <button className="admin-btn admin-btn-primary" onClick={() => setShowCreate(!showCreate)}>
            + New Alert
          </button>
        </div>
      </div>

      {/* ═══ CREATE ALERT FORM ═══ */}
      {/* Collapsible 3-column grid: title, zone, severity, type, duration, publish CTA + message textarea */}
      {/* Create Alert Form */}
      {showCreate && (
        <div className="admin-card" style={{ marginBottom: 14 }}>
          <h3 className="admin-card-title">Create New Alert</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginTop: 12 }}>
            <div>
              <label className="admin-form-label">Title</label>
              <input className="admin-input" type="text" value={newAlert.title} onChange={e => setNewAlert({ ...newAlert, title: e.target.value })} placeholder="Alert title…" />
            </div>
            <div>
              <label className="admin-form-label">Zone</label>
              <select className="admin-select" value={newAlert.zone} onChange={e => setNewAlert({ ...newAlert, zone: e.target.value })}>
                <option value="">Select zone…</option>
                <option value="Algiers Centre">Algiers Centre</option>
                <option value="Oran">Oran</option>
                <option value="Constantine">Constantine</option>
                <option value="Blida">Blida</option>
                <option value="Sétif">Sétif</option>
                <option value="Annaba">Annaba</option>
                <option value="Batna">Batna</option>
                <option value="Tlemcen">Tlemcen</option>
                <option value="National">National (All zones)</option>
              </select>
            </div>
            <div>
              <label className="admin-form-label">Severity</label>
              <select className="admin-select" value={newAlert.severity} onChange={e => setNewAlert({ ...newAlert, severity: e.target.value })}>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </div>
            <div>
              <label className="admin-form-label">Type</label>
              <select className="admin-select" value={newAlert.type} onChange={e => setNewAlert({ ...newAlert, type: e.target.value })}>
                <option value="Incident">Incident</option>
                <option value="Weather">Weather</option>
                <option value="Roadwork">Roadwork</option>
                <option value="Hazard">Hazard</option>
                <option value="Emergency">Emergency</option>
              </select>
            </div>
            <div>
              <label className="admin-form-label">Duration</label>
              <select className="admin-select" value={newAlert.duration} onChange={e => setNewAlert({ ...newAlert, duration: e.target.value })}>
                <option value="1h">1 hour</option>
                <option value="4h">4 hours</option>
                <option value="12h">12 hours</option>
                <option value="24h">24 hours</option>
                <option value="3d">3 days</option>
                <option value="7d">7 days</option>
                <option value="custom">Custom…</option>
              </select>
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end' }}>
              <button className="admin-btn admin-btn-primary admin-btn-full" onClick={() => { alert('Alert created'); setShowCreate(false) }}>
                Publish Alert
              </button>
            </div>
          </div>
          <div style={{ marginTop: 10 }}>
            <label className="admin-form-label">Message Body</label>
            <textarea className="admin-input" rows={2} value={newAlert.message} onChange={e => setNewAlert({ ...newAlert, message: e.target.value })} placeholder="Alert message body…" style={{ resize: 'vertical', minHeight: 48 }} />
          </div>
        </div>
      )}

      {/* ═══ TAB BAR ═══ */}
      {/* Tabs */}
      <div className="admin-tabs" style={{ marginBottom: 12 }}>
        {tabs.map(t => (
          <button key={t.key}
            className={`admin-tab ${currentTab === t.key ? 'active' : ''}`}
            onClick={() => setSearchParams(t.key === 'all' ? {} : { tab: t.key })}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ═══ TEMPLATES GALLERY ═══ */}
      {/* When Templates tab is active, show card grid; otherwise show alerts table */}
      {/* Templates Tab */}
      {currentTab === 'templates' ? (
        <div className="admin-grid-3">
          {templates.map((t) => (
            <div className="admin-card" key={t.name}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <h3 className="admin-card-title">{t.name}</h3>
                <span className={`admin-pill ${t.severity}`}>{t.severity}</span>
              </div>
              <p style={{ fontSize: 11, color: 'var(--admin-text-muted)', marginTop: 6, lineHeight: 1.5 }}>{t.description}</p>
              <div style={{ marginTop: 10, fontSize: 10.5, color: 'var(--admin-text-secondary)' }}>Default duration: {t.defaultDuration}</div>
              <button className="admin-btn admin-btn-ghost admin-btn-full" style={{ marginTop: 10 }}>
                Use Template →
              </button>
            </div>
          ))}
        </div>
      ) : (
        /* ═══ ALERTS TABLE ═══ */
        /* Full CRUD table: ID, title, zone, severity, type, trigger, duration, audience, status, actions */
        /* Alerts Table */
        <div className="admin-card">
          <div className="admin-table-wrapper">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Title</th>
                  <th>Zone</th>
                  <th>Severity</th>
                  <th>Type</th>
                  <th>Trigger</th>
                  <th>Duration</th>
                  <th>Audience</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(alert => (
                  <tr key={alert.id}>
                    <td style={{ fontWeight: 600, fontSize: 11, fontVariantNumeric: 'tabular-nums' }}>{alert.id}</td>
                    <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 11.5 }}>{alert.title}</td>
                    <td style={{ fontSize: 11 }}>{alert.zone}</td>
                    <td><span className={`admin-pill ${alert.severity}`}>{alert.severity}</span></td>
                    <td style={{ fontSize: 11 }}>{alert.type}</td>
                    <td><span className={`admin-pill ${alert.trigger}`}>{alert.trigger}</span></td>
                    <td style={{ fontSize: 11, fontVariantNumeric: 'tabular-nums' }}>{alert.duration}</td>
                    <td style={{ fontSize: 11, fontVariantNumeric: 'tabular-nums' }}>{alert.audience.toLocaleString()}</td>
                    <td><span className={`admin-pill ${alert.status}`}>{alert.status}</span></td>
                    <td>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button className="admin-btn admin-btn-sm admin-btn-ghost">Edit</button>
                        {alert.status === 'active' && (
                          <button className="admin-btn admin-btn-sm admin-btn-danger">Expire</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={10} style={{ textAlign: 'center', padding: 32, color: 'var(--admin-text-muted)' }}>No alerts in this category</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  )
}

import React, { useState } from 'react'
import { useSearchParams } from 'react-router-dom'

/* ── Mock settings data ── */
const severityRules = [
  { id: 1, name: 'Multi-vehicle collision', autoSeverity: 'high', minConfidence: 80, enabled: true },
  { id: 2, name: 'Pedestrian incident', autoSeverity: 'high', minConfidence: 70, enabled: true },
  { id: 3, name: 'Weather hazard', autoSeverity: 'medium', minConfidence: 65, enabled: true },
  { id: 4, name: 'Roadwork obstruction', autoSeverity: 'low', minConfidence: 60, enabled: true },
  { id: 5, name: 'Traffic congestion', autoSeverity: 'low', minConfidence: 50, enabled: false },
  { id: 6, name: 'Night-time incident', autoSeverity: 'medium', minConfidence: 60, enabled: true },
]

const notificationChannels = [
  { name: 'Push Notifications', enabled: true, minSeverity: 'medium', description: 'Mobile push alerts to affected users' },
  { name: 'SMS Alerts', enabled: true, minSeverity: 'high', description: 'SMS to registered users in zone' },
  { name: 'In-App Banner', enabled: true, minSeverity: 'low', description: 'Non-intrusive banner in the Siara app' },
  { name: 'Email Digest', enabled: false, minSeverity: 'medium', description: 'Daily email summary of incidents' },
  { name: 'Webhook (External)', enabled: false, minSeverity: 'high', description: 'POST to external API endpoints' },
]

const geoFenceRules = [
  { id: 1, name: 'Algiers Metro Area', radius: 15, unit: 'km', events: ['collision', 'weather'], active: true },
  { id: 2, name: 'Highway E-W Corridor', radius: 5, unit: 'km', events: ['collision', 'roadwork'], active: true },
  { id: 3, name: 'Port Zones (Oran, Annaba)', radius: 8, unit: 'km', events: ['hazard'], active: true },
  { id: 4, name: 'University Districts', radius: 3, unit: 'km', events: ['collision', 'traffic'], active: false },
]

const tabs = [
  { key: 'severity', label: 'Severity Rules' },
  { key: 'notifications', label: 'Notification Logic' },
  { key: 'geofencing', label: 'Geo-fencing' },
  { key: 'general', label: 'General' },
]

export default function AdminSystemSettingsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const currentTab = searchParams.get('tab') || 'severity'
  const [autoApprove, setAutoApprove] = useState(false)
  const [maintenanceMode, setMaintenanceMode] = useState(false)

  return (
    <>
      <div className="admin-page-header">
        <div>
          <h1 className="admin-page-title">System Settings</h1>
          <p className="admin-page-subtitle">Configure severity rules, notifications, geo-fencing and system behavior</p>
        </div>
        <button className="admin-btn admin-btn-ghost">Reset to Defaults</button>
      </div>

      <div className="admin-tabs" style={{ marginBottom: 14 }}>
        {tabs.map(t => (
          <button key={t.key}
            className={`admin-tab ${currentTab === t.key ? 'active' : ''}`}
            onClick={() => setSearchParams({ tab: t.key })}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Severity Rules Tab */}
      {currentTab === 'severity' && (
        <div className="admin-card">
          <div className="admin-card-header">
            <div>
              <h3 className="admin-card-title">Auto-Classification Severity Rules</h3>
              <p className="admin-card-subtitle">Define thresholds for AI auto-severity assignment</p>
            </div>
            <button className="admin-btn admin-btn-primary">+ Add Rule</button>
          </div>
          <div className="admin-table-wrapper" style={{ marginTop: 12 }}>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Rule Name</th>
                  <th>Auto Severity</th>
                  <th>Min. Confidence</th>
                  <th>Enabled</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {severityRules.map(rule => (
                  <tr key={rule.id}>
                    <td style={{ fontWeight: 500, fontSize: 12 }}>{rule.name}</td>
                    <td><span className={`admin-pill ${rule.autoSeverity}`}>{rule.autoSeverity}</span></td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <input className="admin-input" type="number" defaultValue={rule.minConfidence} min={0} max={100} style={{ width: 56, height: 28, textAlign: 'center', fontSize: 11.5 }} />
                        <span style={{ fontSize: 10.5, color: 'var(--admin-text-muted)' }}>%</span>
                      </div>
                    </td>
                    <td>
                      <div className={`admin-toggle small ${rule.enabled ? 'active' : ''}`}>
                        <div className="admin-toggle-thumb"></div>
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button className="admin-btn admin-btn-sm admin-btn-ghost">Edit</button>
                        <button className="admin-btn admin-btn-sm admin-btn-danger">Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Notification Logic Tab */}
      {currentTab === 'notifications' && (
        <div className="admin-card">
          <h3 className="admin-card-title">Notification Channels</h3>
          <p className="admin-card-subtitle">Configure how alerts reach end users</p>
          <div style={{ marginTop: 14 }}>
            {notificationChannels.map((ch, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 0', borderBottom: '1px solid var(--admin-border)' }}>
                <div className={`admin-toggle ${ch.enabled ? 'active' : ''}`}>
                  <div className="admin-toggle-thumb"></div>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--admin-text)' }}>{ch.name}</div>
                  <div style={{ fontSize: 10.5, color: 'var(--admin-text-muted)', marginTop: 2 }}>{ch.description}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 10, color: 'var(--admin-text-muted)' }}>Min. Severity:</span>
                  <select className="admin-select" defaultValue={ch.minSeverity} style={{ width: 100, height: 28, fontSize: 11 }}>
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="critical">Critical</option>
                  </select>
                </div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 14, display: 'flex', justifyContent: 'flex-end' }}>
            <button className="admin-btn admin-btn-primary">Save Notification Settings</button>
          </div>
        </div>
      )}

      {/* Geo-fencing Tab */}
      {currentTab === 'geofencing' && (
        <div className="admin-card">
          <div className="admin-card-header">
            <div>
              <h3 className="admin-card-title">Geo-fence Rules</h3>
              <p className="admin-card-subtitle">Define geographic boundaries for targeted alert delivery</p>
            </div>
            <button className="admin-btn admin-btn-primary">+ Add Rule</button>
          </div>
          <div className="admin-table-wrapper" style={{ marginTop: 12 }}>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Rule Name</th>
                  <th>Radius</th>
                  <th>Event Types</th>
                  <th>Active</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {geoFenceRules.map(rule => (
                  <tr key={rule.id}>
                    <td style={{ fontWeight: 500, fontSize: 12 }}>{rule.name}</td>
                    <td style={{ fontVariantNumeric: 'tabular-nums', fontSize: 11.5 }}>{rule.radius} {rule.unit}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                        {rule.events.map(e => (
                          <span key={e} className="admin-pill" style={{ fontSize: 9.5 }}>{e}</span>
                        ))}
                      </div>
                    </td>
                    <td>
                      <div className={`admin-toggle small ${rule.active ? 'active' : ''}`}>
                        <div className="admin-toggle-thumb"></div>
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button className="admin-btn admin-btn-sm admin-btn-ghost">Edit</button>
                        <button className="admin-btn admin-btn-sm admin-btn-danger">Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* General Tab */}
      {currentTab === 'general' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="admin-card">
            <h3 className="admin-card-title">System Controls</h3>
            <div style={{ marginTop: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid var(--admin-border)' }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600 }}>Auto-Approve Low Confidence Reports</div>
                  <div style={{ fontSize: 10.5, color: 'var(--admin-text-muted)', marginTop: 2 }}>Automatically approve reports with AI confidence above 95%</div>
                </div>
                <div className={`admin-toggle ${autoApprove ? 'active' : ''}`} onClick={() => setAutoApprove(!autoApprove)}>
                  <div className="admin-toggle-thumb"></div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid var(--admin-border)' }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600 }}>Maintenance Mode</div>
                  <div style={{ fontSize: 10.5, color: 'var(--admin-text-muted)', marginTop: 2 }}>Disable all public-facing features for maintenance</div>
                </div>
                <div className={`admin-toggle ${maintenanceMode ? 'active' : ''}`} onClick={() => setMaintenanceMode(!maintenanceMode)}>
                  <div className="admin-toggle-thumb"></div>
                </div>
              </div>
            </div>
          </div>

          <div className="admin-card">
            <h3 className="admin-card-title">Data Retention</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
              <div>
                <label className="admin-form-label">Incident Archive After</label>
                <select className="admin-select">
                  <option>30 days</option>
                  <option>60 days</option>
                  <option>90 days</option>
                  <option>1 year</option>
                  <option>Never</option>
                </select>
              </div>
              <div>
                <label className="admin-form-label">Audit Log Retention</label>
                <select className="admin-select">
                  <option>1 year</option>
                  <option>2 years</option>
                  <option>5 years</option>
                  <option>Indefinite</option>
                </select>
              </div>
            </div>
          </div>

          <div className="admin-card">
            <h3 className="admin-card-title">API Configuration</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
              <div>
                <label className="admin-form-label">Rate Limit (requests/min)</label>
                <input className="admin-input" type="number" defaultValue={100} />
              </div>
              <div>
                <label className="admin-form-label">Max Upload Size (MB)</label>
                <input className="admin-input" type="number" defaultValue={10} />
              </div>
            </div>
            <div style={{ marginTop: 14, display: 'flex', justifyContent: 'flex-end' }}>
              <button className="admin-btn admin-btn-primary">Save Settings</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

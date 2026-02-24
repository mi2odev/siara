import React from 'react'
import { useNavigate } from 'react-router-dom'

export default function AdminContextPanel() {
  const navigate = useNavigate()

  return (
    <aside className="admin-ctx-panel">
      {/* Live Intelligence */}
      <div className="admin-ctx-title">Live Intelligence</div>

      <div className="admin-ctx-card">
        <h4>🔴 Critical Alert Active</h4>
        <p>Major collision on Blvd Zirout Youcef — Algiers Centre. 3 pending reviews.</p>
        <button
          className="admin-btn admin-btn-sm admin-btn-danger"
          style={{ marginTop: 8, width: '100%' }}
          onClick={() => navigate('/admin/incidents/INC-2401')}
        >
          Review Now
        </button>
      </div>

      <div className="admin-ctx-card">
        <h4>📊 AI Health</h4>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
          <span>Accuracy</span>
          <span style={{ fontWeight: 700, color: 'var(--admin-success)' }}>92.4%</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
          <span>Avg Confidence</span>
          <span style={{ fontWeight: 700, color: 'var(--admin-text)' }}>78.2%</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>Model Drift</span>
          <span style={{ fontWeight: 700, color: 'var(--admin-success)' }}>Normal</span>
        </div>
      </div>

      <div className="admin-ctx-card">
        <h4>⚡ Queue Load</h4>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
          <span>Pending Reviews</span>
          <span style={{ fontWeight: 700, color: 'var(--admin-warning)' }}>8</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
          <span>Oldest Unreviewed</span>
          <span style={{ fontWeight: 700, color: 'var(--admin-danger)' }}>2h 14m</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>Avg Review Time</span>
          <span style={{ fontWeight: 700, color: 'var(--admin-text)' }}>18m</span>
        </div>
      </div>

      <div className="admin-ctx-title" style={{ marginTop: 16 }}>Risk Zones</div>

      <div className="admin-ctx-card">
        <h4 style={{ color: 'var(--admin-danger)' }}>▲ Algiers Centre</h4>
        <p>42 incidents (30d) · AI Score: 87 · Trend: Rising</p>
      </div>
      <div className="admin-ctx-card">
        <h4 style={{ color: 'var(--admin-danger)' }}>▲ Oran Industrial Port</h4>
        <p>28 incidents (30d) · AI Score: 82 · Trend: Stable</p>
      </div>
      <div className="admin-ctx-card">
        <h4 style={{ color: 'var(--admin-warning)' }}>◆ Constantine University</h4>
        <p>18 incidents (30d) · AI Score: 58 · Trend: Declining</p>
      </div>

      <div className="admin-ctx-title" style={{ marginTop: 16 }}>Recent Activity</div>

      <div className="admin-audit-row">
        <span className="admin-audit-dot"></span>
        <span className="admin-audit-time">2m</span>
        <span className="admin-audit-event">
          <span className="admin-audit-actor">Admin A</span> approved INC-2398
        </span>
      </div>
      <div className="admin-audit-row">
        <span className="admin-audit-dot" style={{ background: 'var(--admin-warning)' }}></span>
        <span className="admin-audit-time">8m</span>
        <span className="admin-audit-event">
          <span className="admin-audit-actor">System</span> AI confidence dropped to 72% on INC-2397
        </span>
      </div>
      <div className="admin-audit-row">
        <span className="admin-audit-dot" style={{ background: 'var(--admin-danger)' }}></span>
        <span className="admin-audit-time">12m</span>
        <span className="admin-audit-event">
          <span className="admin-audit-actor">Admin B</span> triggered emergency broadcast for Algiers
        </span>
      </div>
      <div className="admin-audit-row">
        <span className="admin-audit-dot"></span>
        <span className="admin-audit-time">25m</span>
        <span className="admin-audit-event">
          <span className="admin-audit-actor">Admin A</span> overrode INC-2390 severity: high → medium
        </span>
      </div>
    </aside>
  )
}

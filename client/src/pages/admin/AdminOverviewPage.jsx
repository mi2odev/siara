import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'

/* ── Mock data ── */
const liveIncidents = [
  { id: 'INC-2401', location: 'Blvd Zirout Youcef, Algiers', severity: 'high', confidence: 94, status: 'pending', type: 'Collision', reporter: 'ahmed_b', reliability: 92, time: '08:34', ago: '12m' },
  { id: 'INC-2400', location: 'RN11 Industrial Zone, Oran', severity: 'medium', confidence: 78, status: 'pending', type: 'Roadwork', reporter: 'fatima_k', reliability: 88, time: '07:18', ago: '1h 28m' },
  { id: 'INC-2399', location: 'East-West Highway km120', severity: 'high', confidence: 91, status: 'pending', type: 'Collision', reporter: 'yacine_m', reliability: 95, time: '06:55', ago: '1h 51m' },
  { id: 'INC-2398', location: 'University Dist., Constantine', severity: 'low', confidence: 65, status: 'verified', type: 'Weather', reporter: 'nour_l', reliability: 96, time: '06:02', ago: '2h 44m' },
  { id: 'INC-2397', location: 'El Harrach Bridge, Algiers', severity: 'high', confidence: 88, status: 'flagged', type: 'Collision', reporter: 'amine_r', reliability: 34, time: '05:47', ago: '2h 59m' },
  { id: 'INC-2396', location: 'Place des Martyrs, Algiers', severity: 'medium', confidence: 72, status: 'pending', type: 'Traffic', reporter: 'sara_z', reliability: 90, time: '04:15', ago: '4h 31m' },
  { id: 'INC-2395', location: 'Route Nationale 5, Blida', severity: 'low', confidence: 58, status: 'rejected', type: 'False alarm', reporter: 'karim_d', reliability: 22, time: '03:30', ago: '5h 16m' },
]

const criticalAlerts = [
  { text: '3 unreviewed high-severity incidents older than 1 hour', action: 'Review Queue' },
  { text: 'AI confidence below 70% on 2 recent predictions', action: 'View AI' },
]

export default function AdminOverviewPage() {
  const navigate = useNavigate()
  const [timeRange, setTimeRange] = useState('24h')

  const pendingCount = liveIncidents.filter(i => i.status === 'pending').length

  return (
    <>
      {/* Critical Bar */}
      {criticalAlerts.map((alert, i) => (
        <div className="admin-critical-bar" key={i}>
          <span className="critical-dot"></span>
          <span className="critical-text">{alert.text}</span>
          <button className="critical-action" onClick={() => navigate(i === 0 ? '/admin/incidents' : '/admin/ai')}>
            {alert.action} →
          </button>
        </div>
      ))}

      {/* Header */}
      <div className="admin-page-header">
        <div>
          <h1 className="admin-page-title">System Overview</h1>
          <p className="admin-page-subtitle">National Risk Supervision — Real-time</p>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <select className="admin-select" value={timeRange} onChange={(e) => setTimeRange(e.target.value)}>
            <option value="1h">Last hour</option>
            <option value="24h">Last 24h</option>
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
          </select>
          <button className="admin-btn admin-btn-ghost">Export</button>
        </div>
      </div>

      {/* KPI Grid — 6 metrics */}
      <div className="admin-kpi-grid" style={{ gridTemplateColumns: 'repeat(6, 1fr)' }}>
        <div className="admin-kpi">
          <div className="admin-kpi-icon danger">⚡</div>
          <div className="admin-kpi-body">
            <span className="admin-kpi-label">Incidents 24h</span>
            <span className="admin-kpi-value">47</span>
            <span className="admin-kpi-trend up">↑ 12%</span>
          </div>
        </div>
        <div className="admin-kpi">
          <div className="admin-kpi-icon warning">◷</div>
          <div className="admin-kpi-body">
            <span className="admin-kpi-label">Pending Review</span>
            <span className="admin-kpi-value">{pendingCount}</span>
            <span className="admin-kpi-trend up">↑ 3 new</span>
          </div>
        </div>
        <div className="admin-kpi">
          <div className="admin-kpi-icon primary">◇</div>
          <div className="admin-kpi-body">
            <span className="admin-kpi-label">AI Confidence</span>
            <span className="admin-kpi-value">78.2%</span>
            <span className="admin-kpi-trend stable">— stable</span>
          </div>
        </div>
        <div className="admin-kpi">
          <div className="admin-kpi-icon danger">◈</div>
          <div className="admin-kpi-body">
            <span className="admin-kpi-label">High Risk Zones</span>
            <span className="admin-kpi-value">8</span>
            <span className="admin-kpi-trend down">↓ 2</span>
          </div>
        </div>
        <div className="admin-kpi">
          <div className="admin-kpi-icon success">▲</div>
          <div className="admin-kpi-body">
            <span className="admin-kpi-label">Active Alerts</span>
            <span className="admin-kpi-value">34</span>
            <span className="admin-kpi-trend stable">— normal</span>
          </div>
        </div>
        <div className="admin-kpi">
          <div className="admin-kpi-icon info">◫</div>
          <div className="admin-kpi-body">
            <span className="admin-kpi-label">Reports/min</span>
            <span className="admin-kpi-value">2.4</span>
            <span className="admin-kpi-trend up">↑ 0.3</span>
          </div>
        </div>
      </div>

      {/* Review Queue Table */}
      <div className="admin-card" style={{ marginBottom: 14 }}>
        <div className="admin-card-header">
          <div>
            <h2 className="admin-card-title">Review Queue</h2>
            <p className="admin-card-subtitle">Sorted by risk score (descending) · {pendingCount} pending</p>
          </div>
          <button className="admin-btn admin-btn-primary" onClick={() => navigate('/admin/incidents')}>
            View All →
          </button>
        </div>
        <div className="admin-table-wrapper">
          <table className="admin-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Location</th>
                <th>AI Severity</th>
                <th>Confidence</th>
                <th>Reporter Score</th>
                <th>Since Reported</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {[...liveIncidents].sort((a, b) => b.confidence - a.confidence).map((inc) => (
                <tr key={inc.id}>
                  <td style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{inc.id}</td>
                  <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{inc.location}</td>
                  <td><span className={`admin-pill ${inc.severity}`}>{inc.severity}</span></td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div className="admin-progress" style={{ width: 48 }}>
                        <div className={`admin-progress-fill ${inc.confidence >= 85 ? 'success' : inc.confidence >= 65 ? 'warning' : 'danger'}`} style={{ width: `${inc.confidence}%` }}></div>
                      </div>
                      <span style={{ fontSize: 11, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{inc.confidence}%</span>
                    </div>
                  </td>
                  <td>
                    <span style={{ fontWeight: 600, color: inc.reliability >= 80 ? 'var(--admin-success)' : inc.reliability >= 50 ? 'var(--admin-warning)' : 'var(--admin-danger)' }}>
                      {inc.reliability}%
                    </span>
                  </td>
                  <td style={{ fontVariantNumeric: 'tabular-nums', fontSize: 11.5, color: inc.ago.includes('h') ? 'var(--admin-warning)' : 'var(--admin-text-secondary)' }}>
                    {inc.ago}
                  </td>
                  <td><span className={`admin-pill ${inc.status}`}>{inc.status}</span></td>
                  <td>
                    <button className="admin-btn admin-btn-sm admin-btn-primary" onClick={() => navigate(`/admin/incidents/${inc.id}`)}>
                      Review
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Bottom Grid — compressed stats */}
      <div className="admin-grid-3">
        <div className="admin-card">
          <h3 className="admin-card-title">Weekly Incident Volume</h3>
          <div className="admin-chart-placeholder" style={{ height: 120 }}>
            {[40, 65, 30, 80, 55, 90, 47].map((h, i) => (
              <div key={i} className="admin-chart-bar" style={{ height: `${h}%` }}></div>
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9.5, color: 'var(--admin-text-muted)', padding: '0 2px' }}>
            {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(d => <span key={d}>{d}</span>)}
          </div>
        </div>

        <div className="admin-card">
          <h3 className="admin-card-title">Severity Distribution</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 }}>
            {[
              { label: 'Critical / High', pct: 38, cls: 'danger' },
              { label: 'Medium', pct: 35, cls: 'warning' },
              { label: 'Low', pct: 27, cls: 'success' },
            ].map((s) => (
              <div key={s.label}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 4 }}>
                  <span style={{ color: 'var(--admin-text-secondary)' }}>{s.label}</span>
                  <span style={{ fontWeight: 600 }}>{s.pct}%</span>
                </div>
                <div className="admin-progress">
                  <div className={`admin-progress-fill ${s.cls}`} style={{ width: `${s.pct}%` }}></div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="admin-card">
          <h3 className="admin-card-title">Top Risk Zones</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
            {[
              { zone: 'Algiers Centre', incidents: 18, risk: 'high' },
              { zone: 'Oran Industrial', incidents: 12, risk: 'high' },
              { zone: 'Constantine Univ.', incidents: 7, risk: 'medium' },
              { zone: 'Blida Highway', incidents: 5, risk: 'medium' },
            ].map((z) => (
              <div key={z.zone} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--admin-border)' }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--admin-text)' }}>{z.zone}</div>
                  <div style={{ fontSize: 10, color: 'var(--admin-text-muted)' }}>{z.incidents} incidents</div>
                </div>
                <span className={`admin-pill ${z.risk}`}>{z.risk}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  )
}

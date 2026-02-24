import React, { useState } from 'react'
import { useSearchParams } from 'react-router-dom'

/* ── Mock analytics data ── */
const hourlyHeatmap = [
  /* rows = days (Mon-Sun), cols = hours (0-23) */
  [0,0,0,0,1,2,5,8,12,10,6,4,3,4,5,7,9,11,8,5,3,1,0,0],
  [0,0,0,1,1,3,6,9,14,11,7,5,4,5,6,8,10,12,9,6,3,2,1,0],
  [0,0,0,0,0,2,4,7,10,8,5,3,2,3,4,6,8,9,7,4,2,1,0,0],
  [0,0,1,1,2,4,8,12,18,14,9,7,5,6,7,10,14,16,12,8,5,3,1,0],
  [0,1,1,2,3,5,9,14,20,16,11,8,6,7,8,12,15,18,14,9,6,4,2,1],
  [1,1,2,3,4,6,10,15,22,18,12,9,7,8,10,14,18,21,16,11,7,5,3,2],
  [0,0,1,1,2,4,7,10,15,12,8,6,4,5,6,9,12,14,10,7,4,2,1,0],
]
const dayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const maxHeatVal = 22

const severityDistribution = [
  { label: 'Critical', count: 23, pct: 8, color: '#DC2626' },
  { label: 'High', count: 89, pct: 30, color: '#EF4444' },
  { label: 'Medium', count: 104, pct: 35, color: '#F59E0B' },
  { label: 'Low', count: 80, pct: 27, color: '#22C55E' },
]

const dangerousRoads = [
  { road: 'East-West Highway (km 80-160)', incidents: 34, severity: 'high', type: 'Collision' },
  { road: 'RN1 Algiers — Blida', incidents: 28, severity: 'high', type: 'Multi-vehicle' },
  { road: 'RN11 Oran Industrial Z.', incidents: 21, severity: 'medium', type: 'Roadwork' },
  { road: 'RN5 Sétif — Constantine', incidents: 18, severity: 'medium', type: 'Weather' },
  { road: 'Algiers Coastal Road', incidents: 15, severity: 'high', type: 'Flooding' },
  { road: 'Batna Mountain Pass (RN31)', incidents: 14, severity: 'high', type: 'Icy road' },
  { road: 'Tlemcen — Oran (RN22)', incidents: 9, severity: 'low', type: 'Traffic' },
  { road: 'Annaba Port Access', incidents: 7, severity: 'low', type: 'Roadwork' },
]

const weatherCorrelation = [
  { condition: 'Clear', incidents: 112, pctOfTotal: 38 },
  { condition: 'Rain', incidents: 98, pctOfTotal: 33 },
  { condition: 'Fog', incidents: 42, pctOfTotal: 14 },
  { condition: 'Strong Wind', incidents: 28, pctOfTotal: 9 },
  { condition: 'Snow / Ice', incidents: 16, pctOfTotal: 5 },
]

const roadTypeCorrelation = [
  { type: 'Highway / Autoroute', incidents: 124, pct: 42 },
  { type: 'National Road (RN)', incidents: 89, pct: 30 },
  { type: 'Urban / City', incidents: 56, pct: 19 },
  { type: 'Rural / Mountain', incidents: 27, pct: 9 },
]

const weeklyTrend = [
  { day: 'Mon', actual: 40, predicted: 38 },
  { day: 'Tue', actual: 65, predicted: 60 },
  { day: 'Wed', actual: 30, predicted: 35 },
  { day: 'Thu', actual: 80, predicted: 75 },
  { day: 'Fri', actual: 55, predicted: 58 },
  { day: 'Sat', actual: 90, predicted: 85 },
  { day: 'Sun', actual: 47, predicted: 50 },
  { day: 'Mon+', actual: null, predicted: 42 },
  { day: 'Tue+', actual: null, predicted: 63 },
  { day: 'Wed+', actual: null, predicted: 33 },
  { day: 'Thu+', actual: null, predicted: 78 },
  { day: 'Fri+', actual: null, predicted: 55 },
  { day: 'Sat+', actual: null, predicted: 88 },
  { day: 'Sun+', actual: null, predicted: 48 },
]
const maxTrend = 90

const tabs = [
  { key: 'heatmap', label: 'Hourly Heatmap' },
  { key: 'severity', label: 'Severity Distribution' },
  { key: 'roads', label: 'Dangerous Roads' },
  { key: 'correlations', label: 'Correlations' },
  { key: 'predictions', label: '7-Day Prediction' },
]

export default function AdminAnalyticsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const currentTab = searchParams.get('tab') || 'heatmap'

  return (
    <>
      <div className="admin-page-header">
        <div>
          <h1 className="admin-page-title">Advanced Analytics</h1>
          <p className="admin-page-subtitle">Data-driven insights — Incident patterns, risk correlations & predictions</p>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <select className="admin-select" style={{ height: 32 }}>
            <option>Last 30 days</option>
            <option>Last 90 days</option>
            <option>Last 6 months</option>
            <option>Last year</option>
          </select>
          <button className="admin-btn admin-btn-ghost">Export PDF</button>
        </div>
      </div>

      {/* Summary KPIs */}
      <div className="admin-kpi-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginBottom: 14 }}>
        {[
          { label: 'Total Incidents', value: '296', trend: '↑ 12% vs prev.', cls: 'up' },
          { label: 'Avg. per Day', value: '9.9', trend: '↑ 0.8', cls: 'up' },
          { label: 'Peak Hour', value: '08:00–09:00', trend: '22 incidents', cls: 'stable' },
          { label: 'Most Dangerous', value: 'E-W Highway', trend: '34 incidents', cls: 'up' },
        ].map(k => (
          <div className="admin-kpi" key={k.label}>
            <div className="admin-kpi-body">
              <span className="admin-kpi-label">{k.label}</span>
              <span className="admin-kpi-value">{k.value}</span>
              <span className={`admin-kpi-trend ${k.cls}`}>{k.trend}</span>
            </div>
          </div>
        ))}
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

      {/* Heatmap Tab */}
      {currentTab === 'heatmap' && (
        <div className="admin-card">
          <h3 className="admin-card-title">Incidents by Hour & Day</h3>
          <p className="admin-card-subtitle">Color intensity indicates incident volume. Hover for details.</p>
          <div style={{ overflowX: 'auto', marginTop: 14 }}>
            <div className="admin-heatmap-grid">
              {/* Header row */}
              <div className="admin-heatmap-label"></div>
              {Array.from({ length: 24 }, (_, h) => (
                <div key={h} className="admin-heatmap-header">{String(h).padStart(2, '0')}</div>
              ))}
              {/* Data rows */}
              {hourlyHeatmap.map((row, ri) => (
                <React.Fragment key={ri}>
                  <div className="admin-heatmap-label">{dayLabels[ri]}</div>
                  {row.map((val, ci) => {
                    const intensity = val / maxHeatVal
                    return (
                      <div
                        key={ci}
                        className="admin-heatmap-cell"
                        title={`${dayLabels[ri]} ${String(ci).padStart(2, '0')}:00 — ${val} incidents`}
                        style={{
                          background: val === 0
                            ? 'var(--admin-surface-alt)'
                            : `rgba(59, 130, 246, ${0.15 + intensity * 0.75})`,
                          color: intensity > 0.5 ? '#fff' : 'var(--admin-text-muted)',
                        }}
                      >
                        {val > 0 ? val : ''}
                      </div>
                    )
                  })}
                </React.Fragment>
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, fontSize: 10, color: 'var(--admin-text-muted)' }}>
            <span>Low</span>
            <div style={{ display: 'flex', gap: 2 }}>
              {[0.15, 0.30, 0.45, 0.60, 0.75, 0.90].map((o, i) => (
                <div key={i} style={{ width: 20, height: 10, borderRadius: 2, background: `rgba(59, 130, 246, ${o})` }}></div>
              ))}
            </div>
            <span>High</span>
          </div>
        </div>
      )}

      {/* Severity Distribution Tab */}
      {currentTab === 'severity' && (
        <div className="admin-card">
          <h3 className="admin-card-title">Severity Distribution</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginTop: 16 }}>
            <div>
              {severityDistribution.map(s => (
                <div key={s.label} style={{ marginBottom: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: s.color }}>{s.label}</span>
                    <span style={{ fontSize: 12, fontWeight: 600 }}>{s.count} <span style={{ color: 'var(--admin-text-muted)', fontWeight: 400 }}>({s.pct}%)</span></span>
                  </div>
                  <div className="admin-progress" style={{ height: 10 }}>
                    <div style={{ width: `${s.pct}%`, height: '100%', background: s.color, borderRadius: 5, transition: 'width 0.5s ease' }}></div>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ position: 'relative', width: 180, height: 180 }}>
                <svg viewBox="0 0 36 36" style={{ transform: 'rotate(-90deg)' }}>
                  {severityDistribution.reduce((acc, s, i) => {
                    const offset = acc.offset
                    acc.circles.push(
                      <circle key={i} cx="18" cy="18" r="15.9" fill="none" stroke={s.color}
                        strokeWidth="3" strokeDasharray={`${s.pct} ${100 - s.pct}`}
                        strokeDashoffset={-offset} strokeLinecap="round" />
                    )
                    acc.offset += s.pct
                    return acc
                  }, { circles: [], offset: 0 }).circles}
                </svg>
                <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ fontSize: 22, fontWeight: 700, color: 'var(--admin-text)' }}>296</span>
                  <span style={{ fontSize: 10, color: 'var(--admin-text-muted)' }}>Total</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Dangerous Roads Tab */}
      {currentTab === 'roads' && (
        <div className="admin-card">
          <h3 className="admin-card-title">Top Dangerous Roads</h3>
          <p className="admin-card-subtitle">Ranked by incident count — last 30 days</p>
          <div className="admin-table-wrapper" style={{ marginTop: 12 }}>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Road</th>
                  <th>Incidents</th>
                  <th>Severity</th>
                  <th>Primary Type</th>
                  <th>Visual</th>
                </tr>
              </thead>
              <tbody>
                {dangerousRoads.map((r, i) => (
                  <tr key={r.road}>
                    <td style={{ fontWeight: 700, fontSize: 13, color: i < 3 ? 'var(--admin-danger)' : 'var(--admin-text)' }}>#{i + 1}</td>
                    <td style={{ fontWeight: 500, fontSize: 12 }}>{r.road}</td>
                    <td style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{r.incidents}</td>
                    <td><span className={`admin-pill ${r.severity}`}>{r.severity}</span></td>
                    <td style={{ fontSize: 11 }}>{r.type}</td>
                    <td>
                      <div className="admin-progress" style={{ width: 80, height: 6 }}>
                        <div className={`admin-progress-fill ${r.severity === 'high' ? 'danger' : r.severity === 'medium' ? 'warning' : 'success'}`} style={{ width: `${(r.incidents / 34) * 100}%` }}></div>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Correlations Tab */}
      {currentTab === 'correlations' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          {/* Weather */}
          <div className="admin-card">
            <h3 className="admin-card-title">Weather Correlation</h3>
            <p className="admin-card-subtitle">Incident distribution by weather conditions</p>
            <div style={{ marginTop: 14 }}>
              {weatherCorrelation.map(w => (
                <div key={w.condition} style={{ marginBottom: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 11.5 }}>{w.condition}</span>
                    <span style={{ fontSize: 11, fontWeight: 600 }}>{w.incidents} <span style={{ color: 'var(--admin-text-muted)', fontWeight: 400 }}>({w.pctOfTotal}%)</span></span>
                  </div>
                  <div className="admin-progress">
                    <div className="admin-progress-fill warning" style={{ width: `${w.pctOfTotal}%` }}></div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Road Type */}
          <div className="admin-card">
            <h3 className="admin-card-title">Road Type Correlation</h3>
            <p className="admin-card-subtitle">Incident distribution by road category</p>
            <div style={{ marginTop: 14 }}>
              {roadTypeCorrelation.map(r => (
                <div key={r.type} style={{ marginBottom: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 11.5 }}>{r.type}</span>
                    <span style={{ fontSize: 11, fontWeight: 600 }}>{r.incidents} <span style={{ color: 'var(--admin-text-muted)', fontWeight: 400 }}>({r.pct}%)</span></span>
                  </div>
                  <div className="admin-progress">
                    <div className="admin-progress-fill primary" style={{ width: `${r.pct}%` }}></div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Time of Day */}
          <div className="admin-card" style={{ gridColumn: 'span 2' }}>
            <h3 className="admin-card-title">Incidents by Time of Day</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginTop: 14 }}>
              {[
                { period: 'Night (00-06)', incidents: 18, pct: 6, icon: '🌙' },
                { period: 'Morning (06-12)', incidents: 108, pct: 36, icon: '🌅' },
                { period: 'Afternoon (12-18)', incidents: 98, pct: 33, icon: '☀️' },
                { period: 'Evening (18-24)', incidents: 72, pct: 24, icon: '🌆' },
              ].map(t => (
                <div key={t.period} style={{ padding: '14px 12px', background: 'var(--admin-surface-alt)', borderRadius: 8, border: '1px solid var(--admin-border)', textAlign: 'center' }}>
                  <div style={{ fontSize: 24, marginBottom: 6 }}>{t.icon}</div>
                  <div style={{ fontSize: 11, color: 'var(--admin-text-muted)', marginBottom: 4 }}>{t.period}</div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--admin-text)' }}>{t.incidents}</div>
                  <div style={{ fontSize: 10, color: 'var(--admin-text-muted)' }}>{t.pct}% of total</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Predictions Tab */}
      {currentTab === 'predictions' && (
        <div className="admin-card">
          <h3 className="admin-card-title">7-Day Trend & Prediction</h3>
          <p className="admin-card-subtitle">Solid bars = actual data · Outlined bars = AI prediction (next 7 days)</p>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 220, marginTop: 20, padding: '0 4px' }}>
            {weeklyTrend.map((d, i) => {
              const isActual = d.actual !== null
              const val = isActual ? d.actual : d.predicted
              return (
                <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                  <span style={{ fontSize: 9, fontWeight: 600, color: 'var(--admin-text-secondary)' }}>{val}</span>
                  <div style={{
                    width: '100%',
                    height: `${(val / maxTrend) * 170}px`,
                    background: isActual ? 'var(--admin-primary)' : 'transparent',
                    border: isActual ? 'none' : '2px dashed var(--admin-primary)',
                    borderRadius: '4px 4px 0 0',
                    opacity: isActual ? 0.85 : 0.5,
                    transition: 'height 0.3s ease',
                  }}></div>
                  <span style={{ fontSize: 8, color: 'var(--admin-text-muted)', whiteSpace: 'nowrap' }}>{d.day}</span>
                </div>
              )
            })}
          </div>
          <div style={{ display: 'flex', gap: 16, marginTop: 14, fontSize: 10.5, color: 'var(--admin-text-muted)' }}>
            <span>■ Actual (last 7 days)</span>
            <span>┅ Predicted (next 7 days)</span>
          </div>
          <div style={{ marginTop: 16, padding: '12px 14px', background: 'rgba(59, 130, 246, 0.08)', borderRadius: 8, border: '1px solid rgba(59, 130, 246, 0.15)' }}>
            <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--admin-primary)', marginBottom: 4 }}>AI Prediction Summary</div>
            <p style={{ fontSize: 11, color: 'var(--admin-text-secondary)', lineHeight: 1.6, margin: 0 }}>
              Based on historical patterns, weather forecasts and seasonal trends, the model predicts a slight decrease in overall incident volume next week (estimated 407 vs 407 actual this week).
              Saturday remains the predicted peak day. Morning rush (08:00-09:00) continues as the highest-risk period.
            </p>
          </div>
        </div>
      )}
    </>
  )
}

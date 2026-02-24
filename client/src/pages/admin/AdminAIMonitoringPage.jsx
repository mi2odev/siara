import React, { useState } from 'react'
import { useSearchParams } from 'react-router-dom'

/* ── Mock AI data ── */
const modelInfo = {
  name: 'SiaraNet v2.3',
  lastTrained: '2025-01-15 03:00 UTC',
  dataset: '124,800 samples',
  accuracy: 92.4,
  precision: 89.7,
  recall: 94.1,
  f1: 91.8,
  drift: 0.3,
  driftStatus: 'stable',
}

const confusionMatrix = [
  /* predicted → */
  /* actual ↓   Low   Med   High  Crit  */
  [842, 23, 5, 0],
  [18, 714, 31, 2],
  [3, 28, 651, 14],
  [0, 1, 11, 189],
]
const matrixLabels = ['Low', 'Medium', 'High', 'Critical']

const confidenceHistogram = [
  { range: '0-10%', count: 2 },
  { range: '10-20%', count: 5 },
  { range: '20-30%', count: 8 },
  { range: '30-40%', count: 12 },
  { range: '40-50%', count: 18 },
  { range: '50-60%', count: 34 },
  { range: '60-70%', count: 67 },
  { range: '70-80%', count: 124 },
  { range: '80-90%', count: 186 },
  { range: '90-100%', count: 98 },
]
const maxHistCount = Math.max(...confidenceHistogram.map(h => h.count))

const overrideLogs = [
  { id: 1, incident: 'INC-2389', admin: 'Super Admin', from: 'low', to: 'high', reason: 'Multi-vehicle collision confirmed on-site', time: '2025-01-17 14:22' },
  { id: 2, incident: 'INC-2374', admin: 'Mod. Amine', from: 'high', to: 'medium', reason: 'Single vehicle, minor damage — AI over-predicted', time: '2025-01-16 09:45' },
  { id: 3, incident: 'INC-2361', admin: 'Super Admin', from: 'medium', to: 'low', reason: 'False alarm — construction zone misclassified', time: '2025-01-15 22:10' },
  { id: 4, incident: 'INC-2358', admin: 'Mod. Sara', from: 'low', to: 'high', reason: 'Pedestrian involved — severity escalated', time: '2025-01-15 16:33' },
]

const falsePositives = [
  { type: 'Construction → Collision', count: 12, pct: 1.8 },
  { type: 'Heavy Traffic → Accident', count: 8, pct: 1.2 },
  { type: 'Parked Vehicles → Roadblock', count: 5, pct: 0.7 },
]

const falseNegatives = [
  { type: 'Multi-vehicle → Minor', count: 6, pct: 0.9 },
  { type: 'Pedestrian Incident → Low', count: 4, pct: 0.6 },
  { type: 'Night-time underestimation', count: 3, pct: 0.4 },
]

const tabs = [
  { key: 'performance', label: 'Model Performance' },
  { key: 'confusion', label: 'Confusion Matrix' },
  { key: 'confidence', label: 'Confidence Analysis' },
  { key: 'overrides', label: 'Override Log' },
]

export default function AdminAIMonitoringPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const currentTab = searchParams.get('tab') || 'performance'

  return (
    <>
      <div className="admin-page-header">
        <div>
          <h1 className="admin-page-title">AI & Model Supervision</h1>
          <p className="admin-page-subtitle">{modelInfo.name} — Last trained {modelInfo.lastTrained}</p>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button className="admin-btn admin-btn-ghost">Re-train Model</button>
          <button className="admin-btn admin-btn-ghost">Download Report</button>
        </div>
      </div>

      {/* Model Drift Alert */}
      {modelInfo.drift > 0.5 && (
        <div className="admin-critical-bar">
          <span className="critical-dot"></span>
          <span className="critical-text">Model drift detected: {modelInfo.drift}% — Consider re-training</span>
        </div>
      )}

      {/* Tabs */}
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

      {/* Performance Tab */}
      {currentTab === 'performance' && (
        <>
          {/* Key Metrics */}
          <div className="admin-kpi-grid" style={{ gridTemplateColumns: 'repeat(5, 1fr)', marginBottom: 14 }}>
            {[
              { label: 'Accuracy', value: `${modelInfo.accuracy}%`, color: 'var(--admin-success)' },
              { label: 'Precision', value: `${modelInfo.precision}%`, color: 'var(--admin-primary)' },
              { label: 'Recall', value: `${modelInfo.recall}%`, color: 'var(--admin-primary)' },
              { label: 'F1 Score', value: `${modelInfo.f1}%`, color: 'var(--admin-primary)' },
              { label: 'Model Drift', value: `${modelInfo.drift}%`, color: modelInfo.drift > 1 ? 'var(--admin-danger)' : 'var(--admin-success)' },
            ].map(m => (
              <div className="admin-kpi" key={m.label}>
                <div className="admin-kpi-body">
                  <span className="admin-kpi-label">{m.label}</span>
                  <span className="admin-kpi-value" style={{ color: m.color }}>{m.value}</span>
                </div>
              </div>
            ))}
          </div>

          {/* False Pos / Neg side by side */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
            <div className="admin-card">
              <h3 className="admin-card-title" style={{ color: 'var(--admin-danger)' }}>False Positives</h3>
              <p className="admin-card-subtitle">AI over-predicted severity</p>
              <div style={{ marginTop: 10 }}>
                {falsePositives.map((fp, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--admin-border)' }}>
                    <span style={{ fontSize: 11.5 }}>{fp.type}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 11, fontWeight: 600 }}>{fp.count} cases</span>
                      <span style={{ fontSize: 10, color: 'var(--admin-text-muted)' }}>{fp.pct}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="admin-card">
              <h3 className="admin-card-title" style={{ color: 'var(--admin-warning)' }}>False Negatives</h3>
              <p className="admin-card-subtitle">AI under-predicted severity</p>
              <div style={{ marginTop: 10 }}>
                {falseNegatives.map((fn, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--admin-border)' }}>
                    <span style={{ fontSize: 11.5 }}>{fn.type}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 11, fontWeight: 600 }}>{fn.count} cases</span>
                      <span style={{ fontSize: 10, color: 'var(--admin-text-muted)' }}>{fn.pct}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Training Info */}
          <div className="admin-card">
            <h3 className="admin-card-title">Model Information</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginTop: 12 }}>
              {[
                { label: 'Model Name', value: modelInfo.name },
                { label: 'Training Dataset', value: modelInfo.dataset },
                { label: 'Last Trained', value: modelInfo.lastTrained },
                { label: 'Drift Status', value: modelInfo.driftStatus },
              ].map(item => (
                <div className="admin-mini-stat" key={item.label}>
                  <span className="admin-mini-stat-label">{item.label}</span>
                  <span className="admin-mini-stat-value">{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Confusion Matrix Tab */}
      {currentTab === 'confusion' && (
        <div className="admin-card">
          <h3 className="admin-card-title">Confusion Matrix</h3>
          <p className="admin-card-subtitle">Actual (rows) vs Predicted (columns) — Last 30 days</p>
          <div style={{ overflowX: 'auto', marginTop: 14 }}>
            <table className="admin-matrix">
              <thead>
                <tr>
                  <th style={{ width: 80 }}>Actual ↓ / Predicted →</th>
                  {matrixLabels.map(l => <th key={l}>{l}</th>)}
                </tr>
              </thead>
              <tbody>
                {confusionMatrix.map((row, ri) => (
                  <tr key={ri}>
                    <td style={{ fontWeight: 600, fontSize: 11, color: 'var(--admin-text)' }}>{matrixLabels[ri]}</td>
                    {row.map((cell, ci) => {
                      const isDiag = ri === ci
                      const maxCell = Math.max(...row)
                      const opacity = cell / maxCell
                      return (
                        <td key={ci} className={isDiag ? 'matrix-diag' : ''} style={{
                          background: isDiag
                            ? `rgba(34, 197, 94, ${0.1 + opacity * 0.25})`
                            : cell > 10 ? `rgba(239, 68, 68, ${0.05 + (cell / maxCell) * 0.15})` : 'transparent',
                          fontWeight: isDiag ? 700 : 500,
                          fontSize: 13,
                          textAlign: 'center',
                        }}>
                          {cell}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ marginTop: 12, display: 'flex', gap: 16, fontSize: 10.5, color: 'var(--admin-text-muted)' }}>
            <span>🟩 Diagonal = correct predictions</span>
            <span>🟥 Off-diagonal = misclassifications (highlighted when &gt; 10)</span>
          </div>
        </div>
      )}

      {/* Confidence Analysis Tab */}
      {currentTab === 'confidence' && (
        <div className="admin-card">
          <h3 className="admin-card-title">Confidence Distribution</h3>
          <p className="admin-card-subtitle">Distribution of AI confidence scores across all predictions (last 30 days)</p>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 180, marginTop: 16, padding: '0 8px' }}>
            {confidenceHistogram.map((bar, i) => (
              <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                <span style={{ fontSize: 9, fontWeight: 600, color: 'var(--admin-text-secondary)' }}>{bar.count}</span>
                <div style={{
                  width: '100%',
                  height: `${(bar.count / maxHistCount) * 140}px`,
                  background: i >= 7 ? 'var(--admin-success)' : i >= 5 ? 'var(--admin-primary)' : i >= 3 ? 'var(--admin-warning)' : 'var(--admin-danger)',
                  borderRadius: '4px 4px 0 0',
                  opacity: 0.8,
                  transition: 'height 0.3s ease',
                }}></div>
                <span style={{ fontSize: 8, color: 'var(--admin-text-muted)', whiteSpace: 'nowrap' }}>{bar.range}</span>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
            <div className="admin-mini-stat">
              <span className="admin-mini-stat-label">Mean Confidence</span>
              <span className="admin-mini-stat-value">78.2%</span>
            </div>
            <div className="admin-mini-stat">
              <span className="admin-mini-stat-label">Median</span>
              <span className="admin-mini-stat-value">81.4%</span>
            </div>
            <div className="admin-mini-stat">
              <span className="admin-mini-stat-label">Below 50% Threshold</span>
              <span className="admin-mini-stat-value" style={{ color: 'var(--admin-warning)' }}>45 (8.1%)</span>
            </div>
          </div>
        </div>
      )}

      {/* Override Log Tab */}
      {currentTab === 'overrides' && (
        <div className="admin-card">
          <div className="admin-card-header">
            <div>
              <h3 className="admin-card-title">Manual Override Log</h3>
              <p className="admin-card-subtitle">All admin severity overrides — who, what, why</p>
            </div>
            <button className="admin-btn admin-btn-ghost">Export Log</button>
          </div>
          <div className="admin-table-wrapper" style={{ marginTop: 10 }}>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Incident</th>
                  <th>Admin</th>
                  <th>Original → New</th>
                  <th>Reason</th>
                  <th>Timestamp</th>
                </tr>
              </thead>
              <tbody>
                {overrideLogs.map(log => (
                  <tr key={log.id}>
                    <td style={{ fontWeight: 600, fontSize: 11 }}>{log.incident}</td>
                    <td style={{ fontSize: 11 }}>{log.admin}</td>
                    <td>
                      <span className={`admin-pill ${log.from}`}>{log.from}</span>
                      <span style={{ margin: '0 4px', color: 'var(--admin-text-muted)' }}>→</span>
                      <span className={`admin-pill ${log.to}`}>{log.to}</span>
                    </td>
                    <td style={{ fontSize: 11, maxWidth: 250, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{log.reason}</td>
                    <td style={{ fontSize: 10.5, color: 'var(--admin-text-muted)', fontVariantNumeric: 'tabular-nums' }}>{log.time}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  )
}

/**
 * @file AdminAIMonitoringPage.jsx
 * @description Admin AI & Model Supervision dashboard.
 *
 * Layout:
 *   - Page header with re-train and download-report buttons
 *   - Conditional model-drift alert banner (when drift > 0.5%)
 *   - 4 tabs: Performance | Confusion Matrix | Confidence Analysis | Override Log
 *
 * Features:
 *   - Performance KPIs: accuracy, precision, recall, F1, drift
 *   - False-positive and false-negative breakdown cards
 *   - Color-coded 3×3 confusion matrix (Low / Medium / High)
 *   - Confidence histogram with dynamic bar heights and color bands
 *   - Manual override log table (who changed what severity and why)
 *
 * Data: Mock model metrics, 4×4 confusion matrix, 10-bucket histogram,
 *       4 override log entries, 3 false-positive & 3 false-negative categories.
 */
import React, { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import ArrowRightAltRoundedIcon from '@mui/icons-material/ArrowRightAltRounded'
import SquareRoundedIcon from '@mui/icons-material/SquareRounded'

/* ═══════════════════════════════════════════════════════════════
   MOCK DATA — AI model metrics & analysis artifacts
   ═══════════════════════════════════════════════════════════════ */

/** Core model metadata and evaluation scores */
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

/**
 * 4×4 confusion matrix — rows = actual severity, columns = predicted.
 * Diagonal cells are correct predictions; off-diagonal are misclassifications.
 */
const confusionMatrix = [
  /* predicted → */
  /* actual ↓   Low   Med   High */
  [842, 23, 5],
  [18, 714, 33],
  [3, 29, 865],
]
const matrixLabels = ['Low', 'Medium', 'High']

/** 10-bucket histogram of prediction confidence scores (last 30 days) */
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
/** Used to normalize bar heights in the histogram visualization */
const maxHistCount = Math.max(...confidenceHistogram.map(h => h.count))

/** Admin manual severity-override audit trail */
const overrideLogs = [
  { id: 1, incident: 'INC-2389', admin: 'Super Admin', from: 'low', to: 'high', reason: 'Multi-vehicle collision confirmed on-site', time: '2025-01-17 14:22' },
  { id: 2, incident: 'INC-2374', admin: 'Mod. Amine', from: 'high', to: 'medium', reason: 'Single vehicle, minor damage — AI over-predicted', time: '2025-01-16 09:45' },
  { id: 3, incident: 'INC-2361', admin: 'Super Admin', from: 'medium', to: 'low', reason: 'False alarm — construction zone misclassified', time: '2025-01-15 22:10' },
  { id: 4, incident: 'INC-2358', admin: 'Mod. Sara', from: 'low', to: 'high', reason: 'Pedestrian involved — severity escalated', time: '2025-01-15 16:33' },
]

/** Common false-positive patterns — AI over-predicted severity */
const falsePositives = [
  { from: 'Construction', to: 'Collision', count: 12, pct: 1.8 },
  { from: 'Heavy Traffic', to: 'Accident', count: 8, pct: 1.2 },
  { from: 'Parked Vehicles', to: 'Roadblock', count: 5, pct: 0.7 },
]

/** Common false-negative patterns — AI under-predicted severity */
const falseNegatives = [
  { from: 'Multi-vehicle', to: 'Minor', count: 6, pct: 0.9 },
  { from: 'Pedestrian Incident', to: 'Low', count: 4, pct: 0.6 },
  { from: 'Night-time underestimation', to: null, count: 3, pct: 0.4 },
]

const PatternLabel = ({ from, to }) => (
  <span style={{ fontSize: 11.5, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
    <span>{from}</span>
    {to ? (
      <>
        <ArrowRightAltRoundedIcon fontSize="inherit" sx={{ color: 'var(--admin-text-muted)' }} />
        <span>{to}</span>
      </>
    ) : null}
  </span>
)

/** Tab definitions for the 4 monitoring views */
const tabs = [
  { key: 'performance', label: 'Model Performance' },
  { key: 'confusion', label: 'Confusion Matrix' },
  { key: 'confidence', label: 'Confidence Analysis' },
  { key: 'overrides', label: 'Override Log' },
]

/* ═══════════════════════════════════════════════════════════════
   COMPONENT
   ═══════════════════════════════════════════════════════════════ */
export default function AdminAIMonitoringPage() {
  /* URL-driven tab state — defaults to 'performance' */
  const [searchParams, setSearchParams] = useSearchParams()
  const currentTab = searchParams.get('tab') || 'performance'

  /* ═══ RENDER ═══ */
  return (
    <>
      {/* ═══ PAGE HEADER — model name, re-train & download actions ═══ */}
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

      {/* ═══ MODEL DRIFT ALERT — shown only when drift exceeds 0.5% ═══ */}
      {modelInfo.drift > 0.5 && (
        <div className="admin-high-bar">
          <span className="high-dot"></span>
          <span className="high-text">Model drift detected: {modelInfo.drift}% — Consider re-training</span>
        </div>
      )}

      {/* ═══ TAB BAR — Performance | Confusion | Confidence | Overrides ═══ */}
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

      {/* ═══ TAB: PERFORMANCE — KPIs, false pos/neg, model info ═══ */}
      {currentTab === 'performance' && (
        <>
          {/* ── Key metric KPI cards (5 columns) ── */}
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

          {/* ── False Positives & False Negatives — side-by-side cards ── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
            <div className="admin-card">
              <h3 className="admin-card-title" style={{ color: 'var(--admin-danger)' }}>False Positives</h3>
              <p className="admin-card-subtitle">AI over-predicted severity</p>
              <div style={{ marginTop: 10 }}>
                {falsePositives.map((fp, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--admin-border)' }}>
                    <PatternLabel from={fp.from} to={fp.to} />
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
                    <PatternLabel from={fn.from} to={fn.to} />
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 11, fontWeight: 600 }}>{fn.count} cases</span>
                      <span style={{ fontSize: 10, color: 'var(--admin-text-muted)' }}>{fn.pct}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ── Model metadata card (name, dataset, last trained, drift) ── */}
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

      {/* ═══ TAB: CONFUSION MATRIX — 4×4 actual vs predicted ═══ */}
      {currentTab === 'confusion' && (
        <div className="admin-card">
          <h3 className="admin-card-title">Confusion Matrix</h3>
          <p className="admin-card-subtitle">Actual (rows) vs Predicted (columns) — Last 30 days</p>
          <div style={{ overflowX: 'auto', marginTop: 14 }}>
            <table className="admin-matrix">
              <thead>
                <tr>
                  <th style={{ width: 80 }}>Actual / Predicted</th>
                  {matrixLabels.map(l => <th key={l}>{l}</th>)}
                </tr>
              </thead>
              <tbody>
                {confusionMatrix.map((row, ri) => (
                  <tr key={ri}>
                    <td style={{ fontWeight: 600, fontSize: 11, color: 'var(--admin-text)' }}>{matrixLabels[ri]}</td>
                    {row.map((cell, ci) => {
                      const isDiag = ri === ci         // diagonal = correct prediction
                      const maxCell = Math.max(...row)  // max in row for opacity scaling
                      const opacity = cell / maxCell
                      /* Green background for diagonal (correct), red tint for misclassifications > 10 */
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
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <SquareRoundedIcon fontSize="inherit" className="icon-success icon-soft" />
              Diagonal = correct predictions
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <SquareRoundedIcon fontSize="inherit" className="icon-danger icon-soft" />
              Off-diagonal = misclassifications (highlighted when &gt; 10)
            </span>
          </div>
        </div>
      )}

      {/* ═══ TAB: CONFIDENCE ANALYSIS — histogram + summary stats ═══ */}
      {currentTab === 'confidence' && (
        <div className="admin-card">
          <h3 className="admin-card-title">Confidence Distribution</h3>
          <p className="admin-card-subtitle">Distribution of AI confidence scores across all predictions (last 30 days)</p>
          {/* Bar chart — height proportional to count/maxHistCount, color by confidence tier */}
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 180, marginTop: 16, padding: '0 8px' }}>
            {confidenceHistogram.map((bar, i) => (
              <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                <span style={{ fontSize: 9, fontWeight: 600, color: 'var(--admin-text-secondary)' }}>{bar.count}</span>
                <div style={{
                  width: '100%',
                  height: `${(bar.count / maxHistCount) * 140}px`,
                  /* Color bands: 0-30% danger, 30-50% warning, 50-70% primary, 70-100% success */
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

      {/* ═══ TAB: OVERRIDE LOG — admin severity-change audit trail ═══ */}
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
                  <th>Original / New</th>
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
                      <ArrowRightAltRoundedIcon fontSize="small" sx={{ mx: 0.5, color: 'var(--admin-text-muted)' }} />
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

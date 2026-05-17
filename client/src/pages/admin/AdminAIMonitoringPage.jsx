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
import React, { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import ArrowRightAltRoundedIcon from '@mui/icons-material/ArrowRightAltRounded'
import SquareRoundedIcon from '@mui/icons-material/SquareRounded'
import TrendingUpOutlinedIcon from '@mui/icons-material/TrendingUpOutlined'
import QueryStatsOutlinedIcon from '@mui/icons-material/QueryStatsOutlined'
import WarningAmberOutlinedIcon from '@mui/icons-material/WarningAmberOutlined'
import InsightsOutlinedIcon from '@mui/icons-material/InsightsOutlined'

import { getOccurrenceBetaV1Metrics } from '../../services/adminModelsService'

/** Map a 0-100 confidence bucket center to a semantic color. */
function confidenceBucketColor(midpoint) {
  if (midpoint < 30) return 'var(--admin-danger)'
  if (midpoint < 50) return 'var(--admin-warning)'
  if (midpoint < 70) return 'var(--admin-primary)'
  return 'var(--admin-success)'
}

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

/** Tab definitions. The 'occurrence' tab is backed by real backend data
 * (GET /api/admin/models/occurrence-beta-v1); the other four still use the
 * severity-flavored mock data above and should be migrated separately. */
const tabs = [
  { key: 'performance', label: 'Model Performance' },
  { key: 'confusion', label: 'Confusion Matrix' },
  { key: 'confidence', label: 'Confidence Analysis' },
  { key: 'overrides', label: 'Override Log' },
  { key: 'occurrence', label: 'Occurrence Model (Beta)' },
]

function formatPct(value, digits = 2) {
  if (value == null || Number.isNaN(Number(value))) return '—'
  return `${(Number(value) * 100).toFixed(digits)}%`
}

function formatNumber(value, digits = 4) {
  if (value == null || Number.isNaN(Number(value))) return '—'
  return Number(value).toFixed(digits)
}

/* ═══════════════════════════════════════════════════════════════
   COMPONENT
   ═══════════════════════════════════════════════════════════════ */
export default function AdminAIMonitoringPage() {
  /* URL-driven tab state — defaults to 'performance' */
  const [searchParams, setSearchParams] = useSearchParams()
  const currentTab = searchParams.get('tab') || 'performance'

  /* Occurrence model metrics — fetched lazily when the tab opens, cached after. */
  const [occurrenceData, setOccurrenceData] = useState(null)
  const [occurrenceLoading, setOccurrenceLoading] = useState(false)
  const [occurrenceError, setOccurrenceError] = useState(null)

  useEffect(() => {
    if (currentTab !== 'occurrence' || occurrenceData || occurrenceLoading) return
    let cancelled = false
    setOccurrenceLoading(true)
    setOccurrenceError(null)
    getOccurrenceBetaV1Metrics()
      .then((data) => {
        if (!cancelled) setOccurrenceData(data)
      })
      .catch((err) => {
        if (!cancelled) setOccurrenceError(err.message || 'Failed to load occurrence metrics')
      })
      .finally(() => {
        if (!cancelled) setOccurrenceLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [currentTab, occurrenceData, occurrenceLoading])

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

      {/* ═══ TAB: CONFUSION MATRIX — 3×3 actual vs predicted ═══ */}
      {currentTab === 'confusion' && (
        <div className="admin-card">
          <h3 className="admin-card-title">Confusion Matrix</h3>
          <p className="admin-card-subtitle">Actual (rows) vs Predicted (columns) — Last 30 days</p>
          <table className="admin-matrix" style={{ marginTop: 16 }}>
            <thead>
              <tr>
                <th>Actual ↓ / Predicted →</th>
                {matrixLabels.map(l => <th key={l}>{l}</th>)}
              </tr>
            </thead>
            <tbody>
              {confusionMatrix.map((row, ri) => {
                const maxCell = Math.max(...row)
                return (
                  <tr key={ri}>
                    <td>{matrixLabels[ri]}</td>
                    {row.map((cell, ci) => {
                      const isDiag = ri === ci
                      const intensity = cell / maxCell
                      return (
                        <td key={ci} className={isDiag ? 'matrix-diag' : ''} style={{
                          background: isDiag
                            ? `rgba(34, 197, 94, ${0.10 + intensity * 0.22})`
                            : cell > 10 ? `rgba(239, 68, 68, ${0.06 + intensity * 0.18})` : undefined,
                        }}>
                          {cell}
                        </td>
                      )
                    })}
                  </tr>
                )
              })}
            </tbody>
          </table>
          <div style={{ marginTop: 16, display: 'flex', gap: 18, fontSize: 11, color: 'var(--admin-text-muted)' }}>
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
      {currentTab === 'confidence' && (() => {
        const totalPredictions = confidenceHistogram.reduce((sum, b) => sum + b.count, 0)
        const belowThresholdCount = confidenceHistogram
          .filter((_, i) => i < 5)
          .reduce((sum, b) => sum + b.count, 0)
        const belowThresholdPct = totalPredictions > 0
          ? ((belowThresholdCount / totalPredictions) * 100).toFixed(1)
          : '0.0'
        const aboveHighCount = confidenceHistogram
          .filter((_, i) => i >= 7)
          .reduce((sum, b) => sum + b.count, 0)
        const aboveHighPct = totalPredictions > 0
          ? ((aboveHighCount / totalPredictions) * 100).toFixed(1)
          : '0.0'

        const chartData = confidenceHistogram.map((bar, i) => {
          const midpoint = i * 10 + 5
          return {
            range: bar.range,
            count: bar.count,
            pct: totalPredictions > 0 ? (bar.count / totalPredictions) * 100 : 0,
            fill: confidenceBucketColor(midpoint),
          }
        })

        const kpis = [
          { label: 'Mean Confidence', value: '78.2%', icon: TrendingUpOutlinedIcon, tone: 'success', hint: '+1.4% vs last 30 days' },
          { label: 'Median', value: '81.4%', icon: QueryStatsOutlinedIcon, tone: 'primary', hint: 'P50 of all predictions' },
          { label: 'Below 50% Threshold', value: `${belowThresholdCount}`, icon: WarningAmberOutlinedIcon, tone: 'warning', hint: `${belowThresholdPct}% of predictions` },
          { label: 'High Confidence (≥70%)', value: `${aboveHighCount}`, icon: InsightsOutlinedIcon, tone: 'success', hint: `${aboveHighPct}% of predictions` },
        ]
        const toneColor = (tone) => ({
          success: 'var(--admin-success)',
          primary: 'var(--admin-primary)',
          warning: 'var(--admin-warning)',
          danger: 'var(--admin-danger)',
        }[tone] || 'var(--admin-text)')

        return (
          <>
            {/* ── KPI summary row (4 cards) ── */}
            <div className="admin-kpi-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginBottom: 14 }}>
              {kpis.map((m) => {
                const Icon = m.icon
                return (
                  <div className="admin-kpi" key={m.label}>
                    <div className="admin-kpi-body">
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span className="admin-kpi-label">{m.label}</span>
                        <Icon fontSize="small" sx={{ color: toneColor(m.tone), opacity: 0.85 }} />
                      </div>
                      <span className="admin-kpi-value" style={{ color: toneColor(m.tone) }}>{m.value}</span>
                      <span style={{ fontSize: 10.5, color: 'var(--admin-text-muted)' }}>{m.hint}</span>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* ── Distribution chart ── */}
            <div className="admin-card">
              <div className="admin-card-header">
                <div>
                  <h3 className="admin-card-title">Confidence Distribution</h3>
                  <p className="admin-card-subtitle">AI confidence across {totalPredictions.toLocaleString()} predictions (last 30 days)</p>
                </div>
                <div style={{ display: 'flex', gap: 14, fontSize: 10.5, color: 'var(--admin-text-muted)' }}>
                  {[
                    { label: 'Very low', color: 'var(--admin-danger)' },
                    { label: 'Low', color: 'var(--admin-warning)' },
                    { label: 'Moderate', color: 'var(--admin-primary)' },
                    { label: 'High', color: 'var(--admin-success)' },
                  ].map((l) => (
                    <span key={l.label} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                      <span style={{ width: 9, height: 9, borderRadius: 2, background: l.color, display: 'inline-block' }} />
                      {l.label}
                    </span>
                  ))}
                </div>
              </div>

              <div style={{ width: '100%', height: 280, marginTop: 14 }}>
                <ResponsiveContainer>
                  <BarChart data={chartData} margin={{ top: 16, right: 16, left: 0, bottom: 8 }} barCategoryGap="18%">
                    <CartesianGrid stroke="var(--admin-border)" strokeDasharray="3 4" vertical={false} />
                    <XAxis
                      dataKey="range"
                      tick={{ fontSize: 10.5, fill: 'var(--admin-text-muted)' }}
                      axisLine={{ stroke: 'var(--admin-border)' }}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 10.5, fill: 'var(--admin-text-muted)' }}
                      axisLine={false}
                      tickLine={false}
                      width={36}
                    />
                    <Tooltip
                      cursor={{ fill: 'rgba(148, 163, 184, 0.08)' }}
                      contentStyle={{
                        background: 'var(--admin-surface)',
                        border: '1px solid var(--admin-border)',
                        borderRadius: 6,
                        fontSize: 11,
                        padding: '6px 10px',
                      }}
                      formatter={(value, _name, item) => [
                        `${value} predictions (${item.payload.pct.toFixed(1)}%)`,
                        item.payload.range,
                      ]}
                      labelFormatter={() => ''}
                    />
                    <ReferenceLine
                      x="40-50%"
                      stroke="var(--admin-warning)"
                      strokeDasharray="4 3"
                      label={{
                        value: 'Decision threshold (50%)',
                        position: 'top',
                        fill: 'var(--admin-warning)',
                        fontSize: 10.5,
                        fontWeight: 600,
                      }}
                    />
                    <Bar dataKey="count" radius={[6, 6, 0, 0]} maxBarSize={48}>
                      {chartData.map((d) => (
                        <Cell key={d.range} fill={d.fill} fillOpacity={0.88} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div style={{
                marginTop: 12,
                padding: '10px 12px',
                background: 'var(--admin-surface-2)',
                borderRadius: 6,
                fontSize: 11.5,
                color: 'var(--admin-text-secondary)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
              }}>
                <InsightsOutlinedIcon fontSize="inherit" sx={{ color: 'var(--admin-primary)' }} />
                {aboveHighPct}% of predictions land in high-confidence bands (≥70%) — model is producing decisive outputs.
              </div>
            </div>
          </>
        )
      })()}

      {/* ═══ TAB: OCCURRENCE MODEL — real metrics from /api/admin/models/occurrence-beta-v1 ═══ */}
      {currentTab === 'occurrence' && (
        <>
          {occurrenceLoading && (
            <div className="admin-card">Loading occurrence model metrics…</div>
          )}
          {occurrenceError && !occurrenceLoading && (
            <div className="admin-high-bar">
              <span className="high-dot"></span>
              <span className="high-text">{occurrenceError}</span>
            </div>
          )}
          {occurrenceData && !occurrenceLoading && !occurrenceError && (() => {
            const metrics = occurrenceData.metrics || {}
            const calibrated = metrics.validation_calibrated || metrics.test_calibrated || metrics
            const cm = calibrated.confusion_matrix_at_threshold || metrics.confusion_matrix_at_threshold || {}
            const live = occurrenceData.live || {}
            const manifest = occurrenceData.training_manifest || {}
            const comparison = manifest.model_comparison || metrics.model_comparison || []
            const thresholds = occurrenceData.risk_level_thresholds || {}
            const weatherRate = manifest.weather_available_rate
            const cacheRate = manifest.weather_coverage?.cache_hit_rate

            return (
              <>
                <div className="admin-card" style={{ marginBottom: 12 }}>
                  <h3 className="admin-card-title">Accident Occurrence Prediction</h3>
                  <p className="admin-card-subtitle">
                    Version <strong>{occurrenceData.model_name}</strong>
                    {' · '}Algorithm <strong>{occurrenceData.algorithm}</strong>
                    {' · '}Calibration <strong>{occurrenceData.calibration_method}</strong>
                    {' · '}Time window {occurrenceData.time_window_hours}h
                    {' · '}Decision threshold {occurrenceData.decision_threshold}
                  </p>
                  {!live.enabled && (
                    <div className="admin-high-bar" style={{ marginTop: 10 }}>
                      <span className="high-dot"></span>
                      <span className="high-text">
                        Flask occurrence model is NOT loaded
                        {live.load_error ? ` — ${live.load_error}` : ''}.
                        Predictions endpoint will return 503.
                      </span>
                    </div>
                  )}
                </div>

                <div className="admin-kpi-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginBottom: 12 }}>
                  <div className="admin-kpi"><div className="admin-kpi-body">
                    <span className="admin-kpi-label">ROC-AUC</span>
                    <span className="admin-kpi-value">{formatNumber(calibrated.roc_auc)}</span>
                  </div></div>
                  <div className="admin-kpi"><div className="admin-kpi-body">
                    <span className="admin-kpi-label">PR-AUC</span>
                    <span className="admin-kpi-value">{formatNumber(calibrated.pr_auc)}</span>
                  </div></div>
                  <div className="admin-kpi"><div className="admin-kpi-body">
                    <span className="admin-kpi-label">Brier</span>
                    <span className="admin-kpi-value">{formatNumber(calibrated.brier)}</span>
                  </div></div>
                  <div className="admin-kpi"><div className="admin-kpi-body">
                    <span className="admin-kpi-label">Log Loss</span>
                    <span className="admin-kpi-value">{formatNumber(calibrated.log_loss)}</span>
                  </div></div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                  <div className="admin-card">
                    <h3 className="admin-card-title">Precision / Recall at Top-K</h3>
                    <table className="admin-table" style={{ marginTop: 8 }}>
                      <thead><tr><th>Top</th><th>Precision</th><th>Recall</th></tr></thead>
                      <tbody>
                        {[
                          { k: '1%', p: calibrated.precision_at_top_1pct, r: calibrated.recall_at_top_1pct },
                          { k: '5%', p: calibrated.precision_at_top_5pct, r: calibrated.recall_at_top_5pct },
                          { k: '10%', p: calibrated.precision_at_top_10pct, r: calibrated.recall_at_top_10pct },
                        ].map((row) => (
                          <tr key={row.k}>
                            <td style={{ fontWeight: 600 }}>{row.k}</td>
                            <td>{formatNumber(row.p)}</td>
                            <td>{formatNumber(row.r)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="admin-card">
                    <h3 className="admin-card-title">
                      Confusion Matrix
                      {cm.threshold != null && (
                        <span style={{ fontSize: 11, color: 'var(--admin-text-muted)', marginLeft: 6 }}>
                          (threshold {cm.threshold})
                        </span>
                      )}
                    </h3>
                    <table className="admin-matrix" style={{ marginTop: 8 }}>
                      <thead><tr><th></th><th>Pred. 0</th><th>Pred. 1</th></tr></thead>
                      <tbody>
                        <tr>
                          <td style={{ fontWeight: 600 }}>Actual 0</td>
                          <td className="matrix-diag" style={{ background: 'rgba(34,197,94,0.18)', fontWeight: 700 }}>{cm.tn ?? '—'}</td>
                          <td style={{ background: 'rgba(239,68,68,0.10)' }}>{cm.fp ?? '—'}</td>
                        </tr>
                        <tr>
                          <td style={{ fontWeight: 600 }}>Actual 1</td>
                          <td style={{ background: 'rgba(239,68,68,0.10)' }}>{cm.fn ?? '—'}</td>
                          <td className="matrix-diag" style={{ background: 'rgba(34,197,94,0.18)', fontWeight: 700 }}>{cm.tp ?? '—'}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="admin-card" style={{ marginBottom: 12 }}>
                  <h3 className="admin-card-title">Model Comparison (validation)</h3>
                  <table className="admin-table" style={{ marginTop: 8 }}>
                    <thead><tr><th>Model</th><th>PR-AUC</th><th>ROC-AUC</th><th>Brier</th><th>Fit (s)</th></tr></thead>
                    <tbody>
                      {comparison.map((row) => (
                        <tr key={row.model_name}>
                          <td style={{ fontWeight: 600 }}>{row.model_name}</td>
                          <td>{formatNumber(row.pr_auc)}</td>
                          <td>{formatNumber(row.roc_auc)}</td>
                          <td>{formatNumber(row.brier)}</td>
                          <td>{row.fit_seconds == null ? '—' : Number(row.fit_seconds).toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                  <div className="admin-card">
                    <h3 className="admin-card-title">Risk Thresholds</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, marginTop: 8 }}>
                      <div className="admin-mini-stat"><span className="admin-mini-stat-label">Moderate</span><span className="admin-mini-stat-value">{thresholds.moderate}</span></div>
                      <div className="admin-mini-stat"><span className="admin-mini-stat-label">High</span><span className="admin-mini-stat-value">{thresholds.high}</span></div>
                      <div className="admin-mini-stat"><span className="admin-mini-stat-label">Critical</span><span className="admin-mini-stat-value">{thresholds.critical}</span></div>
                      <div className="admin-mini-stat"><span className="admin-mini-stat-label">Explanation</span><span className="admin-mini-stat-value">{occurrenceData.explanation_source?.toUpperCase()}</span></div>
                    </div>
                  </div>
                  <div className="admin-card">
                    <h3 className="admin-card-title">Weather Coverage (training)</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, marginTop: 8 }}>
                      <div className="admin-mini-stat"><span className="admin-mini-stat-label">Available rate</span><span className="admin-mini-stat-value">{formatPct(weatherRate)}</span></div>
                      <div className="admin-mini-stat"><span className="admin-mini-stat-label">Cache hit rate</span><span className="admin-mini-stat-value">{formatPct(cacheRate)}</span></div>
                    </div>
                  </div>
                </div>

                {occurrenceData.calibrationCurveUrl && (
                  <div className="admin-card" style={{ marginBottom: 12 }}>
                    <h3 className="admin-card-title">Calibration curve — LightGBM + isotonic</h3>
                    <img
                      src={occurrenceData.calibrationCurveUrl}
                      alt="Calibration curve for occurrence_beta_v1"
                      style={{ maxWidth: '100%', marginTop: 10, border: '1px solid var(--admin-border)', borderRadius: 6 }}
                      onError={(e) => {
                        if (occurrenceData.calibrationCurveApiUrl && e.currentTarget.src !== occurrenceData.calibrationCurveApiUrl) {
                          e.currentTarget.src = occurrenceData.calibrationCurveApiUrl
                        }
                      }}
                    />
                  </div>
                )}

                <div className="admin-high-bar" style={{ background: 'rgba(234, 179, 8, 0.12)', borderColor: 'rgba(234,179,8,0.4)' }}>
                  <span className="high-dot" style={{ background: 'var(--admin-warning)' }}></span>
                  <span className="high-text">
                    {occurrenceData.training_prevalence_note}
                  </span>
                </div>
              </>
            )
          })()}
        </>
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

/**
 * @file AdminAnalyticsPage.jsx
 * @description Advanced analytics dashboard with 5 tabbed views, fed by
 * GET /api/admin/analytics. All numbers come from real rows in
 * app.accident_reports, joined spatially with gis.road_segments for road
 * correlations. Period selector (30d / 90d / 6mo / 1yr) is the only knob.
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
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from 'recharts'
import TrendingUpRoundedIcon from '@mui/icons-material/TrendingUpRounded'
import TrendingDownRoundedIcon from '@mui/icons-material/TrendingDownRounded'
import TrendingFlatRoundedIcon from '@mui/icons-material/TrendingFlatRounded'
import BedtimeOutlinedIcon from '@mui/icons-material/BedtimeOutlined'
import WbTwilightOutlinedIcon from '@mui/icons-material/WbTwilightOutlined'
import WbSunnyOutlinedIcon from '@mui/icons-material/WbSunnyOutlined'
import NightsStayOutlinedIcon from '@mui/icons-material/NightsStayOutlined'
import SquareRoundedIcon from '@mui/icons-material/SquareRounded'
import RemoveRoundedIcon from '@mui/icons-material/RemoveRounded'
import BoltOutlinedIcon from '@mui/icons-material/BoltOutlined'
import ShowChartRoundedIcon from '@mui/icons-material/ShowChartRounded'
import AccessTimeRoundedIcon from '@mui/icons-material/AccessTimeRounded'
import WhereToVoteOutlinedIcon from '@mui/icons-material/WhereToVoteOutlined'
import CloudOffOutlinedIcon from '@mui/icons-material/CloudOffOutlined'

import { fetchAdminAnalytics, normalizeAnalyticsPeriod } from '../../services/adminAnalyticsService'

const TIME_OF_DAY_ICONS = {
  night: <BedtimeOutlinedIcon fontSize="inherit" />,
  morning: <WbTwilightOutlinedIcon fontSize="inherit" />,
  afternoon: <WbSunnyOutlinedIcon fontSize="inherit" />,
  evening: <NightsStayOutlinedIcon fontSize="inherit" />,
}

const PERIOD_OPTIONS = [
  { value: '30d',  label: 'Last 30 days' },
  { value: '90d',  label: 'Last 90 days' },
  { value: '180d', label: 'Last 6 months' },
  { value: '365d', label: 'Last year' },
]

const TABS = [
  { key: 'heatmap',      label: 'Hourly Heatmap' },
  { key: 'severity',     label: 'Severity Distribution' },
  { key: 'roads',        label: 'Dangerous Roads' },
  { key: 'correlations', label: 'Correlations' },
  { key: 'predictions',  label: '7-Day Prediction' },
]

function formatPeakHour(hour) {
  if (hour == null) return '—'
  const h = Number(hour)
  if (!Number.isFinite(h)) return '—'
  const next = (h + 1) % 24
  return `${String(h).padStart(2, '0')}:00–${String(next).padStart(2, '0')}:00`
}

function trendIcon(trendPct) {
  if (trendPct > 0) return <TrendingUpRoundedIcon fontSize="inherit" sx={{ verticalAlign: 'middle' }} />
  if (trendPct < 0) return <TrendingDownRoundedIcon fontSize="inherit" sx={{ verticalAlign: 'middle' }} />
  return <TrendingFlatRoundedIcon fontSize="inherit" sx={{ verticalAlign: 'middle' }} />
}

function trendClass(trendPct, polarity = 'negative-up') {
  if (!trendPct) return 'stable'
  if (polarity === 'positive-up') return trendPct > 0 ? 'down' : 'up'
  return trendPct > 0 ? 'up' : 'down'
}

export default function AdminAnalyticsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const currentTab = TABS.some((t) => t.key === searchParams.get('tab'))
    ? searchParams.get('tab')
    : 'heatmap'
  const period = normalizeAnalyticsPeriod(searchParams.get('period'))

  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')
    fetchAdminAnalytics(period)
      .then((payload) => {
        if (!cancelled) setData(payload)
      })
      .catch((err) => {
        if (!cancelled) setError(err?.message || 'Failed to load analytics')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [period])

  const setTab = (key) => {
    const next = new URLSearchParams(searchParams)
    next.set('tab', key)
    setSearchParams(next)
  }
  const setPeriod = (value) => {
    const next = new URLSearchParams(searchParams)
    next.set('period', normalizeAnalyticsPeriod(value))
    setSearchParams(next)
  }

  const summary = data?.summary || {}
  const heatmap = data?.heatmap || { days: [], rows: [], max: 0 }
  const severity = data?.severity || []
  const timeOfDay = data?.timeOfDay || []
  const dangerousRoads = data?.dangerousRoads || []
  const roadTypes = data?.roadTypes || []
  const weeklyTrend = data?.weeklyTrend || { series: [], max: 1 }

  const totalSeverity = severity.reduce((sum, s) => sum + (s.count || 0), 0)
  const maxRoadIncidents = dangerousRoads.length > 0
    ? Math.max(...dangerousRoads.map((r) => r.incidents)) || 1
    : 1

  return (
    <>
      {/* ═══ PAGE HEADER ═══ */}
      <div className="admin-page-header">
        <div>
          <h1 className="admin-page-title">Advanced Analytics</h1>
          <p className="admin-page-subtitle">
            Data-driven insights — Incident patterns, risk correlations & predictions
            {data?.periodLabel ? ` · ${data.periodLabel}` : ''}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <select
            className="admin-select"
            style={{ height: 32 }}
            value={period}
            onChange={(event) => setPeriod(event.target.value)}
            disabled={loading}
          >
            {PERIOD_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <button className="admin-btn admin-btn-ghost" disabled>Export PDF</button>
        </div>
      </div>

      {error && (
        <div className="admin-card" style={{ marginBottom: 12, padding: '8px 12px', color: 'var(--admin-danger)' }}>
          {error}
        </div>
      )}

      {Array.isArray(data?.warnings) && data.warnings.length > 0 && (
        <div
          className="admin-card"
          style={{
            marginBottom: 12,
            padding: '10px 14px',
            background: 'rgba(245, 158, 11, 0.08)',
            border: '1px solid rgba(245, 158, 11, 0.25)',
            color: 'var(--admin-warning)',
            fontSize: 12,
            lineHeight: 1.5,
          }}
        >
          <strong>Partial data:</strong> the following sections timed out and were skipped — {data.warnings.join(', ')}.
          Apply the GiST indexes in <code>db+</code> (idx_road_segments_geom_gist, idx_accident_reports_location_gist) so spatial joins use an index, then refresh.
        </div>
      )}

      {/* ═══ SUMMARY KPI STRIP ═══ */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 14 }}>
        <div className="analytics-kpi">
          <div className="analytics-kpi-icon primary"><BoltOutlinedIcon fontSize="inherit" /></div>
          <div className="analytics-kpi-body">
            <span className="analytics-kpi-label">Total Incidents</span>
            <span className="analytics-kpi-value">{summary.totalIncidents ?? '—'}</span>
            <span className={`analytics-kpi-trend ${trendClass(summary.trendPct)}`}>
              {trendIcon(summary.trendPct)}
              {summary.trendPct == null ? '—' : `${summary.trendPct > 0 ? '+' : ''}${summary.trendPct}% vs prev period`}
            </span>
          </div>
        </div>
        <div className="analytics-kpi">
          <div className="analytics-kpi-icon info"><ShowChartRoundedIcon fontSize="inherit" /></div>
          <div className="analytics-kpi-body">
            <span className="analytics-kpi-label">Avg. per Day</span>
            <span className="analytics-kpi-value">{summary.avgPerDay ?? '—'}</span>
            <span className="analytics-kpi-trend stable">
              {summary.previousTotal != null ? `${summary.previousTotal} reports in previous window` : ''}
            </span>
          </div>
        </div>
        <div className="analytics-kpi">
          <div className="analytics-kpi-icon warning"><AccessTimeRoundedIcon fontSize="inherit" /></div>
          <div className="analytics-kpi-body">
            <span className="analytics-kpi-label">Peak Hour</span>
            <span className="analytics-kpi-value" style={{ fontSize: 18 }}>{formatPeakHour(summary.peakHour)}</span>
            <span className="analytics-kpi-trend stable">{summary.peakHourCount ?? 0} incidents in this band</span>
          </div>
        </div>
        <div className="analytics-kpi">
          <div className="analytics-kpi-icon danger"><WhereToVoteOutlinedIcon fontSize="inherit" /></div>
          <div className="analytics-kpi-body">
            <span className="analytics-kpi-label">Most Dangerous Road</span>
            <span className="analytics-kpi-value" style={{ fontSize: 14 }} title={summary.mostDangerousRoad || ''}>
              {summary.mostDangerousRoad || '—'}
            </span>
            <span className="analytics-kpi-trend stable">{summary.mostDangerousRoadIncidents ?? 0} incidents</span>
          </div>
        </div>
      </div>

      {/* ═══ TAB BAR ═══ */}
      <div className="admin-tabs" style={{ marginBottom: 14 }}>
        {TABS.map((t) => (
          <button
            key={t.key}
            className={`admin-tab ${currentTab === t.key ? 'active' : ''}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading && !data && (
        <div className="admin-card">Loading analytics…</div>
      )}

      {/* ═══ TAB: HOURLY HEATMAP ═══ */}
      {currentTab === 'heatmap' && data && (() => {
        // Pre-compute "busiest day" and "busiest hour" for the chip row.
        let topDay = null, topDayCount = 0
        let topHour = null, topHourCount = 0
        const hourTotals = Array(24).fill(0)
        heatmap.rows.forEach((row, ri) => {
          const daySum = row.reduce((sum, v) => sum + v, 0)
          if (daySum > topDayCount) { topDayCount = daySum; topDay = heatmap.days[ri] }
          row.forEach((v, ci) => { hourTotals[ci] += v })
        })
        hourTotals.forEach((v, h) => { if (v > topHourCount) { topHourCount = v; topHour = h } })

        return (
          <div className="admin-card">
            <div className="admin-card-header">
              <div>
                <h3 className="admin-card-title">Incidents by Hour & Day</h3>
                <p className="admin-card-subtitle">Color intensity indicates incident volume. Hover any cell for the exact count.</p>
              </div>
            </div>

            {summary.totalIncidents === 0 ? (
              <p style={{ marginTop: 4, fontSize: 12, color: 'var(--admin-text-muted)' }}>
                No incidents in this period yet.
              </p>
            ) : (
              <>
                <div className="analytics-chip-row">
                  <span className="analytics-chip">
                    <AccessTimeRoundedIcon fontSize="inherit" style={{ color: 'var(--admin-warning)' }} />
                    Busiest hour <strong>{topHour != null ? formatPeakHour(topHour) : '—'}</strong>
                    <span style={{ color: 'var(--admin-text-muted)' }}>· {topHourCount} incidents</span>
                  </span>
                  <span className="analytics-chip">
                    <span className="analytics-chip-dot" style={{ background: '#3B82F6' }} />
                    Busiest day <strong>{topDay || '—'}</strong>
                    <span style={{ color: 'var(--admin-text-muted)' }}>· {topDayCount} incidents</span>
                  </span>
                  <span className="analytics-chip">
                    <BoltOutlinedIcon fontSize="inherit" style={{ color: 'var(--admin-primary)' }} />
                    Peak single cell <strong>{heatmap.max}</strong>
                  </span>
                </div>

                <div style={{ overflowX: 'auto' }}>
                  <div className="admin-heatmap-grid">
                    <div className="admin-heatmap-label"></div>
                    {Array.from({ length: 24 }, (_, h) => (
                      <div key={h} className="admin-heatmap-header">{String(h).padStart(2, '0')}</div>
                    ))}
                    {heatmap.rows.map((row, ri) => (
                      <React.Fragment key={ri}>
                        <div className="admin-heatmap-label">{heatmap.days[ri]}</div>
                        {row.map((val, ci) => {
                          const intensity = heatmap.max > 0 ? val / heatmap.max : 0
                          return (
                            <div
                              key={ci}
                              className="admin-heatmap-cell"
                              title={`${heatmap.days[ri]} ${String(ci).padStart(2, '0')}:00 — ${val} incidents`}
                              style={{
                                background: val === 0
                                  ? 'var(--admin-surface-alt)'
                                  : `rgba(59, 130, 246, ${0.15 + intensity * 0.75})`,
                                color: intensity > 0.5 ? '#fff' : 'var(--admin-text-muted)',
                                borderRadius: 4,
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

                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 14, fontSize: 10, color: 'var(--admin-text-muted)' }}>
                  <span>Low</span>
                  <div style={{ display: 'flex', gap: 2 }}>
                    {[0.15, 0.30, 0.45, 0.60, 0.75, 0.90].map((o, i) => (
                      <div key={i} style={{ width: 20, height: 10, borderRadius: 2, background: `rgba(59, 130, 246, ${o})` }} />
                    ))}
                  </div>
                  <span>High</span>
                </div>
              </>
            )}
          </div>
        )
      })()}

      {/* ═══ TAB: SEVERITY DISTRIBUTION ═══ */}
      {currentTab === 'severity' && data && (() => {
        const topSeverity = severity.reduce((top, s) => (s.count > (top?.count || 0) ? s : top), null)
        return (
          <div className="admin-card">
            <div className="admin-card-header">
              <div>
                <h3 className="admin-card-title">Severity Distribution</h3>
                <p className="admin-card-subtitle">Share of incidents per AI-classified severity tier · {data.periodLabel}</p>
              </div>
              {topSeverity && (
                <span className="analytics-chip" style={{ borderColor: topSeverity.color, background: 'transparent' }}>
                  <span className="analytics-chip-dot" style={{ background: topSeverity.color }} />
                  Top tier <strong style={{ color: topSeverity.color }}>{topSeverity.label}</strong>
                  <span style={{ color: 'var(--admin-text-muted)' }}>· {topSeverity.pct}%</span>
                </span>
              )}
            </div>

            {totalSeverity === 0 ? (
              <p style={{ marginTop: 4, fontSize: 12, color: 'var(--admin-text-muted)' }}>
                No incidents in this period yet.
              </p>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 220px', gap: 24, alignItems: 'center' }}>
                <div>
                  {severity.map((s) => (
                    <div key={s.code} style={{ marginBottom: 16 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, alignItems: 'center' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 12.5, fontWeight: 600, color: s.color }}>
                          <span style={{ width: 10, height: 10, borderRadius: 3, background: s.color, display: 'inline-block' }} />
                          {s.label}
                        </span>
                        <span style={{ fontSize: 12, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                          {s.count}
                          <span style={{ color: 'var(--admin-text-muted)', fontWeight: 500, marginLeft: 6 }}>· {s.pct}%</span>
                        </span>
                      </div>
                      <div className="admin-progress" style={{ height: 10, borderRadius: 5 }}>
                        <div style={{ width: `${s.pct}%`, height: '100%', background: s.color, borderRadius: 5, transition: 'width 0.5s ease' }} />
                      </div>
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <div style={{ position: 'relative', width: 200, height: 200 }}>
                    <svg viewBox="0 0 42 42" style={{ transform: 'rotate(-90deg)', width: '100%', height: '100%' }}>
                      <circle cx="21" cy="21" r="15.9155" fill="none" stroke="var(--admin-surface-2)" strokeWidth="4" />
                      {severity.reduce((acc, s, i) => {
                        if (s.pct > 0) {
                          // gap = 1.5 units between segments for breathing room
                          const dash = Math.max(0, s.pct - 1.5)
                          acc.circles.push(
                            <circle
                              key={i} cx="21" cy="21" r="15.9155" fill="none"
                              stroke={s.color} strokeWidth="4"
                              strokeDasharray={`${dash} ${100 - dash}`}
                              strokeDashoffset={-acc.offset}
                              strokeLinecap="round"
                            />
                          )
                        }
                        acc.offset += s.pct
                        return acc
                      }, { circles: [], offset: 0 }).circles}
                    </svg>
                    <div style={{
                      position: 'absolute', inset: 0,
                      display: 'flex', flexDirection: 'column',
                      alignItems: 'center', justifyContent: 'center',
                    }}>
                      <span style={{ fontSize: 28, fontWeight: 800, color: 'var(--admin-text)', fontVariantNumeric: 'tabular-nums' }}>{totalSeverity}</span>
                      <span style={{ fontSize: 10, color: 'var(--admin-text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 600 }}>Total</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )
      })()}

      {/* ═══ TAB: DANGEROUS ROADS ═══ */}
      {currentTab === 'roads' && data && (
        <div className="admin-card">
          <h3 className="admin-card-title">Top Dangerous Roads</h3>
          <p className="admin-card-subtitle">
            Ranked by incident count — {data.periodLabel}. Reports are spatially matched to the nearest road segment within 75 m.
          </p>
          {dangerousRoads.length === 0 ? (
            <p style={{ marginTop: 12, fontSize: 12, color: 'var(--admin-text-muted)' }}>
              No incidents are mapped to a known road segment in this window.
            </p>
          ) : (
            <div className="admin-table-wrapper" style={{ marginTop: 12 }}>
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Rank</th>
                    <th>Road</th>
                    <th>Incidents</th>
                    <th>Severity</th>
                    <th>Road Class</th>
                    <th>Visual</th>
                  </tr>
                </thead>
                <tbody>
                  {dangerousRoads.map((r, i) => {
                    const medalClass = i === 0 ? 'gold' : i === 1 ? 'silver' : i === 2 ? 'bronze' : ''
                    return (
                      <tr key={r.roadSegmentId}>
                        <td>
                          <span className={`analytics-rank ${medalClass}`}>{i + 1}</span>
                        </td>
                        <td style={{ fontWeight: 600, fontSize: 12 }}>{r.road}</td>
                        <td style={{ fontWeight: 800, fontVariantNumeric: 'tabular-nums', fontSize: 14 }}>{r.incidents}</td>
                        <td><span className={`admin-pill ${r.severity}`}>{r.severity}</span></td>
                        <td>
                          <span style={{
                            fontSize: 10.5, fontWeight: 600,
                            padding: '3px 8px', borderRadius: 999,
                            background: 'var(--admin-surface-2)', color: 'var(--admin-text-secondary)',
                            textTransform: 'capitalize',
                          }}>
                            {r.roadClass || 'unknown'}
                          </span>
                        </td>
                        <td>
                          <div className="admin-progress" style={{ width: 100, height: 6 }}>
                            <div className={`admin-progress-fill ${r.severity === 'high' ? 'danger' : r.severity === 'medium' ? 'warning' : 'success'}`} style={{ width: `${(r.incidents / maxRoadIncidents) * 100}%` }} />
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ═══ TAB: CORRELATIONS ═══ */}
      {currentTab === 'correlations' && data && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div className="admin-card">
            <h3 className="admin-card-title">Road Type Correlation</h3>
            <p className="admin-card-subtitle">Incident distribution by road category</p>
            {roadTypes.length === 0 ? (
              <p style={{ marginTop: 14, fontSize: 12, color: 'var(--admin-text-muted)' }}>
                No incidents in this period yet.
              </p>
            ) : (
              <div style={{ marginTop: 14 }}>
                {roadTypes.map((r) => (
                  <div key={r.type} style={{ marginBottom: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontSize: 11.5 }}>{r.type}</span>
                      <span style={{ fontSize: 11, fontWeight: 600 }}>
                        {r.incidents}{' '}
                        <span style={{ color: 'var(--admin-text-muted)', fontWeight: 400 }}>({r.pct}%)</span>
                      </span>
                    </div>
                    <div className="admin-progress">
                      <div className="admin-progress-fill primary" style={{ width: `${r.pct}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="admin-card">
            <h3 className="admin-card-title">Weather Correlation</h3>
            <p className="admin-card-subtitle">Incident distribution by weather conditions</p>
            <div style={{
              marginTop: 14,
              padding: 18,
              borderRadius: 10,
              border: '1px dashed var(--admin-border)',
              background: 'var(--admin-surface-2)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 8,
              textAlign: 'center',
            }}>
              <CloudOffOutlinedIcon style={{ fontSize: 30, color: 'var(--admin-text-muted)' }} />
              <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--admin-text-secondary)' }}>
                Not wired up yet
              </div>
              <p style={{ fontSize: 11, color: 'var(--admin-text-muted)', margin: 0, lineHeight: 1.55, maxWidth: 320 }}>
                Live reports in <code style={{ fontSize: 10 }}>app.accident_reports</code> don't capture a
                weather snapshot at submit time. Wire that in to populate this chart.
              </p>
            </div>
          </div>

          <div className="admin-card" style={{ gridColumn: 'span 2' }}>
            <div className="admin-card-header">
              <div>
                <h3 className="admin-card-title">Incidents by Time of Day</h3>
                <p className="admin-card-subtitle">4 fixed bands — the peak band is highlighted in violet.</p>
              </div>
            </div>
            {(() => {
              const peakKey = timeOfDay.reduce((peak, t) => (t.incidents > (peak?.incidents || 0) ? t : peak), null)?.key
              return (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginTop: 4 }}>
                  {timeOfDay.map((t) => (
                    <div key={t.key} className={`analytics-tod-card${t.key === peakKey ? ' peak' : ''}`}>
                      <div className="analytics-tod-icon">{TIME_OF_DAY_ICONS[t.key]}</div>
                      <div className="analytics-tod-period">{t.period}</div>
                      <div className="analytics-tod-value">{t.incidents}</div>
                      <div className="analytics-tod-pct">{t.pct}% of total</div>
                    </div>
                  ))}
                </div>
              )
            })()}
          </div>
        </div>
      )}

      {/* ═══ TAB: 7-DAY PREDICTION ═══ */}
      {currentTab === 'predictions' && data && (() => {
        const actuals = weeklyTrend.series.filter((d) => d.actual !== null).map((d) => d.actual)
        const predicted = weeklyTrend.series.filter((d) => d.predicted != null && d.actual === null).map((d) => d.predicted)
        const avg = (arr) => (arr.length ? Math.round((arr.reduce((s, v) => s + v, 0) / arr.length) * 10) / 10 : 0)
        const actualAvg = avg(actuals)
        const predictedAvg = avg(predicted)
        const delta = predictedAvg - actualAvg

        const chartData = weeklyTrend.series.map((d) => ({
          label: d.label,
          date: d.date,
          isActual: d.actual !== null,
          value: d.actual !== null ? d.actual : (d.predicted ?? 0),
        }))

        return (
          <div className="admin-card">
            <div className="admin-card-header">
              <div>
                <h3 className="admin-card-title">7-Day Trend & Prediction</h3>
                <p className="admin-card-subtitle">
                  Solid bars · actual reports per day. Outlined bars · naive lag-7 forecast (same weekday last week).
                </p>
              </div>
            </div>

            {weeklyTrend.series.length === 0 ? (
              <p style={{ marginTop: 4, fontSize: 12, color: 'var(--admin-text-muted)' }}>
                No incidents have been reported recently.
              </p>
            ) : (
              <>
                <div className="analytics-chip-row">
                  <span className="analytics-chip">
                    <span className="analytics-chip-dot" style={{ background: 'var(--admin-primary)' }} />
                    Actual avg <strong>{actualAvg}</strong>
                    <span style={{ color: 'var(--admin-text-muted)' }}>/ day</span>
                  </span>
                  <span className="analytics-chip">
                    <span className="analytics-chip-dot" style={{ background: 'var(--admin-primary)', opacity: 0.45 }} />
                    Predicted avg <strong>{predictedAvg}</strong>
                    <span style={{ color: 'var(--admin-text-muted)' }}>/ day</span>
                  </span>
                  <span className="analytics-chip" style={{ borderColor: delta > 0 ? 'rgba(239, 68, 68, 0.35)' : delta < 0 ? 'rgba(34, 197, 94, 0.35)' : 'var(--admin-border)' }}>
                    {delta > 0
                      ? <TrendingUpRoundedIcon fontSize="inherit" style={{ color: 'var(--admin-danger)' }} />
                      : delta < 0
                        ? <TrendingDownRoundedIcon fontSize="inherit" style={{ color: 'var(--admin-success)' }} />
                        : <TrendingFlatRoundedIcon fontSize="inherit" />}
                    Forecast change
                    <strong style={{ color: delta > 0 ? 'var(--admin-danger)' : delta < 0 ? 'var(--admin-success)' : 'var(--admin-text)' }}>
                      {delta > 0 ? '+' : ''}{delta}
                    </strong>
                  </span>
                </div>

                <div style={{ width: '100%', height: 280, marginTop: 4 }}>
                  <ResponsiveContainer>
                    <BarChart data={chartData} margin={{ top: 10, right: 12, left: 0, bottom: 6 }} barCategoryGap="22%">
                      <CartesianGrid stroke="var(--admin-border)" strokeDasharray="3 4" vertical={false} />
                      <XAxis
                        dataKey="label"
                        tick={{ fontSize: 10.5, fill: 'var(--admin-text-muted)' }}
                        axisLine={{ stroke: 'var(--admin-border)' }}
                        tickLine={false}
                      />
                      <YAxis
                        tick={{ fontSize: 10.5, fill: 'var(--admin-text-muted)' }}
                        axisLine={false}
                        tickLine={false}
                        width={32}
                        allowDecimals={false}
                      />
                      <RechartsTooltip
                        cursor={{ fill: 'rgba(148, 163, 184, 0.08)' }}
                        contentStyle={{
                          background: 'var(--admin-surface)',
                          border: '1px solid var(--admin-border)',
                          borderRadius: 8,
                          fontSize: 11,
                          padding: '6px 10px',
                        }}
                        formatter={(value, _name, item) => [
                          `${value} reports`,
                          item.payload.isActual ? 'Actual' : 'Predicted',
                        ]}
                        labelFormatter={(label, items) => {
                          const date = items?.[0]?.payload?.date
                          return date ? `${label} · ${date}` : label
                        }}
                      />
                      <ReferenceLine
                        y={actualAvg}
                        stroke="var(--admin-primary)"
                        strokeDasharray="4 3"
                        ifOverflow="extendDomain"
                        label={{
                          value: `Avg ${actualAvg}`,
                          position: 'right',
                          fill: 'var(--admin-primary)',
                          fontSize: 10,
                          fontWeight: 700,
                        }}
                      />
                      <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={42}>
                        {chartData.map((d, i) => (
                          <Cell
                            key={`${d.date}-${i}`}
                            fill={d.isActual ? 'var(--admin-primary)' : 'transparent'}
                            stroke={d.isActual ? undefined : 'var(--admin-primary)'}
                            strokeWidth={d.isActual ? 0 : 2}
                            strokeDasharray={d.isActual ? undefined : '4 3'}
                            fillOpacity={d.isActual ? 0.88 : 0.5}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div style={{ display: 'flex', gap: 18, marginTop: 6, fontSize: 10.5, color: 'var(--admin-text-muted)' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <SquareRoundedIcon fontSize="inherit" sx={{ color: 'var(--admin-primary)' }} />
                    Actual (last 7 days)
                  </span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <RemoveRoundedIcon fontSize="inherit" sx={{ color: 'var(--admin-primary)' }} />
                    Predicted (next 7 days)
                  </span>
                </div>

                <div style={{ marginTop: 16, padding: '12px 14px', background: 'rgba(124, 58, 237, 0.06)', borderRadius: 8, border: '1px solid rgba(124, 58, 237, 0.18)' }}>
                  <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--admin-primary)', marginBottom: 4 }}>About the forecast</div>
                  <p style={{ fontSize: 11, color: 'var(--admin-text-secondary)', lineHeight: 1.6, margin: 0 }}>
                    The prediction series is a simple lag-7 baseline — each future day reuses the
                    count seen on the same weekday in the actual window. Swap this in for a real
                    forecaster (e.g. the occurrence model) once a training pipeline is wired up.
                  </p>
                </div>
              </>
            )}
          </div>
        )
      })()}
    </>
  )
}

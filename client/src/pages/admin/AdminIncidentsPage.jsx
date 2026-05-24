import React, { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import ArrowDropDownRoundedIcon from '@mui/icons-material/ArrowDropDownRounded'
import ArrowDropUpRoundedIcon from '@mui/icons-material/ArrowDropUpRounded'
import AccessTimeRoundedIcon from '@mui/icons-material/AccessTimeRounded'
import TagRoundedIcon from '@mui/icons-material/TagRounded'
import PersonOutlineRoundedIcon from '@mui/icons-material/PersonOutlineRounded'
import SwapVertRoundedIcon from '@mui/icons-material/SwapVertRounded'
import SortRoundedIcon from '@mui/icons-material/SortRounded'

import {
  fetchAdminIncidents,
  normalizeIncidentFilter,
} from '../../services/adminIncidentsService'

const EMPTY_TEXT = '\u2014'
const TAB_DEFINITIONS = [
  { key: 'all', label: 'All' },
  { key: 'pending', label: 'Pending' },
  { key: 'suspicious', label: 'Suspected Spam' },
  { key: 'pending-review', label: 'Manual Review' },
  { key: 'ai-flagged', label: 'AI-Flagged' },
  { key: 'community', label: 'Community' },
  { key: 'merged', label: 'Merged' },
  { key: 'archived', label: 'Archived' },
]

function formatIncidentType(value) {
  return String(value || 'other')
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (match) => match.toUpperCase())
}

function formatDateTime(value) {
  if (!value) {
    return EMPTY_TEXT
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return EMPTY_TEXT
  }

  return date.toLocaleString('en', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatPercent(value, digits = 2) {
  return typeof value === 'number' ? `${value.toFixed(digits)}%` : EMPTY_TEXT
}

function formatMlStatus(value) {
  const normalized = String(value || '').trim()
  if (!normalized) {
    return 'Not started'
  }

  return normalized
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (match) => match.toUpperCase())
}

function formatPredictedLabel(value) {
  if (!value) {
    return 'Unclassified'
  }

  return value === 'spam' ? 'Spam' : 'Real'
}

/** Maps spam-model verdicts to the right .admin-pill color class so the eye
 *  can tell "confirmed spam" (red) from "confirmed legit" (green) without
 *  reading the label. */
function getPredictedLabelClass(value) {
  const v = String(value || '').toLowerCase()
  if (v === 'spam') return 'danger'
  if (v === 'real') return 'success'
  return 'unclassified'
}

function getReviewVerdictClass(value) {
  const v = String(value || '').toLowerCase()
  if (v === 'confirmed_spam' || v === 'rejected') return 'danger'
  if (v === 'confirmed_legit' || v === 'verified') return 'success'
  if (v === 'pending_review') return 'warning'
  return ''
}

/** Turn 'confirmed_spam' → 'Confirmed spam' so the table doesn't shout. */
function formatVerdictLabel(value) {
  if (!value) return ''
  return String(value)
    .replace(/[_-]+/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (ch) => ch.toUpperCase())
}

function getConfidenceFillClass(confidence) {
  if (typeof confidence !== 'number') {
    return ''
  }

  if (confidence >= 85) {
    return 'success'
  }

  if (confidence >= 65) {
    return 'warning'
  }

  return 'danger'
}

function getEmptyState(filter, completedAiReports) {
  if (filter === 'ai-flagged' && completedAiReports === 0) {
    return 'AI verification is not active yet for incident reports.'
  }

  if (filter === 'suspicious') {
    return 'No reports are currently classified as suspected spam.'
  }

  if (filter === 'pending-review') {
    return 'No spam-classified reports are waiting for manual review.'
  }

  if (filter === 'community') {
    return 'No reports currently have open community flags.'
  }

  if (filter === 'merged') {
    return 'No merged incidents were found.'
  }

  if (filter === 'archived') {
    return 'No archived incidents were found.'
  }

  if (filter === 'pending') {
    return 'No pending incidents are waiting for review.'
  }

  return 'No incidents match the current filters.'
}

function downloadCsv(rows) {
  if (!rows.length) {
    return
  }

  const header = [
    'Display ID',
    'Report ID',
    'Type',
    'Title',
    'Location',
    'Severity',
    'Predicted Label',
    'Spam Score',
    'ML Confidence',
    'ML Status',
    'Model Version',
    'Classified At',
    'Review Verdict',
    'AI Confidence',
    'Reporter Score',
    'Status',
    'Open Flags',
    'Created At',
  ]

  const csvRows = rows.map((row) => [
    row.displayId,
    row.reportId,
    row.incidentType,
    row.title,
    row.location,
    row.severity,
    row.predictedLabel || '',
    row.spamScore ?? '',
    row.mlConfidence ?? '',
    row.mlStatus || '',
    row.modelVersion || '',
    row.classifiedAt || '',
    row.reviewVerdict || '',
    row.confidence ?? '',
    row.reporterScore ?? '',
    row.status,
    row.openFlagCount,
    row.createdAt || '',
  ])

  const content = [header, ...csvRows]
    .map((line) => line.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(','))
    .join('\n')

  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = 'admin-incidents.csv'
  anchor.click()
  URL.revokeObjectURL(url)
}

function renderReporterScore(score) {
  if (typeof score !== 'number') {
    return (
      <span style={{ fontWeight: 600, fontSize: 11, color: 'var(--admin-text-muted)' }}>
        Not provided
      </span>
    )
  }

  return (
    <span
      style={{
        fontWeight: 700,
        fontSize: 11.5,
        color: score >= 75 ? 'var(--admin-success)' : score >= 40 ? 'var(--admin-warning)' : 'var(--admin-danger)',
      }}
    >
      {score.toFixed(1)}%
    </span>
  )
}

function renderSpamAnalysisCell(incident) {
  const verdictClass = incident.pendingSpamReview
    ? 'warning'
    : getReviewVerdictClass(incident.reviewVerdict)
  const verdictLabel = incident.reviewVerdict
    ? formatVerdictLabel(incident.reviewVerdict)
    : incident.pendingSpamReview
      ? 'Pending review'
      : formatMlStatus(incident.mlStatus)
  return (
    <div style={{ display: 'grid', gap: 4, minWidth: 180 }}>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        <span className={`admin-pill ${getPredictedLabelClass(incident.predictedLabel)}`}>
          {formatPredictedLabel(incident.predictedLabel)}
        </span>
        <span className={`admin-pill ${verdictClass || 'unclassified'}`}>
          {verdictLabel}
        </span>
      </div>
      <div style={{ fontSize: 11, color: 'var(--admin-text-secondary)', display: 'grid', gap: 2 }}>
        <span>Spam score: <strong>{formatPercent(incident.spamScore)}</strong></span>
        <span>ML confidence: <strong>{formatPercent(incident.mlConfidence)}</strong></span>
        <span>ML status: <strong>{formatMlStatus(incident.mlStatus)}</strong></span>
        <span>Model: <strong>{incident.modelVersion || EMPTY_TEXT}</strong></span>
      </div>
    </div>
  )
}

export default function AdminIncidentsPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [search, setSearch] = useState('')
  // Default to "newest first by time" — most natural starting point for moderators.
  const [sortField, setSortField] = useState('createdAt')
  const [sortDir, setSortDir] = useState('desc')
  const [incidents, setIncidents] = useState([])
  const [counts, setCounts] = useState({
    all: 0,
    pending: 0,
    suspicious: 0,
    'pending-review': 0,
    'ai-flagged': 0,
    community: 0,
    merged: 0,
    archived: 0,
    completedAiReports: 0,
  })
  const [meta, setMeta] = useState({
    completedAiReports: 0,
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  /* Click-and-drag scrolling on the incidents table. Holds left mouse button
   * down anywhere in the table and drags to scroll both axes. */
  const tableScrollRef = useRef(null)
  const dragStateRef = useRef(null)
  const [isDragging, setIsDragging] = useState(false)

  const handleTableMouseDown = (event) => {
    // Skip drag-scroll when the click started on something interactive — the
    // row actions, sort headers, links etc. should still work normally.
    if (event.button !== 0) return
    if (event.target.closest('button, a, input, select, textarea, th')) return
    const el = tableScrollRef.current
    if (!el) return
    dragStateRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      scrollLeft: el.scrollLeft,
      scrollTop: el.scrollTop,
      moved: false,
    }
    setIsDragging(true)
  }
  const handleTableMouseMove = (event) => {
    const state = dragStateRef.current
    const el = tableScrollRef.current
    if (!state || !el) return
    const dx = event.clientX - state.startX
    const dy = event.clientY - state.startY
    if (!state.moved && (Math.abs(dx) > 3 || Math.abs(dy) > 3)) {
      state.moved = true
    }
    el.scrollLeft = state.scrollLeft - dx
    el.scrollTop = state.scrollTop - dy
  }
  const endTableDrag = () => {
    if (dragStateRef.current) {
      dragStateRef.current = null
      setIsDragging(false)
    }
  }
  // Suppress the trailing click that follows a real drag, so dragging to
  // scroll doesn't accidentally fire a row click handler.
  const handleTableClickCapture = (event) => {
    const state = dragStateRef.current
    if (state && state.moved) {
      event.stopPropagation()
      event.preventDefault()
    }
  }

  const filterParam = normalizeIncidentFilter(searchParams.get('filter') || 'all')

  useEffect(() => {
    const controller = new AbortController()

    async function loadIncidents() {
      setLoading(true)
      setError(null)

      try {
        const payload = await fetchAdminIncidents(
          {
            filter: filterParam,
            search,
            sortField,
            sortDir,
          },
          { signal: controller.signal },
        )

        if (!controller.signal.aborted) {
          setIncidents(payload.incidents)
          setCounts(payload.counts)
          setMeta(payload.meta)
        }
      } catch (requestError) {
        if (!controller.signal.aborted) {
          setError(requestError)
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false)
        }
      }
    }

    loadIncidents()

    return () => controller.abort()
  }, [filterParam, search, sortField, sortDir])

  function toggleSort(field) {
    if (sortField === field) {
      setSortDir((current) => (current === 'desc' ? 'asc' : 'desc'))
      return
    }

    setSortField(field)
    setSortDir('desc')
  }

  function SortIcon({ field }) {
    if (sortField !== field) {
      return null
    }

    return (
      <span style={{ marginLeft: 3, display: 'inline-flex', alignItems: 'center' }}>
        {sortDir === 'desc' ? <ArrowDropDownRoundedIcon fontSize="small" /> : <ArrowDropUpRoundedIcon fontSize="small" />}
      </span>
    )
  }

  return (
    <>
      <div className="admin-page-header">
        <div>
          <h1 className="admin-page-title">Incident Management</h1>
          <p className="admin-page-subtitle">Review real incident moderation data and spam detection outcomes</p>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <input
            className="admin-input"
            type="text"
            placeholder="Search ID, title, location, reporter…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            style={{ width: 260, height: 32, fontSize: 11.5 }}
          />
          <button
            className="admin-btn admin-btn-ghost"
            type="button"
            onClick={() => downloadCsv(incidents)}
            disabled={!incidents.length}
          >
            Export CSV
          </button>
        </div>
      </div>

      <div className="admin-incidents-toolbar">
        <div className="admin-tabs admin-incidents-toolbar-tabs" style={{ marginBottom: 0 }}>
          {TAB_DEFINITIONS.map((tab) => (
            <button
              key={tab.key}
              className={`admin-tab ${filterParam === tab.key ? 'active' : ''}`}
              onClick={() => setSearchParams(tab.key === 'all' ? {} : { filter: tab.key })}
            >
              {tab.label}
              <span className="tab-count">{counts[tab.key] ?? 0}</span>
            </button>
          ))}
        </div>

        {(() => {
          const sortOptions = [
            { key: 'createdAt', label: 'Time',   Icon: AccessTimeRoundedIcon },
            { key: 'id',        label: 'ID',     Icon: TagRoundedIcon },
            { key: 'reporter',  label: 'User',   Icon: PersonOutlineRoundedIcon },
          ]
          const activeIndex = Math.max(0, sortOptions.findIndex((o) => o.key === sortField))
          const segmentWidthPct = 100 / sortOptions.length
          const ascendingLabel = sortField === 'createdAt'
            ? 'Oldest first'
            : sortField === 'id'
              ? 'A → Z'
              : 'A → Z'
          const descendingLabel = sortField === 'createdAt'
            ? 'Newest first'
            : sortField === 'id'
              ? 'Z → A'
              : 'Z → A'
          const dirLabel = sortDir === 'desc' ? descendingLabel : ascendingLabel
          return (
            <div className="admin-sort-control">
              <span className="admin-sort-label">
                <SortRoundedIcon fontSize="inherit" />
                Sort by
              </span>
              <div
                className="admin-sort-segment"
                role="tablist"
                aria-label="Sort field"
              >
                <span
                  className="admin-sort-indicator"
                  style={{
                    width: `calc(${segmentWidthPct}% - 4px)`,
                    transform: `translateX(${activeIndex * 100}%)`,
                  }}
                  aria-hidden="true"
                />
                {sortOptions.map((option) => {
                  const isActive = option.key === sortField
                  const { Icon } = option
                  return (
                    <button
                      key={option.key}
                      type="button"
                      role="tab"
                      aria-selected={isActive}
                      className={`admin-sort-seg-btn${isActive ? ' is-active' : ''}`}
                      onClick={() => {
                        if (sortField === option.key) return
                        setSortField(option.key)
                        setSortDir('desc')
                      }}
                    >
                      <Icon fontSize="inherit" />
                      <span>{option.label}</span>
                    </button>
                  )
                })}
              </div>
              <button
                type="button"
                className={`admin-sort-dir${sortDir === 'asc' ? ' is-asc' : ''}`}
                onClick={() => setSortDir((current) => (current === 'desc' ? 'asc' : 'desc'))}
                title={dirLabel}
                aria-label={`Toggle sort direction — currently ${dirLabel}`}
              >
                <span className="admin-sort-dir-icon" aria-hidden="true">
                  <SwapVertRoundedIcon fontSize="inherit" />
                </span>
                <span className="admin-sort-dir-label">{dirLabel}</span>
              </button>
            </div>
          )
        })()}
      </div>

      {error && (
        <div
          className="admin-card"
          style={{
            marginBottom: 12,
            borderColor: 'rgba(239, 68, 68, 0.35)',
            background: 'rgba(239, 68, 68, 0.05)',
          }}
        >
          <div className="admin-card-header">
            <div>
              <h2 className="admin-card-title">Unable to load incidents</h2>
              <p className="admin-card-subtitle">{error.message || 'Please try again.'}</p>
            </div>
          </div>
        </div>
      )}

      <div className="admin-card">
        <div
          ref={tableScrollRef}
          className={`admin-table-wrapper admin-drag-scroll${isDragging ? ' dragging' : ''}`}
          onMouseDown={handleTableMouseDown}
          onMouseMove={handleTableMouseMove}
          onMouseUp={endTableDrag}
          onMouseLeave={endTableDrag}
          onClickCapture={handleTableClickCapture}
        >
          <table className="admin-table">
            <thead>
              <tr>
                <th style={{ cursor: 'pointer' }} onClick={() => toggleSort('id')}>ID <SortIcon field="id" /></th>
                <th style={{ cursor: 'pointer' }} onClick={() => toggleSort('incidentType')}>Type <SortIcon field="incidentType" /></th>
                <th style={{ cursor: 'pointer' }} onClick={() => toggleSort('location')}>Location <SortIcon field="location" /></th>
                <th style={{ cursor: 'pointer' }} onClick={() => toggleSort('severity')}>Severity <SortIcon field="severity" /></th>
                <th style={{ cursor: 'pointer' }} onClick={() => toggleSort('spamScore')}>Spam Analysis <SortIcon field="spamScore" /></th>
                <th style={{ cursor: 'pointer' }} onClick={() => toggleSort('confidence')}>AI Confidence <SortIcon field="confidence" /></th>
                <th style={{ cursor: 'pointer' }} onClick={() => toggleSort('reporterScore')}>Reporter Trust <SortIcon field="reporterScore" /></th>
                <th style={{ cursor: 'pointer' }} onClick={() => toggleSort('createdAt')}>Reported <SortIcon field="createdAt" /></th>
                <th style={{ cursor: 'pointer' }} onClick={() => toggleSort('classifiedAt')}>Classified <SortIcon field="classifiedAt" /></th>
                <th style={{ cursor: 'pointer' }} onClick={() => toggleSort('status')}>Status <SortIcon field="status" /></th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={11} style={{ textAlign: 'center', padding: 32, color: 'var(--admin-text-muted)' }}>
                    Loading incidents…
                  </td>
                </tr>
              ) : incidents.length > 0 ? (
                incidents.map((incident) => (
                  <tr
                    key={incident.reportId}
                    className={incident.pendingSpamReview || incident.predictedLabel === 'spam' ? 'row-highlight' : ''}
                  >
                    <td style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                      {incident.displayId}
                    </td>
                    <td style={{ fontSize: 11 }}>{formatIncidentType(incident.incidentType)}</td>
                    <td style={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {incident.location}
                    </td>
                    <td>
                      <span className={`admin-pill ${incident.severity}`}>{incident.severity}</span>
                    </td>
                    <td>{renderSpamAnalysisCell(incident)}</td>
                    <td>
                      {typeof incident.confidence === 'number' && incident.confidenceStatus === 'completed' ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                          <div className="admin-progress" style={{ width: 44 }}>
                            <div
                              className={`admin-progress-fill ${getConfidenceFillClass(incident.confidence)}`}
                              style={{ width: `${incident.confidence}%` }}
                            ></div>
                          </div>
                          <span style={{ fontSize: 10.5, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                            {incident.confidence}%
                          </span>
                        </div>
                      ) : (
                        <span style={{ fontSize: 11, color: 'var(--admin-text-muted)', fontWeight: 500 }}>
                          {incident.confidenceStatus === 'pending'
                            ? 'Pending AI'
                            : incident.confidenceStatus === 'failed'
                              ? 'AI failed'
                              : EMPTY_TEXT}
                        </span>
                      )}
                    </td>
                    <td>{renderReporterScore(incident.reporterScore)}</td>
                    <td style={{ fontSize: 11, color: 'var(--admin-text-secondary)' }}>
                      <div>{incident.ago}</div>
                      <div style={{ marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>{formatDateTime(incident.createdAt)}</div>
                    </td>
                    <td style={{ fontSize: 11, color: 'var(--admin-text-secondary)' }}>
                      {formatDateTime(incident.classifiedAt)}
                    </td>
                    <td>
                      <div style={{ display: 'grid', gap: 4 }}>
                        <span className={`admin-pill ${incident.status}`}>{incident.status}</span>
                        {incident.reviewVerdict ? (
                          <span className={`admin-pill ${getReviewVerdictClass(incident.reviewVerdict) || 'unclassified'}`}>
                            {formatVerdictLabel(incident.reviewVerdict)}
                          </span>
                        ) : incident.pendingSpamReview ? (
                          <span className="admin-pill warning">Awaiting review</span>
                        ) : null}
                        {incident.openFlagCount > 0 ? (
                          <span className="admin-pill warning">{incident.openFlagCount} flag{incident.openFlagCount === 1 ? '' : 's'}</span>
                        ) : null}
                      </div>
                    </td>
                    <td>
                      <button
                        className="admin-btn admin-btn-sm admin-btn-primary"
                        onClick={() => navigate(`/admin/incidents/${incident.reportId}`)}
                      >
                        Review
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={11} style={{ textAlign: 'center', padding: 32, color: 'var(--admin-text-muted)' }}>
                    {getEmptyState(filterParam, meta.completedAiReports)}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '10px 14px',
            borderTop: '1px solid var(--admin-border)',
            fontSize: 11,
            color: 'var(--admin-text-muted)',
          }}
        >
          <span>
            Showing {incidents.length} of {counts[filterParam] ?? 0} incidents
          </span>
          <span>
            Suspicious: {counts.suspicious} · Manual review: {counts['pending-review']}
          </span>
        </div>
      </div>
    </>
  )
}

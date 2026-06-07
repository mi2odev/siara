/**
 * SIARA Admin — Incident Management
 *
 * Triage table for accident reports. Surfaces moderation state, spam-model
 * outputs, reporter trust, and lets admins drill into the full review page.
 *
 * Styling lives in styles/AdminIncidents.css. No inline styles below.
 */

import React, { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'

import ArrowDropDownRoundedIcon from '@mui/icons-material/ArrowDropDownRounded'
import ArrowDropUpRoundedIcon   from '@mui/icons-material/ArrowDropUpRounded'
import AccessTimeRoundedIcon    from '@mui/icons-material/AccessTimeRounded'
import TagRoundedIcon           from '@mui/icons-material/TagRounded'
import PersonOutlineRoundedIcon from '@mui/icons-material/PersonOutlineRounded'
import KeyboardArrowDownRoundedIcon from '@mui/icons-material/KeyboardArrowDownRounded'
import CheckRoundedIcon         from '@mui/icons-material/CheckRounded'
import SortRoundedIcon          from '@mui/icons-material/SortRounded'
import SignalCellularAltRoundedIcon from '@mui/icons-material/SignalCellularAltRounded'
import ShieldOutlinedIcon       from '@mui/icons-material/ShieldOutlined'
import SearchRoundedIcon        from '@mui/icons-material/SearchRounded'
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined'
import ErrorOutlineRoundedIcon  from '@mui/icons-material/ErrorOutlineRounded'

import {
  fetchAdminIncidents,
  normalizeIncidentFilter,
} from '../../services/adminIncidentsService'

import '../../styles/AdminIncidents.css'

/* ──────────────────────────────────────────────────────────────────
   Constants
   ────────────────────────────────────────────────────────────────── */

const EMPTY = '—'

const TAB_DEFINITIONS = [
  { key: 'all',            label: 'All'              },
  { key: 'pending',        label: 'Pending'          },
  { key: 'suspicious',     label: 'Suspected Spam'   },
  { key: 'pending-review', label: 'Manual Review'    },
  { key: 'ai-flagged',     label: 'AI-Flagged'       },
  { key: 'community',      label: 'Community'        },
  { key: 'merged',         label: 'Merged'           },
  { key: 'archived',       label: 'Archived'         },
]

/* ──────────────────────────────────────────────────────────────────
   Formatters
   ────────────────────────────────────────────────────────────────── */

function formatIncidentType(value) {
  return String(value || 'other')
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (m) => m.toUpperCase())
}

function formatDateTime(value) {
  if (!value) return EMPTY
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return EMPTY
  return d.toLocaleString('en', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function formatPercent(value, digits = 2) {
  return typeof value === 'number' ? `${value.toFixed(digits)}%` : EMPTY
}

function formatMlStatus(value) {
  const v = String(value || '').trim()
  if (!v) return 'Not started'
  return v.replace(/[_-]+/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase())
}

function formatPredictedLabel(value) {
  if (!value) return 'Unclassified'
  return value === 'spam' ? 'Spam' : 'Real'
}

function predictedPillKey(value) {
  const v = String(value || '').toLowerCase()
  if (v === 'spam') return 'danger'
  if (v === 'real') return 'success'
  return 'unclassified'
}

function reviewVerdictPillKey(value) {
  const v = String(value || '').toLowerCase()
  if (v === 'confirmed_spam'  || v === 'rejected') return 'danger'
  if (v === 'confirmed_legit' || v === 'verified') return 'success'
  if (v === 'pending_review')                      return 'warning'
  return 'unclassified'
}

function formatVerdictLabel(value) {
  if (!value) return ''
  return String(value)
    .replace(/[_-]+/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (ch) => ch.toUpperCase())
}

function confidenceFillKey(confidence) {
  if (typeof confidence !== 'number') return ''
  if (confidence >= 85) return 'success'
  if (confidence >= 65) return 'warning'
  return 'danger'
}

function trustKey(score) {
  if (typeof score !== 'number') return 'none'
  if (score >= 75) return 'high'
  if (score >= 40) return 'mid'
  return 'low'
}

function emptyStateText(filter, completedAiReports) {
  if (filter === 'ai-flagged' && completedAiReports === 0) {
    return 'AI verification is not active yet for incident reports.'
  }
  if (filter === 'suspicious')     return 'No reports are currently classified as suspected spam.'
  if (filter === 'pending-review') return 'No spam-classified reports are waiting for manual review.'
  if (filter === 'community')      return 'No reports currently have open community flags.'
  if (filter === 'merged')         return 'No merged incidents were found.'
  if (filter === 'archived')       return 'No archived incidents were found.'
  if (filter === 'pending')        return 'No pending incidents are waiting for review.'
  return 'No incidents match the current filters.'
}

/* ──────────────────────────────────────────────────────────────────
   CSV export
   ────────────────────────────────────────────────────────────────── */

function downloadCsv(rows) {
  if (!rows.length) return
  const header = [
    'Display ID', 'Report ID', 'Type', 'Title', 'Location', 'Severity',
    'Predicted Label', 'Spam Score', 'ML Confidence', 'ML Status',
    'Model Version', 'Classified At', 'Review Verdict', 'AI Confidence',
    'Reporter Score', 'Status', 'Open Flags', 'Created At',
  ]
  const csvRows = rows.map((r) => [
    r.displayId, r.reportId, r.incidentType, r.title, r.location, r.severity,
    r.predictedLabel || '', r.spamScore ?? '', r.mlConfidence ?? '',
    r.mlStatus || '', r.modelVersion || '', r.classifiedAt || '',
    r.reviewVerdict || '', r.confidence ?? '', r.reporterScore ?? '',
    r.status, r.openFlagCount, r.createdAt || '',
  ])
  const content = [header, ...csvRows]
    .map((line) => line.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(','))
    .join('\n')

  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'admin-incidents.csv'
  a.click()
  URL.revokeObjectURL(url)
}

/* ══════════════════════════════════════════════════════════════════
   PAGE
   ══════════════════════════════════════════════════════════════════ */

export default function AdminIncidentsPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [search, setSearch] = useState('')
  const [sortField, setSortField] = useState('createdAt')
  const [sortDir, setSortDir] = useState('desc')

  const [incidents, setIncidents] = useState([])
  const [counts, setCounts]       = useState({
    all: 0, pending: 0, suspicious: 0, 'pending-review': 0,
    'ai-flagged': 0, community: 0, merged: 0, archived: 0,
    completedAiReports: 0,
  })
  const [meta, setMeta]           = useState({ completedAiReports: 0 })
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState(null)

  /* Click-and-drag scroll on the table */
  const tableScrollRef = useRef(null)
  const dragStateRef = useRef(null)
  const [isDragging, setIsDragging] = useState(false)

  const handleTableMouseDown = (event) => {
    if (event.button !== 0) return
    if (event.target.closest('button, a, input, select, textarea, th')) return
    const el = tableScrollRef.current
    if (!el) return
    dragStateRef.current = {
      startX: event.clientX, startY: event.clientY,
      scrollLeft: el.scrollLeft, scrollTop: el.scrollTop, moved: false,
    }
    setIsDragging(true)
  }
  const handleTableMouseMove = (event) => {
    const state = dragStateRef.current
    const el = tableScrollRef.current
    if (!state || !el) return
    const dx = event.clientX - state.startX
    const dy = event.clientY - state.startY
    if (!state.moved && (Math.abs(dx) > 3 || Math.abs(dy) > 3)) state.moved = true
    el.scrollLeft = state.scrollLeft - dx
    el.scrollTop  = state.scrollTop  - dy
  }
  const endTableDrag = () => {
    if (dragStateRef.current) {
      dragStateRef.current = null
      setIsDragging(false)
    }
  }
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
      setLoading(true); setError(null)
      try {
        const payload = await fetchAdminIncidents(
          { filter: filterParam, search, sortField, sortDir },
          { signal: controller.signal },
        )
        if (!controller.signal.aborted) {
          setIncidents(payload.incidents)
          setCounts(payload.counts)
          setMeta(payload.meta)
        }
      } catch (err) {
        if (!controller.signal.aborted) setError(err)
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }
    loadIncidents()
    return () => controller.abort()
  }, [filterParam, search, sortField, sortDir])

  function toggleSort(field) {
    if (sortField === field) {
      setSortDir((cur) => (cur === 'desc' ? 'asc' : 'desc'))
      return
    }
    setSortField(field)
    setSortDir('desc')
  }

  function SortArrow({ field }) {
    if (sortField !== field) return null
    return (
      <span className="incidents__table th-arrow">
        {sortDir === 'desc'
          ? <ArrowDropDownRoundedIcon fontSize="small" />
          : <ArrowDropUpRoundedIcon fontSize="small" />}
      </span>
    )
  }

  return (
    <div className="incidents-root">

      {/* ── HEADER ──────────────────────────────────────────────── */}
      <header className="incidents__header">
        <div className="incidents__title-group">
          <div className="incidents__brand">
            <ShieldOutlinedIcon fontSize="inherit" />
          </div>
          <div>
            <h1 className="incidents__title">Incident Management</h1>
            <p className="incidents__title-meta">
              <strong>{counts[filterParam] ?? 0}</strong> {filterParam === 'all' ? 'incidents' : `in ${TAB_DEFINITIONS.find((t) => t.key === filterParam)?.label.toLowerCase() || filterParam}`}
              {' · '}
              <strong>{counts.suspicious}</strong> suspicious
              {' · '}
              <strong>{counts['pending-review']}</strong> manual review
            </p>
          </div>
        </div>

        <div className="incidents__header-actions">
          <label className="incidents__search">
            <SearchRoundedIcon className="incidents__search-icon" />
            <input
              className="incidents__search-input"
              type="text"
              placeholder="Search ID, title, location, reporter…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
          <button
            type="button"
            className="iy-btn"
            onClick={() => downloadCsv(incidents)}
            disabled={!incidents.length}
          >
            <FileDownloadOutlinedIcon style={{ fontSize: 15 }} />
            Export CSV
          </button>
        </div>
      </header>

      {/* ── TOOLBAR: tabs + sort ───────────────────────────────── */}
      <div className="incidents__toolbar">
        <TabsRow
          tabs={TAB_DEFINITIONS}
          activeKey={filterParam}
          counts={counts}
          onSelect={(key) => setSearchParams(key === 'all' ? {} : { filter: key })}
        />

        <SortMenu
          sortField={sortField}
          sortDir={sortDir}
          onChange={(field, dir) => { setSortField(field); setSortDir(dir) }}
        />
      </div>

      {/* ── ERROR ──────────────────────────────────────────────── */}
      {error ? (
        <div className="incidents__error">
          <ErrorOutlineRoundedIcon style={{ fontSize: 18, marginTop: 1 }} />
          <span>
            <span className="incidents__error-title">Unable to load incidents.</span>
            {error.message || 'Please try again.'}
          </span>
        </div>
      ) : null}

      {/* ── TABLE PANEL ────────────────────────────────────────── */}
      <div className="incidents__panel">
        <div
          ref={tableScrollRef}
          className={`incidents__table-scroll${isDragging ? ' is-dragging' : ''}`}
          onMouseDown={handleTableMouseDown}
          onMouseMove={handleTableMouseMove}
          onMouseUp={endTableDrag}
          onMouseLeave={endTableDrag}
          onClickCapture={handleTableClickCapture}
        >
          <table className="incidents__table">
            <thead>
              <tr>
                <th className={sortField === 'id' ? 'is-sorted' : ''} onClick={() => toggleSort('id')}>
                  ID <SortArrow field="id" />
                </th>
                <th className={sortField === 'incidentType' ? 'is-sorted' : ''} onClick={() => toggleSort('incidentType')}>
                  Type <SortArrow field="incidentType" />
                </th>
                <th className={sortField === 'location' ? 'is-sorted' : ''} onClick={() => toggleSort('location')}>
                  Location <SortArrow field="location" />
                </th>
                <th className={sortField === 'severity' ? 'is-sorted' : ''} onClick={() => toggleSort('severity')}>
                  Severity <SortArrow field="severity" />
                </th>
                <th className={sortField === 'spamScore' ? 'is-sorted' : ''} onClick={() => toggleSort('spamScore')}>
                  Spam Analysis <SortArrow field="spamScore" />
                </th>
                <th className={sortField === 'confidence' ? 'is-sorted' : ''} onClick={() => toggleSort('confidence')}>
                  AI Confidence <SortArrow field="confidence" />
                </th>
                <th className={sortField === 'reporterScore' ? 'is-sorted' : ''} onClick={() => toggleSort('reporterScore')}>
                  Reporter <SortArrow field="reporterScore" />
                </th>
                <th className={sortField === 'createdAt' ? 'is-sorted' : ''} onClick={() => toggleSort('createdAt')}>
                  Reported <SortArrow field="createdAt" />
                </th>
                <th className={sortField === 'status' ? 'is-sorted' : ''} onClick={() => toggleSort('status')}>
                  Status <SortArrow field="status" />
                </th>
                <th style={{ cursor: 'default' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={10}>
                    <div className="incidents__placeholder">Loading incidents…</div>
                  </td>
                </tr>
              ) : incidents.length > 0 ? (
                incidents.map((incident) => (
                  <IncidentRow
                    key={incident.reportId}
                    incident={incident}
                    onReview={() => navigate(`/admin/incidents/${incident.reportId}`)}
                  />
                ))
              ) : (
                <tr>
                  <td colSpan={10}>
                    <div className="incidents__placeholder">
                      <h3 className="incidents__placeholder-title">No incidents found</h3>
                      {emptyStateText(filterParam, meta.completedAiReports)}
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="incidents__footer">
          <span>
            Showing <strong>{incidents.length}</strong> of <strong>{counts[filterParam] ?? 0}</strong> incidents
          </span>
          <span>
            <strong>{counts.suspicious}</strong> suspicious · <strong>{counts['pending-review']}</strong> awaiting manual review
          </span>
        </div>
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════════
   SORT MENU — compact dropdown listing every (field, dir) combo
   ══════════════════════════════════════════════════════════════════ */

const SORT_MENU_ITEMS = [
  { field: 'createdAt', dir: 'desc', label: 'Newest first',       Icon: AccessTimeRoundedIcon },
  { field: 'createdAt', dir: 'asc',  label: 'Oldest first',       Icon: AccessTimeRoundedIcon },
  { field: 'severity',  dir: 'desc', label: 'Severity · High → Low', Icon: SignalCellularAltRoundedIcon },
  { field: 'severity',  dir: 'asc',  label: 'Severity · Low → High', Icon: SignalCellularAltRoundedIcon },
  { field: 'id',        dir: 'asc',  label: 'ID · A → Z',         Icon: TagRoundedIcon },
  { field: 'id',        dir: 'desc', label: 'ID · Z → A',         Icon: TagRoundedIcon },
  { field: 'reporter',  dir: 'asc',  label: 'User · A → Z',       Icon: PersonOutlineRoundedIcon },
  { field: 'reporter',  dir: 'desc', label: 'User · Z → A',       Icon: PersonOutlineRoundedIcon },
]

function SortMenu({ sortField, sortDir, onChange }) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef(null)

  const active = SORT_MENU_ITEMS.find((i) => i.field === sortField && i.dir === sortDir)
    || SORT_MENU_ITEMS[0]

  // Close on outside click or Escape.
  useEffect(() => {
    if (!open) return undefined
    const onDoc = (e) => {
      if (!rootRef.current?.contains(e.target)) setOpen(false)
    }
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div className="incidents__sort" ref={rootRef}>
      <button
        type="button"
        className="incidents__sort-trigger"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((o) => !o)}
      >
        <SortRoundedIcon style={{ fontSize: 14, color: 'currentColor', opacity: 0.7 }} />
        <span className="incidents__sort-trigger-label">Sort:</span>
        <span className="incidents__sort-trigger-value">{active.label}</span>
        <span className="incidents__sort-trigger-caret">
          <KeyboardArrowDownRoundedIcon style={{ fontSize: 16 }} />
        </span>
      </button>

      {open ? (
        <div className="incidents__sort-menu" role="menu">
          <div className="incidents__sort-menu-section">Sort by</div>
          {SORT_MENU_ITEMS.map((item, idx) => {
            const isActive = item.field === active.field && item.dir === active.dir
            const { Icon } = item
            // Visual group separator between sort fields (every 2 items)
            const showDivider = idx > 0 && idx % 2 === 0
            return (
              <React.Fragment key={`${item.field}-${item.dir}`}>
                {showDivider ? <div className="incidents__sort-menu-divider" /> : null}
                <button
                  type="button"
                  role="menuitemradio"
                  aria-checked={isActive}
                  className={`incidents__sort-menu-item${isActive ? ' incidents__sort-menu-item--active' : ''}`}
                  onClick={() => { onChange(item.field, item.dir); setOpen(false) }}
                >
                  <Icon className="incidents__sort-menu-item-icon" />
                  <span>{item.label}</span>
                  {isActive ? (
                    <CheckRoundedIcon className="incidents__sort-menu-item-check" />
                  ) : null}
                </button>
              </React.Fragment>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════════
   TABS ROW — full-width tab strip with overflow-aware fade indicator
   ══════════════════════════════════════════════════════════════════ */

function TabsRow({ tabs, activeKey, counts, onSelect }) {
  const scrollRef = useRef(null)
  const [overflow, setOverflow] = useState(false)

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return undefined

    const measure = () => {
      // Show fade only when there's content to the right of the visible area.
      const hasMore = el.scrollWidth - el.clientWidth - el.scrollLeft > 4
      setOverflow(hasMore)
    }

    measure()
    el.addEventListener('scroll', measure, { passive: true })
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => {
      el.removeEventListener('scroll', measure)
      ro.disconnect()
    }
  }, [tabs.length])

  return (
    <div className={`incidents__tabs-wrap${overflow ? ' is-overflowing' : ''}`}>
      <nav className="incidents__tabs" ref={scrollRef}>
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            className={`incidents__tab ${activeKey === tab.key ? 'incidents__tab--active' : ''}`}
            onClick={() => onSelect(tab.key)}
          >
            {tab.label}
            <span className="incidents__tab-count">{counts[tab.key] ?? 0}</span>
          </button>
        ))}
      </nav>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════════
   ROW
   ══════════════════════════════════════════════════════════════════ */

function IncidentRow({ incident, onReview }) {
  const flagged = incident.pendingSpamReview || incident.predictedLabel === 'spam'

  const verdictKey = incident.pendingSpamReview
    ? 'warning'
    : reviewVerdictPillKey(incident.reviewVerdict)
  const verdictLabel = incident.reviewVerdict
    ? formatVerdictLabel(incident.reviewVerdict)
    : incident.pendingSpamReview
      ? 'Pending review'
      : formatMlStatus(incident.mlStatus)

  const trust = trustKey(incident.reporterScore)

  return (
    <tr className={flagged ? 'is-flagged' : ''}>
      {/* ID */}
      <td>
        <div className="iy-id">
          <span className="iy-id__code">{incident.displayId}</span>
          {incident.mergedChildCount > 0 ? (
            <span
              title={`Consolidated report — ${incident.mergedChildCount + 1} reports merged together`}
              style={{
                marginTop: 4,
                display: 'inline-block',
                fontSize: 10,
                fontWeight: 700,
                padding: '2px 7px',
                borderRadius: 999,
                background: '#EEF2FF',
                color: '#4338CA',
                width: 'fit-content',
              }}
            >
              {incident.mergedChildCount + 1} reports merged
            </span>
          ) : null}
        </div>
      </td>

      {/* Type */}
      <td>
        <span className="iy-type">{formatIncidentType(incident.incidentType)}</span>
      </td>

      {/* Location */}
      <td>
        <span className="iy-loc" title={incident.location}>{incident.location}</span>
      </td>

      {/* Severity */}
      <td>
        <span className={`iy-pill iy-pill--${incident.severity}`}>
          {incident.severity}
        </span>
      </td>

      {/* Spam analysis */}
      <td>
        <div className="iy-spam">
          <div className="iy-spam__pills">
            <span className={`iy-pill iy-pill--${predictedPillKey(incident.predictedLabel)}`}>
              {formatPredictedLabel(incident.predictedLabel)}
            </span>
            <span className={`iy-pill iy-pill--${verdictKey}`}>
              {verdictLabel}
            </span>
          </div>
          <div className="iy-spam__meta">
            <div className="iy-spam__meta-row">
              <span className="iy-spam__meta-label">Spam score</span>
              <span className="iy-spam__meta-value">{formatPercent(incident.spamScore)}</span>
            </div>
            <div className="iy-spam__meta-row">
              <span className="iy-spam__meta-label">ML confidence</span>
              <span className="iy-spam__meta-value">{formatPercent(incident.mlConfidence)}</span>
            </div>
            <div className="iy-spam__meta-row">
              <span className="iy-spam__meta-label">Model</span>
              <span className="iy-spam__meta-value">{incident.modelVersion || EMPTY}</span>
            </div>
          </div>
        </div>
      </td>

      {/* AI confidence */}
      <td>
        {typeof incident.confidence === 'number' && incident.confidenceStatus === 'completed' ? (
          <div className="iy-conf">
            <div className="iy-conf__bar">
              <div
                className={`iy-conf__fill iy-conf__fill--${confidenceFillKey(incident.confidence)}`}
                style={{ width: `${incident.confidence}%` }}
              />
            </div>
            <span className="iy-conf__value">{incident.confidence}%</span>
          </div>
        ) : (
          <span className="iy-conf__empty">
            {incident.confidenceStatus === 'pending' ? 'Pending AI'
              : incident.confidenceStatus === 'failed' ? 'AI failed'
              : EMPTY}
          </span>
        )}
      </td>

      {/* Reporter trust */}
      <td>
        <span className={`iy-trust iy-trust--${trust}`}>
          {typeof incident.reporterScore === 'number'
            ? `${incident.reporterScore.toFixed(1)}%`
            : 'Not provided'}
        </span>
      </td>

      {/* Reported (time) */}
      <td>
        <div className="iy-time">
          <span className="iy-time__ago">{incident.ago}</span>
          <span className="iy-time__abs">{formatDateTime(incident.createdAt)}</span>
        </div>
      </td>

      {/* Status */}
      <td>
        <div className="iy-status">
          <span className={`iy-pill iy-pill--${incident.status}`}>
            {incident.status}
          </span>
          {incident.openFlagCount > 0 ? (
            <span className="iy-pill iy-pill--warning">
              {incident.openFlagCount} flag{incident.openFlagCount === 1 ? '' : 's'}
            </span>
          ) : null}
        </div>
      </td>

      {/* Action */}
      <td>
        <button
          type="button"
          className="iy-btn iy-btn--primary iy-btn--sm"
          onClick={onReview}
        >
          Review
        </button>
      </td>
    </tr>
  )
}

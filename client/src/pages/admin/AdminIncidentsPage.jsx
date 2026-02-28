/**
 * @file AdminIncidentsPage.jsx
 * @description Incident management page for reviewing, classifying and actioning reported incidents.
 *
 * Layout:
 *   1. Page header with search bar and Export CSV button
 *   2. Tab bar — 6 filter tabs: All | Pending | AI-Flagged | Community | Merged | Archived
 *   3. Sortable data table (9 columns) with inline confidence bar, severity pill, status pill
 *   4. Pagination footer
 *
 * Features:
 *   - Search by incident ID, location, or reporter username
 *   - Clickable column headers for multi-field sorting (ID, severity, confidence, reliability)
 *   - Row highlighting for high-severity + pending incidents
 *   - URL-driven filtering via useSearchParams (?filter=<key>)
 *
 * Mock data: 11 incidents with categories (ai-flagged / community).
 */
import React, { useState, useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'

/* ═══════════════════════════════════════════════════════════
   MOCK DATA
   ═══════════════════════════════════════════════════════════ */

/* 11 sample incidents; each has an AI confidence score, reporter reliability, and category (ai-flagged | community) */
const allIncidents = [
  { id: 'INC-2401', location: 'Blvd Zirout Youcef, Algiers', severity: 'high', confidence: 94, status: 'pending', type: 'Collision', reporter: 'ahmed_b', reliability: 92, time: '2025-01-18T08:34:00', ago: '12m', category: 'ai-flagged' },
  { id: 'INC-2400', location: 'RN11 Industrial Zone, Oran', severity: 'medium', confidence: 78, status: 'pending', type: 'Roadwork', reporter: 'fatima_k', reliability: 88, time: '2025-01-18T07:18:00', ago: '1h 28m', category: 'community' },
  { id: 'INC-2399', location: 'East-West Highway km120', severity: 'high', confidence: 91, status: 'pending', type: 'Collision', reporter: 'yacine_m', reliability: 95, time: '2025-01-18T06:55:00', ago: '1h 51m', category: 'ai-flagged' },
  { id: 'INC-2398', location: 'University Dist., Constantine', severity: 'low', confidence: 65, status: 'verified', type: 'Weather', reporter: 'nour_l', reliability: 96, time: '2025-01-18T06:02:00', ago: '2h 44m', category: 'community' },
  { id: 'INC-2397', location: 'El Harrach Bridge, Algiers', severity: 'high', confidence: 88, status: 'flagged', type: 'Collision', reporter: 'amine_r', reliability: 34, time: '2025-01-18T05:47:00', ago: '2h 59m', category: 'ai-flagged' },
  { id: 'INC-2396', location: 'Place des Martyrs, Algiers', severity: 'medium', confidence: 72, status: 'pending', type: 'Traffic', reporter: 'sara_z', reliability: 90, time: '2025-01-18T04:15:00', ago: '4h 31m', category: 'community' },
  { id: 'INC-2395', location: 'Route Nationale 5, Blida', severity: 'low', confidence: 58, status: 'rejected', type: 'False alarm', reporter: 'karim_d', reliability: 22, time: '2025-01-17T03:30:00', ago: '5h 16m', category: 'community' },
  { id: 'INC-2394', location: 'RN5 Setif Bypass', severity: 'medium', confidence: 81, status: 'merged', type: 'Collision', reporter: 'bilal_s', reliability: 87, time: '2025-01-17T22:12:00', ago: '10h 34m', category: 'ai-flagged' },
  { id: 'INC-2393', location: 'Annaba Port Road', severity: 'high', confidence: 90, status: 'archived', type: 'Hazardous Road', reporter: 'nadia_t', reliability: 91, time: '2025-01-17T18:00:00', ago: '14h 46m', category: 'ai-flagged' },
  { id: 'INC-2392', location: 'Tlemcen City Ring', severity: 'low', confidence: 53, status: 'rejected', type: 'False alarm', reporter: 'omar_h', reliability: 19, time: '2025-01-17T15:10:00', ago: '17h 36m', category: 'community' },
  { id: 'INC-2391', location: 'Batna Ain Touta Road', severity: 'medium', confidence: 74, status: 'archived', type: 'Roadwork', reporter: 'mehdi_b', reliability: 78, time: '2025-01-17T12:45:00', ago: '20h 01m', category: 'community' },
]

/* Filter tab definitions — count is computed dynamically at render time */
const tabs = [
  { key: 'pending', label: 'Pending', count: null },
  { key: 'ai-flagged', label: 'AI-Flagged', count: null },
  { key: 'community', label: 'Community', count: null },
  { key: 'merged', label: 'Merged', count: null },
  { key: 'archived', label: 'Archived', count: null },
]

/* ═══════════════════════════════════════════════════════════
   COMPONENT
   ═══════════════════════════════════════════════════════════ */
export default function AdminIncidentsPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const filterParam = searchParams.get('filter') || 'all' // active filter from URL
  const [search, setSearch] = useState('')                // free-text search query
  const [sortField, setSortField] = useState('confidence') // column currently sorted by
  const [sortDir, setSortDir] = useState('desc')           // 'asc' or 'desc'

  // Derive visible incidents: filter by tab → filter by search → sort
  const filtered = useMemo(() => {
    let list = allIncidents
    if (filterParam === 'pending') list = list.filter(i => i.status === 'pending')
    else if (filterParam === 'ai-flagged') list = list.filter(i => i.category === 'ai-flagged')
    else if (filterParam === 'community') list = list.filter(i => i.category === 'community')
    else if (filterParam === 'merged') list = list.filter(i => i.status === 'merged')
    else if (filterParam === 'archived') list = list.filter(i => i.status === 'archived')
    // Text search across ID, location and reporter fields
    if (search) {
      const q = search.toLowerCase()
      list = list.filter(i => i.id.toLowerCase().includes(q) || i.location.toLowerCase().includes(q) || i.reporter.toLowerCase().includes(q))
    }
    // Sort: numeric compare for numbers, locale compare for strings
    list.sort((a, b) => {
      const valA = a[sortField], valB = b[sortField]
      const cmp = typeof valA === 'number' ? valA - valB : String(valA).localeCompare(String(valB))
      return sortDir === 'desc' ? -cmp : cmp
    })
    return list
  }, [filterParam, search, sortField, sortDir])

  // Pre-compute counts for each tab badge
  const tabCounts = {
    all: allIncidents.length,
    pending: allIncidents.filter(i => i.status === 'pending').length,
    'ai-flagged': allIncidents.filter(i => i.category === 'ai-flagged').length,
    community: allIncidents.filter(i => i.category === 'community').length,
    merged: allIncidents.filter(i => i.status === 'merged').length,
    archived: allIncidents.filter(i => i.status === 'archived').length,
  }

  // Toggle sort direction if same column clicked, otherwise set new column descending
  const toggleSort = (field) => {
    if (sortField === field) setSortDir(d => d === 'desc' ? 'asc' : 'desc')
    else { setSortField(field); setSortDir('desc') }
  }

  // Small arrow indicator shown next to the currently sorted column header
  const SortIcon = ({ field }) => sortField === field
    ? <span style={{ marginLeft: 3, fontSize: 9 }}>{sortDir === 'desc' ? '▼' : '▲'}</span>
    : null

  return (
    <>
      {/* ═══ PAGE HEADER ═══ */}
      <div className="admin-page-header">
        <div>
          <h1 className="admin-page-title">Incident Management</h1>
          <p className="admin-page-subtitle">Review, classify and action all reported incidents</p>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <input className="admin-input" type="text" placeholder="Search ID, location, reporter…" value={search} onChange={e => setSearch(e.target.value)} style={{ width: 220, height: 32, fontSize: 11.5 }} />
          <button className="admin-btn admin-btn-ghost">Export CSV</button>
        </div>
      </div>

      {/* ═══ FILTER TABS ═══ */}
      {/* Tabs */}
      <div className="admin-tabs" style={{ marginBottom: 12 }}>
        {tabs.map(t => (
          <button key={t.key}
            className={`admin-tab ${filterParam === t.key ? 'active' : ''}`}
            onClick={() => setSearchParams(t.key === 'all' ? {} : { filter: t.key })}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ═══ INCIDENTS TABLE ═══ */}
      {/* Sortable columns: ID, severity, confidence, reliability. Rows highlighted when high + pending. */}
      {/* Table */}
      <div className="admin-card">
        <div className="admin-table-wrapper">
          <table className="admin-table">
            <thead>
              <tr>
                <th style={{ cursor: 'pointer' }} onClick={() => toggleSort('id')}>ID <SortIcon field="id" /></th>
                <th>Type</th>
                <th>Location</th>
                <th style={{ cursor: 'pointer' }} onClick={() => toggleSort('severity')}>AI Severity <SortIcon field="severity" /></th>
                <th style={{ cursor: 'pointer' }} onClick={() => toggleSort('confidence')}>Confidence <SortIcon field="confidence" /></th>
                <th style={{ cursor: 'pointer' }} onClick={() => toggleSort('reliability')}>Reporter Score <SortIcon field="reliability" /></th>
                <th>Since Reported</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {/* Highlight row if high-severity AND still pending */}
              {filtered.map(inc => (
                <tr key={inc.id} className={inc.severity === 'high' && inc.status === 'pending' ? 'row-highlight' : ''}>
                  <td style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{inc.id}</td>
                  <td style={{ fontSize: 11 }}>{inc.type}</td>
                  <td style={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{inc.location}</td>
                  <td><span className={`admin-pill ${inc.severity}`}>{inc.severity}</span></td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <div className="admin-progress" style={{ width: 44 }}>
                        <div className={`admin-progress-fill ${inc.confidence >= 85 ? 'success' : inc.confidence >= 65 ? 'warning' : 'danger'}`} style={{ width: `${inc.confidence}%` }}></div>
                      </div>
                      <span style={{ fontSize: 10.5, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{inc.confidence}%</span>
                    </div>
                  </td>
                  <td>
                    <span style={{ fontWeight: 600, fontSize: 11, color: inc.reliability >= 80 ? 'var(--admin-success)' : inc.reliability >= 50 ? 'var(--admin-warning)' : 'var(--admin-danger)' }}>
                      {inc.reliability}%
                    </span>
                  </td>
                  <td style={{ fontVariantNumeric: 'tabular-nums', fontSize: 11, color: 'var(--admin-text-secondary)' }}>{inc.ago}</td>
                  <td><span className={`admin-pill ${inc.status}`}>{inc.status}</span></td>
                  <td>
                    <button className="admin-btn admin-btn-sm admin-btn-primary" onClick={() => navigate(`/admin/incidents/${inc.id}`)}>
                      Review
                    </button>
                  </td>
                </tr>
              ))}
              {/* Empty-state row when no incidents match */}
              {filtered.length === 0 && (
                <tr><td colSpan={9} style={{ textAlign: 'center', padding: 32, color: 'var(--admin-text-muted)' }}>No incidents match current filters</td></tr>
              )}
            </tbody>
          </table>
        </div>
        {/* ═══ PAGINATION FOOTER ═══ */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', borderTop: '1px solid var(--admin-border)', fontSize: 11, color: 'var(--admin-text-muted)' }}>
          <span>Showing {filtered.length} of {allIncidents.length} incidents</span>
          <div style={{ display: 'flex', gap: 4 }}>
            <button className="admin-btn admin-btn-sm admin-btn-ghost" disabled>← Prev</button>
            <button className="admin-btn admin-btn-sm admin-btn-ghost">Next →</button>
          </div>
        </div>
      </div>
    </>
  )
}

import React, { useContext, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import PoliceShell from '../../components/layout/PoliceShell'
import { AuthContext } from '../../contexts/AuthContext'
import { getPoliceIncidents, getPoliceOperationHistory } from '../../data/policeMockData'

const ACTION_TYPES = [
  { value: 'all', label: 'All actions' },
  { value: 'verified_incident', label: 'Verified incident' },
  { value: 'rejected_report', label: 'Rejected report' },
  { value: 'requested_backup', label: 'Requested backup' },
]

function formatTime(value) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Unknown time'

  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

function localDateKey(value) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''

  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function normalizeText(value) {
  return String(value || '').trim().toLowerCase()
}

function isOfficerMatch(itemOfficerName, currentOfficerName) {
  const itemName = normalizeText(itemOfficerName)
  const currentName = normalizeText(currentOfficerName)
  if (!itemName || !currentName) return false

  if (itemName === currentName) return true

  const currentTokens = currentName.split(/\s+/).filter(Boolean)
  return currentTokens.some((token) => token.length >= 3 && itemName.includes(token))
}

function actionLabel(value) {
  if (value === 'verified_incident') return 'Verified incident'
  if (value === 'rejected_report') return 'Rejected report'
  if (value === 'requested_backup') return 'Requested backup'
  return 'Action'
}

export default function PoliceOperationHistoryPage() {
  const navigate = useNavigate()
  const { user } = useContext(AuthContext)
  const officerName = user?.name || 'Officer'

  const allHistory = useMemo(
    () => getPoliceOperationHistory()
      .sort((left, right) => new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime()),
    [],
  )
  const incidents = useMemo(() => getPoliceIncidents(), [])
  const incidentById = useMemo(
    () => Object.fromEntries(incidents.map((item) => [item.id, item])),
    [incidents],
  )

  const officerHistory = useMemo(
    () => allHistory.filter((item) => isOfficerMatch(item.officerName, officerName)),
    [allHistory, officerName],
  )

  const [typeFilter, setTypeFilter] = useState('all')
  const [dateFilter, setDateFilter] = useState('')

  const filteredItems = useMemo(
    () => officerHistory.filter((item) => {
      if (typeFilter !== 'all' && item.actionType !== typeFilter) return false
      if (dateFilter && localDateKey(item.timestamp) !== dateFilter) return false
      return true
    }),
    [officerHistory, typeFilter, dateFilter],
  )

  const rightPanel = (
    <section className="police-section">
      <h2>History Summary</h2>
      <ul className="police-list">
        <li><strong>Officer:</strong> {officerName}</li>
        <li><strong>Total actions:</strong> {officerHistory.length}</li>
        <li><strong>Visible actions:</strong> {filteredItems.length}</li>
      </ul>
    </section>
  )

  return (
    <PoliceShell activeKey="operation-history" rightPanel={rightPanel} notificationCount={filteredItems.length}>
      <section className="police-section police-operation-history-page">
        <div className="police-command-section-head">
          <h2>Operation History</h2>
          <span className="police-history-officer-badge">{officerName}</span>
        </div>

        <div className="police-history-filters">
          <label className="police-filter-field">
            <span>Action type</span>
            <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}>
              {ACTION_TYPES.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>

          <label className="police-filter-field">
            <span>Date</span>
            <input type="date" value={dateFilter} onChange={(event) => setDateFilter(event.target.value)} />
          </label>

          <button type="button" className="police-action police-action-secondary" onClick={() => { setTypeFilter('all'); setDateFilter('') }}>
            Clear filters
          </button>
        </div>

        <div className="police-history-list">
          {filteredItems.map((item) => (
            <article key={item.id} className="police-history-item">
              <div className="police-history-item-top">
                <strong>{actionLabel(item.actionType)}</strong>
                <time dateTime={item.timestamp}>{formatTime(item.timestamp)}</time>
              </div>

              <div className="police-history-item-meta">
                <span>Incident: <strong>{item.incidentId}</strong></span>
                <span>Location: <strong>{incidentById[item.incidentId]?.location || 'Unknown area'}</strong></span>
              </div>

              <div className="police-history-item-actions">
                <button
                  type="button"
                  className="police-action police-action-view"
                  onClick={() => navigate(`/police/incident/${item.incidentId}`)}
                >
                  Open incident
                </button>
              </div>
            </article>
          ))}

          {filteredItems.length === 0 ? (
            <div className="police-empty-state" role="status" aria-live="polite">
              <div className="police-empty-icon" aria-hidden="true">📚</div>
              <h3>No actions found</h3>
              <p>Try changing the action type or date filter.</p>
            </div>
          ) : null}
        </div>
      </section>
    </PoliceShell>
  )
}

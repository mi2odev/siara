import React, { useContext, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import PoliceShell from '../../components/layout/PoliceShell'
import { AuthContext } from '../../contexts/AuthContext'
import {
  createManualPoliceHistoryEntry,
  listPoliceOperationHistory,
} from '../../services/policeService'

const ACTION_TYPES = [
  { value: 'all', label: 'All actions' },
  { value: 'verify_incident', label: 'Verified incident' },
  { value: 'reject_incident', label: 'Rejected report' },
  { value: 'assign_self', label: 'Assigned self' },
  { value: 'request_backup', label: 'Requested backup' },
  { value: 'update_status', label: 'Changed status' },
  { value: 'field_note', label: 'Field note' },
  { value: 'mark_alert_read', label: 'Acknowledged alert' },
  { value: 'manual_log_entry', label: 'Manual note' },
]

function normalizeText(value) {
  return String(value || '').trim().toLowerCase()
}

function localDateKey(value) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return ''
  }

  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function actionLabel(value) {
  if (value === 'verify_incident') return 'Verified incident'
  if (value === 'reject_incident') return 'Rejected report'
  if (value === 'assign_self') return 'Assigned self'
  if (value === 'request_backup') return 'Requested backup'
  if (value === 'update_status') return 'Changed status'
  if (value === 'field_note') return 'Added field note'
  if (value === 'mark_alert_read') return 'Acknowledged alert'
  if (value === 'manual_log_entry') return 'Manual note'
  return 'Police action'
}

export default function PoliceOperationHistoryPage() {
  const navigate = useNavigate()
  const { user } = useContext(AuthContext)
  const officerName = user?.name || 'Officer'

  const [typeFilter, setTypeFilter] = useState('all')
  const [dateFilter, setDateFilter] = useState('')
  const [historyItems, setHistoryItems] = useState([])
  const [manualNote, setManualNote] = useState('')
  const [isSubmittingNote, setIsSubmittingNote] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [actionMessage, setActionMessage] = useState('')

  const loadHistory = React.useCallback(async () => {
    setIsLoading(true)
    setError('')

    try {
      const response = await listPoliceOperationHistory({ page: 1, pageSize: 60 })
      setHistoryItems(response.items)
    } catch (loadError) {
      setError(loadError.message || 'Failed to load operation history.')
    } finally {
      setIsLoading(false)
    }
  }, [])

  React.useEffect(() => {
    loadHistory()
  }, [loadHistory])

  const filteredItems = useMemo(
    () => historyItems.filter((item) => {
      if (typeFilter !== 'all' && item.actionType !== typeFilter) return false
      if (dateFilter && localDateKey(item.createdAt) !== dateFilter) return false
      return true
    }),
    [dateFilter, historyItems, typeFilter],
  )

  const rightPanel = (
    <section className="police-section">
      <h2>History Summary</h2>
      <ul className="police-list">
        <li><strong>Officer:</strong> {officerName}</li>
        <li><strong>Total actions:</strong> {historyItems.length}</li>
        <li><strong>Visible actions:</strong> {filteredItems.length}</li>
      </ul>
    </section>
  )

  const handleSubmitManualEntry = async (event) => {
    event.preventDefault()
    setError('')
    setActionMessage('')

    const trimmedNote = manualNote.trim()
    if (!trimmedNote) {
      setError('Enter a short action note before saving.')
      return
    }

    setIsSubmittingNote(true)
    try {
      const response = await createManualPoliceHistoryEntry({
        note: trimmedNote,
        metadata: {
          source: 'operation_history_page',
        },
      })

      if (response.item) {
        setHistoryItems((previous) => [response.item, ...previous])
      } else {
        await loadHistory()
      }

      setManualNote('')
      setTypeFilter('all')
      setActionMessage('Manual action saved.')
    } catch (submitError) {
      setError(submitError.message || 'Failed to save manual action.')
    } finally {
      setIsSubmittingNote(false)
    }
  }

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

          <button
            type="button"
            className="police-action police-action-secondary"
            onClick={() => { setTypeFilter('all'); setDateFilter('') }}
          >
            Clear filters
          </button>

          <button
            type="button"
            className="police-action police-action-secondary"
            onClick={loadHistory}
            disabled={isLoading || isSubmittingNote}
          >
            {isLoading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>

        <form className="police-history-filters" onSubmit={handleSubmitManualEntry}>
          <label className="police-filter-field" style={{ flex: '1 1 24rem' }}>
            <span>Manual action note</span>
            <input
              type="text"
              value={manualNote}
              maxLength={1000}
              placeholder="Add a short field action or operational note"
              onChange={(event) => setManualNote(event.target.value)}
              disabled={isSubmittingNote}
            />
          </label>

          <button type="submit" className="police-action police-action-review" disabled={isSubmittingNote}>
            {isSubmittingNote ? 'Saving...' : 'Add note'}
          </button>
        </form>

        {error ? <p className="police-meta" style={{ color: '#b91c1c' }}>{error}</p> : null}
        {!error && actionMessage ? <p className="police-meta" style={{ color: '#166534' }}>{actionMessage}</p> : null}
        {isLoading ? <p className="police-meta">Loading meaningful police actions...</p> : null}

        <div className="police-history-list">
          {filteredItems.map((item) => (
            <article key={item.id} className="police-history-item">
              <div className="police-history-item-top">
                <strong>{actionLabel(item.actionType)}</strong>
                <time dateTime={item.createdAt}>{item.createdAtLabel}</time>
              </div>

              <div className="police-history-item-meta">
                <span>Officer: <strong>{item.officer?.name || officerName}</strong></span>
                {item.reportId ? <span>Incident: <strong>{item.reportTitle || item.reportId}</strong></span> : null}
                {item.alertId ? <span>Alert: <strong>{item.alertTitle || item.alertId}</strong></span> : null}
                {item.toStatus ? <span>Status: <strong>{normalizeText(item.toStatus).replace(/_/g, ' ')}</strong></span> : null}
              </div>

              {item.note ? <p>{item.note}</p> : null}

              {item.reportId ? (
                <div className="police-history-item-actions">
                  <button
                    type="button"
                    className="police-action police-action-view"
                    onClick={() => navigate(`/police/incident/${item.reportId}`)}
                  >
                    Open incident
                  </button>
                </div>
              ) : null}
            </article>
          ))}

          {!isLoading && filteredItems.length === 0 ? (
            <div className="police-empty-state" role="status" aria-live="polite">
              <div className="police-empty-icon" aria-hidden="true">📚</div>
              <h3>No actions found</h3>
              <p>Location updates are hidden here so the timeline stays focused on meaningful police actions.</p>
            </div>
          ) : null}
        </div>
      </section>
    </PoliceShell>
  )
}

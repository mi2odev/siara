import React, { useContext, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import CheckRoundedIcon from '@mui/icons-material/CheckRounded'
import CloseRoundedIcon from '@mui/icons-material/CloseRounded'
import BadgeOutlinedIcon from '@mui/icons-material/BadgeOutlined'
import CampaignRoundedIcon from '@mui/icons-material/CampaignRounded'
import SyncAltRoundedIcon from '@mui/icons-material/SyncAltRounded'
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined'
import NotificationsActiveOutlinedIcon from '@mui/icons-material/NotificationsActiveOutlined'
import EditNoteRoundedIcon from '@mui/icons-material/EditNoteRounded'
import HistoryRoundedIcon from '@mui/icons-material/HistoryRounded'

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

function actionTone(value) {
  if (value === 'verify_incident') return 'verify'
  if (value === 'reject_incident') return 'reject'
  if (value === 'request_backup') return 'backup'
  if (value === 'update_status') return 'status'
  if (value === 'assign_self') return 'assign'
  if (value === 'field_note') return 'note'
  if (value === 'mark_alert_read') return 'alert'
  if (value === 'manual_log_entry') return 'manual'
  return 'default'
}

function ActionIcon({ value }) {
  const props = { fontSize: 'inherit' }
  if (value === 'verify_incident') return <CheckRoundedIcon {...props} />
  if (value === 'reject_incident') return <CloseRoundedIcon {...props} />
  if (value === 'assign_self') return <BadgeOutlinedIcon {...props} />
  if (value === 'request_backup') return <CampaignRoundedIcon {...props} />
  if (value === 'update_status') return <SyncAltRoundedIcon {...props} />
  if (value === 'field_note') return <DescriptionOutlinedIcon {...props} />
  if (value === 'mark_alert_read') return <NotificationsActiveOutlinedIcon {...props} />
  if (value === 'manual_log_entry') return <EditNoteRoundedIcon {...props} />
  return <HistoryRoundedIcon {...props} />
}

function severityLabel(value) {
  if (!value) return null
  return String(value).charAt(0).toUpperCase() + String(value).slice(1)
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

  const verifiedCount = historyItems.filter((item) => item.actionType === 'verify_incident').length
  const rejectedCount = historyItems.filter((item) => item.actionType === 'reject_incident').length
  const noteCount = historyItems.filter((item) => item.actionType === 'field_note' || item.actionType === 'manual_log_entry').length

  const rightPanel = (
    <section className="police-section police-dashboard-side-card">
      <div className="police-dashboard-side-header">
        <h2>History Summary</h2>
      </div>
      <div className="police-selected-details police-dashboard-side-details">
        <div className="police-selected-line"><span>Officer</span><strong>{officerName}</strong></div>
        <div className="police-selected-line"><span>Total actions</span><strong>{historyItems.length}</strong></div>
        <div className="police-selected-line"><span>Visible</span><strong>{filteredItems.length}</strong></div>
        <div className="police-selected-line"><span>Verified</span><strong>{verifiedCount}</strong></div>
        <div className="police-selected-line"><span>Rejected</span><strong>{rejectedCount}</strong></div>
        <div className="police-selected-line"><span>Notes</span><strong>{noteCount}</strong></div>
      </div>
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
      <section className="police-section police-dashboard-overview police-operation-history-page">
        <div className="police-command-section-head police-dashboard-head">
          <div>
            <h2>Operation History</h2>
            <p className="police-shortcuts-hint">
              Timeline of meaningful police actions. Location pings are hidden to keep the focus on decisions.
            </p>
          </div>
          <div className="police-dashboard-head-actions">
            <span className="police-history-officer-badge">{officerName}</span>
            <button
              type="button"
              className="police-action police-dashboard-refresh"
              onClick={loadHistory}
              disabled={isLoading || isSubmittingNote}
            >
              {isLoading ? 'Refreshing…' : 'Refresh'}
            </button>
          </div>
        </div>
      </section>

      <section className="police-section police-history-toolbox">
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
            className="police-action police-action-secondary police-history-clear"
            onClick={() => { setTypeFilter('all'); setDateFilter('') }}
          >
            Clear filters
          </button>
        </div>

        <form className="police-history-manual" onSubmit={handleSubmitManualEntry}>
          <label className="police-filter-field police-history-manual-field">
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
            {isSubmittingNote ? 'Saving…' : 'Add note'}
          </button>
        </form>

        {error ? <p className="police-history-feedback police-history-feedback-error">{error}</p> : null}
        {!error && actionMessage ? <p className="police-history-feedback police-history-feedback-success">{actionMessage}</p> : null}
        {isLoading ? <p className="police-meta">Loading meaningful police actions…</p> : null}
      </section>

      <section className="police-section police-history-feed-section">
        <div className="police-command-section-head">
          <h2>Activity Timeline</h2>
          <span className="police-meta">{filteredItems.length} of {historyItems.length} actions</span>
        </div>

        <div className="police-history-list">
          {filteredItems.map((item) => {
            const tone = actionTone(item.actionType)
            const severity = item.severity || null
            return (
              <article
                key={item.id}
                className={`police-history-item police-history-item-${tone}`}
                data-severity={severity || undefined}
              >
                <div className={`police-history-item-marker tone-${tone}`} aria-hidden="true">
                  <ActionIcon value={item.actionType} />
                </div>

                <div className="police-history-item-body">
                  <div className="police-history-item-top">
                    <div className="police-history-item-title">
                      <strong>{actionLabel(item.actionType)}</strong>
                      {severity ? (
                        <span className={`police-badge ${severity} police-history-severity-badge`}>
                          {severityLabel(severity)}
                        </span>
                      ) : null}
                    </div>
                    <time dateTime={item.createdAt}>{item.createdAtLabel}</time>
                  </div>

                  <div className="police-history-item-meta">
                    <span>Officer: <strong>{item.officer?.name || officerName}</strong></span>
                    {item.reportId ? <span>Incident: <strong>{item.reportTitle || item.reportId}</strong></span> : null}
                    {item.alertId ? <span>Alert: <strong>{item.alertTitle || item.alertId}</strong></span> : null}
                    {item.toStatus ? <span>Status: <strong>{normalizeText(item.toStatus).replace(/_/g, ' ')}</strong></span> : null}
                  </div>

                  {item.note ? <p className="police-history-item-note">{item.note}</p> : null}

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
                </div>
              </article>
            )
          })}

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

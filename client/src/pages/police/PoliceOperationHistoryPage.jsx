import React, { useContext, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import FancySelect from '../../components/ui/FancySelect'

import CheckRoundedIcon from '@mui/icons-material/CheckRounded'
import CloseRoundedIcon from '@mui/icons-material/CloseRounded'
import BadgeOutlinedIcon from '@mui/icons-material/BadgeOutlined'
import LibraryBooksOutlinedIcon from '@mui/icons-material/LibraryBooksOutlined'
import CampaignRoundedIcon from '@mui/icons-material/CampaignRounded'
import SyncAltRoundedIcon from '@mui/icons-material/SyncAltRounded'
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined'
import NotificationsActiveOutlinedIcon from '@mui/icons-material/NotificationsActiveOutlined'
import EditNoteRoundedIcon from '@mui/icons-material/EditNoteRounded'
import HistoryRoundedIcon from '@mui/icons-material/HistoryRounded'
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded'

import PoliceShell from '../../components/layout/PoliceShell'
import PoliceOfficerPanel from '../../components/police/PoliceOfficerPanel'
import PoliceSortControl from '../../components/police/PoliceSortControl'
import { usePoliceAccess } from '../../components/police/PoliceAccessGate'
import { usePoliceSort, HISTORY_SORT_ACCESSORS, HISTORY_SORT_OPTIONS } from '../../utils/policeSort'
import { AuthContext } from '../../contexts/AuthContext'
import {
  createManualPoliceHistoryEntry,
  listPoliceOperationHistory,
} from '../../services/policeService'

const ACTION_TYPE_VALUES = [
  'all',
  'verify_incident',
  'reject_incident',
  'assign_self',
  'request_backup',
  'update_status',
  'field_note',
  'mark_alert_read',
  'manual_log_entry',
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
  const { t } = useTranslation(['police', 'common'])
  const navigate = useNavigate()
  const { policeMe } = usePoliceAccess()
  const { user } = useContext(AuthContext)
  const officerName = user?.name || t('policeOperationHistoryPage.officerFallback')

  const ACTION_TYPES = [
    { value: 'all', label: t('policeOperationHistoryPage.actionTypes.all') },
    { value: 'verify_incident', label: t('policeOperationHistoryPage.actionTypes.verify_incident') },
    { value: 'reject_incident', label: t('policeOperationHistoryPage.actionTypes.reject_incident') },
    { value: 'assign_self', label: t('policeOperationHistoryPage.actionTypes.assign_self') },
    { value: 'request_backup', label: t('policeOperationHistoryPage.actionTypes.request_backup') },
    { value: 'update_status', label: t('policeOperationHistoryPage.actionTypes.update_status') },
    { value: 'field_note', label: t('policeOperationHistoryPage.actionTypes.field_note') },
    { value: 'mark_alert_read', label: t('policeOperationHistoryPage.actionTypes.mark_alert_read') },
    { value: 'manual_log_entry', label: t('policeOperationHistoryPage.actionTypes.manual_log_entry') },
  ]

  function actionLabel(value) {
    if (value === 'verify_incident') return t('policeOperationHistoryPage.actionLabels.verify_incident')
    if (value === 'reject_incident') return t('policeOperationHistoryPage.actionLabels.reject_incident')
    if (value === 'assign_self') return t('policeOperationHistoryPage.actionLabels.assign_self')
    if (value === 'request_backup') return t('policeOperationHistoryPage.actionLabels.request_backup')
    if (value === 'update_status') return t('policeOperationHistoryPage.actionLabels.update_status')
    if (value === 'field_note') return t('policeOperationHistoryPage.actionLabels.field_note')
    if (value === 'mark_alert_read') return t('policeOperationHistoryPage.actionLabels.mark_alert_read')
    if (value === 'manual_log_entry') return t('policeOperationHistoryPage.actionLabels.manual_log_entry')
    return t('policeOperationHistoryPage.actionLabels.default')
  }

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
      setError(loadError.message || t('policeOperationHistoryPage.errors.loadFailed'))
    } finally {
      setIsLoading(false)
    }
  }, [t])

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

  const { sorted: sortedItems, sortKey, setSortKey, sortDir, toggleDir } = usePoliceSort(filteredItems, HISTORY_SORT_ACCESSORS)

  const verifiedCount = historyItems.filter((item) => item.actionType === 'verify_incident').length
  const rejectedCount = historyItems.filter((item) => item.actionType === 'reject_incident').length
  const noteCount = historyItems.filter((item) => item.actionType === 'field_note' || item.actionType === 'manual_log_entry').length

  const rightPanel = (
    <PoliceOfficerPanel officer={policeMe?.officer} workZone={policeMe?.workZone}>
      <div className="pop-extra">
        <div className="pop-extra-head">
          <span className="pop-extra-title">{t('policeOperationHistoryPage.panel.title')}</span>
        </div>
        <div className="pop-extra-body">
          <div className="pop-stat-row"><span>{t('policeOperationHistoryPage.panel.totalActions')}</span><strong>{historyItems.length}</strong></div>
          <div className="pop-stat-row"><span>{t('policeOperationHistoryPage.panel.visible')}</span><strong className="pop-stat--accent">{filteredItems.length}</strong></div>
          <div className="pop-stat-row"><span>{t('policeOperationHistoryPage.panel.verified')}</span><strong className={verifiedCount > 0 ? 'pop-stat--ok' : ''}>{verifiedCount}</strong></div>
          <div className="pop-stat-row"><span>{t('policeOperationHistoryPage.panel.rejected')}</span><strong className={rejectedCount > 0 ? 'pop-stat--danger' : ''}>{rejectedCount}</strong></div>
          <div className="pop-stat-row"><span>{t('policeOperationHistoryPage.panel.notes')}</span><strong>{noteCount}</strong></div>
        </div>
      </div>
    </PoliceOfficerPanel>
  )

  const handleSubmitManualEntry = async (event) => {
    event.preventDefault()
    setError('')
    setActionMessage('')

    const trimmedNote = manualNote.trim()
    if (!trimmedNote) {
      setError(t('policeOperationHistoryPage.errors.emptyNote'))
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
      setActionMessage(t('policeOperationHistoryPage.messages.manualActionSaved'))
    } catch (submitError) {
      setError(submitError.message || t('policeOperationHistoryPage.errors.saveFailed'))
    } finally {
      setIsSubmittingNote(false)
    }
  }

  return (
    <PoliceShell activeKey="operation-history" rightPanel={rightPanel} notificationCount={filteredItems.length}>
      <section className="police-section police-dashboard-overview police-operation-history-page">
        <div className="police-command-section-head police-dashboard-head">
          <div>
            <h2>{t('policeOperationHistoryPage.title')}</h2>
            <p className="police-shortcuts-hint">
              {t('policeOperationHistoryPage.hint')}
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
              <RefreshRoundedIcon fontSize="inherit" className={isLoading ? 'is-spinning' : ''} />
              <span>{t('common:actions.retry')}</span>
            </button>
          </div>
        </div>
      </section>

      <section className="police-section police-history-toolbox">
        <div className="police-history-filters">
          <label className="police-filter-field">
            <span>{t('policeOperationHistoryPage.filters.actionType')}</span>
            <FancySelect
              value={typeFilter}
              onChange={setTypeFilter}
              options={ACTION_TYPES}
              menuAlign="left"
            />
          </label>

          <label className="police-filter-field">
            <span>{t('policeOperationHistoryPage.filters.date')}</span>
            <input type="date" value={dateFilter} onChange={(event) => setDateFilter(event.target.value)} />
          </label>

          <label className="police-filter-field">
            <span>{t('policeOperationHistoryPage.filters.sortBy')}</span>
            <PoliceSortControl
              options={HISTORY_SORT_OPTIONS}
              value={sortKey}
              direction={sortDir}
              onChange={setSortKey}
              onToggleDirection={toggleDir}
              label={null}
            />
          </label>

          <button
            type="button"
            className="police-action police-action-secondary police-history-clear"
            onClick={() => { setTypeFilter('all'); setDateFilter('') }}
          >
            {t('policeOperationHistoryPage.filters.clearFilters')}
          </button>
        </div>

        <form className="police-history-manual" onSubmit={handleSubmitManualEntry}>
          <label className="police-filter-field police-history-manual-field">
            <span>{t('policeOperationHistoryPage.manualNote.label')}</span>
            <input
              type="text"
              value={manualNote}
              maxLength={1000}
              placeholder={t('policeOperationHistoryPage.manualNote.placeholder')}
              onChange={(event) => setManualNote(event.target.value)}
              disabled={isSubmittingNote}
            />
          </label>

          <button type="submit" className="police-action police-action-review" disabled={isSubmittingNote}>
            {isSubmittingNote ? t('policeOperationHistoryPage.manualNote.saving') : t('policeOperationHistoryPage.manualNote.addNote')}
          </button>
        </form>

        {error ? <p className="police-history-feedback police-history-feedback-error">{error}</p> : null}
        {!error && actionMessage ? <p className="police-history-feedback police-history-feedback-success">{actionMessage}</p> : null}
        {isLoading ? <p className="police-meta">{t('policeOperationHistoryPage.loadingActions')}</p> : null}
      </section>

      <section className="police-section police-history-feed-section">
        <div className="police-command-section-head">
          <h2>{t('policeOperationHistoryPage.timeline.title')}</h2>
          <span className="police-meta">{t('policeOperationHistoryPage.timeline.count', { visible: filteredItems.length, total: historyItems.length })}</span>
        </div>

        <div className="police-history-list">
          {sortedItems.map((item) => {
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
                    <span>{t('policeOperationHistoryPage.itemMeta.officer')} <strong>{item.officer?.name || officerName}</strong></span>
                    {item.reportId ? <span>{t('policeOperationHistoryPage.itemMeta.incident')} <strong>{item.reportTitle || item.reportId}</strong></span> : null}
                    {item.alertId ? <span>{t('policeOperationHistoryPage.itemMeta.alert')} <strong>{item.alertTitle || item.alertId}</strong></span> : null}
                    {item.toStatus ? <span>{t('policeOperationHistoryPage.itemMeta.status')} <strong>{normalizeText(item.toStatus).replace(/_/g, ' ')}</strong></span> : null}
                  </div>

                  {item.note ? <p className="police-history-item-note">{item.note}</p> : null}

                  {item.reportId ? (
                    <div className="police-history-item-actions">
                      <button
                        type="button"
                        className="police-action police-action-view"
                        onClick={() => navigate(`/police/incident/${item.reportId}`)}
                      >
                        {t('policeOperationHistoryPage.actions.openIncident')}
                      </button>
                    </div>
                  ) : null}
                </div>
              </article>
            )
          })}

          {!isLoading && filteredItems.length === 0 ? (
            <div className="police-empty-state" role="status" aria-live="polite">
              <div className="police-empty-icon" aria-hidden="true"><LibraryBooksOutlinedIcon fontSize="inherit" /></div>
              <h3>{t('policeOperationHistoryPage.empty.title')}</h3>
              <p>{t('policeOperationHistoryPage.empty.description')}</p>
            </div>
          ) : null}
        </div>
      </section>
    </PoliceShell>
  )
}

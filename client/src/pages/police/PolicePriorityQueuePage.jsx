import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded'

import PoliceShell from '../../components/layout/PoliceShell'
import PoliceSortControl from '../../components/police/PoliceSortControl'
import { getPolicePriorityQueue } from '../../services/policeService'
import { usePoliceSort, QUEUE_SORT_ACCESSORS, QUEUE_SORT_OPTIONS } from '../../utils/policeSort'
import '../../styles/PolicePriorityQueue.css'

function formatTimeAgo(value) {
  if (!value) return ''
  const date = new Date(value)
  const ms = Date.now() - date.getTime()
  if (!Number.isFinite(ms)) return ''
  const minutes = Math.round(ms / 60000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.round(hours / 24)
  return `${days}d ago`
}

export default function PolicePriorityQueuePage() {
  const [items, setItems] = useState([])
  const [state, setState] = useState('loading')
  const [error, setError] = useState('')
  const { sorted: sortedItems, sortKey, setSortKey, sortDir, toggleDir } = usePoliceSort(items, QUEUE_SORT_ACCESSORS)

  const load = useCallback(async () => {
    setState('loading')
    setError('')
    try {
      const data = await getPolicePriorityQueue({ limit: 25 })
      setItems(Array.isArray(data?.items) ? data.items : [])
      setState('success')
    } catch (err) {
      setError(err?.message || 'Failed to load priority queue')
      setState('error')
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  return (
    <PoliceShell>
      <div className="siara-pq">
        <div className="siara-pq__header">
          <div>
            <h2 className="siara-pq__title">Priority queue</h2>
            <p className="siara-pq__sub">
              Incidents ranked by severity, recency, community confirmation,
              and nearby cluster density.
            </p>
          </div>
          <div className="police-page-toolbar-actions">
            {state === 'success' && items.length > 0 ? (
              <PoliceSortControl
                options={QUEUE_SORT_OPTIONS}
                value={sortKey}
                direction={sortDir}
                onChange={setSortKey}
                onToggleDirection={toggleDir}
              />
            ) : null}
            <button
              type="button"
              className="siara-pq__refresh"
              onClick={load}
              disabled={state === 'loading'}
            >
              <RefreshRoundedIcon fontSize="inherit" className={state === 'loading' ? 'is-spinning' : ''} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {state === 'loading' ? (
          <ul className="siara-pq__list">
            {[0, 1, 2, 3].map((i) => (
              <li key={`skel-${i}`} className="siara-pq__skeleton" />
            ))}
          </ul>
        ) : null}

        {state === 'error' ? (
          <p className="siara-pq__error">{error}</p>
        ) : null}

        {state === 'success' && items.length === 0 ? (
          <p className="siara-pq__empty">
            No pending incidents need triage right now. New high-priority
            reports will appear here as soon as they're filed.
          </p>
        ) : null}

        {state === 'success' && items.length > 0 ? (
          <ul className="siara-pq__list">
            {sortedItems.map((item) => (
              <li key={`pq-${item.reportId}`} className="siara-pq__item">
                <div className={`siara-pq__priority level-${item.priorityLevel}`}>
                  <span className="siara-pq__priority-level">{item.priorityLevel}</span>
                  <span className="siara-pq__priority-score">{item.priorityScore}</span>
                </div>
                <div className="siara-pq__body">
                  <h3 className="siara-pq__item-title">{item.title}</h3>
                  <div className="siara-pq__item-meta">
                    <span className={`siara-pq__pill severity-${item.severity}`}>
                      {item.severity}
                    </span>
                    {item.locationLabel ? <span>{item.locationLabel}</span> : null}
                    {item.createdAt ? (
                      <span>{formatTimeAgo(item.createdAt)}</span>
                    ) : null}
                    {item.sawItTooCount > 0 ? (
                      <span>{item.sawItTooCount} confirmations</span>
                    ) : null}
                    {item.reportsWithin500m > 0 ? (
                      <span>{item.reportsWithin500m} reports within 500m</span>
                    ) : null}
                  </div>
                  <div className="siara-pq__reasons">
                    {(item.reasons || []).map((reason, idx) => (
                      <span
                        key={`reason-${item.reportId}-${idx}`}
                        className={`siara-pq__pill kind-${reason.kind || 'severity'}`}
                      >
                        {reason.label}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="siara-pq__actions">
                  <Link
                    to={`/police/incident/${item.reportId}`}
                    className="siara-pq__btn siara-pq__btn--primary"
                  >
                    Open
                  </Link>
                  <Link to={`/incident/${item.reportId}`} className="siara-pq__btn">
                    Public view
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </PoliceShell>
  )
}

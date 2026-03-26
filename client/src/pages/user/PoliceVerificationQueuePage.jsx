import React, { useMemo, useState } from 'react'

import PoliceShell from '../../components/layout/PoliceShell'
import { POLICE_INCIDENTS } from '../../data/policeMockData'

export default function PoliceVerificationQueuePage() {
  const [queue, setQueue] = useState(POLICE_INCIDENTS.filter((item) => item.status === 'reported'))
  const [toast, setToast] = useState('')

  const averageReliability = useMemo(() => {
    if (!queue.length) return 0
    return Math.round(queue.reduce((sum, item) => sum + Number(item.reliability || 0), 0) / queue.length)
  }, [queue])

  const takeAction = (incidentId, action) => {
    setQueue((prev) => prev.filter((item) => item.id !== incidentId))
    setToast(`Incident ${incidentId} ${action}`)
    setTimeout(() => setToast(''), 1700)
  }

  const rightPanel = (
    <>
      <section className="police-section">
        <h2>Verification Metrics</h2>
        <ul className="police-list">
          <li><strong>Pending queue:</strong> {queue.length}</li>
          <li><strong>Avg reliability:</strong> {averageReliability}%</li>
          <li><strong>Target SLA:</strong> Verify within 10 min</li>
        </ul>
      </section>
      <section className="police-section">
        <h2>Moderator Notes</h2>
        <ul className="police-list">
          <li>Prioritize high severity + low reliability conflicts.</li>
          <li>Flag repeated false reports for manual review.</li>
          <li>Cross-check with nearby incidents and map evidence.</li>
        </ul>
      </section>
    </>
  )

  return (
    <PoliceShell activeKey="verification-queue" rightPanel={rightPanel} notificationCount={queue.length}>
      <section className="police-section">
        <h2>Verification Queue</h2>
        <div className="police-verification-grid">
          {queue.map((incident) => (
            <article key={incident.id} className="police-verification-card">
              {incident.image
                ? <img src={incident.image} alt={incident.type} />
                : <div className="police-verification-placeholder">No image provided</div>}
              <div>
                <div className="police-row">
                  <strong className="police-title">{incident.id} · {incident.type}</strong>
                  <span className={`police-badge ${incident.severity}`}>{incident.severity}</span>
                </div>
                <p className="police-meta" style={{ margin: '6px 0' }}>{incident.description}</p>
                <div className="police-row">
                  <span className="police-meta">Reporter: {incident.reporter}</span>
                  <span className="police-meta">Reliability: {incident.reliability}%</span>
                </div>
                <div className="police-row">
                  <span className="police-meta">📍 {incident.location}</span>
                  <span className="police-meta">{incident.timeAgo}</span>
                </div>
                <div className="police-action-row" style={{ marginTop: 8 }}>
                  <button className="police-action" onClick={() => takeAction(incident.id, 'approved')}>Approve</button>
                  <button className="police-action" onClick={() => takeAction(incident.id, 'rejected')}>Reject</button>
                  <button className="police-action" onClick={() => takeAction(incident.id, 'flagged')}>Flag user</button>
                </div>
              </div>
            </article>
          ))}
          {queue.length === 0 ? <p className="police-meta">No pending incidents in verification queue.</p> : null}
        </div>
      </section>

      {toast ? <div className="police-toast">{toast}</div> : null}
    </PoliceShell>
  )
}

import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { fetchAdminIncidents } from '../../services/adminIncidentsService'

const PANEL_ICONS = {
  reviewQueue: '\u{1F534}',
  queueLoad: '\u26A1',
  workflow: '\u2295',
  severity: '\u25C6',
  reporter: '\u25B2',
}

export default function AdminContextPanel() {
  const navigate = useNavigate()
  const [queueSummary, setQueueSummary] = useState({
    leadIncident: null,
    counts: {
      pending: 0,
      community: 0,
      merged: 0,
      archived: 0,
      'ai-flagged': 0,
      completedAiReports: 0,
    },
  })

  useEffect(() => {
    const controller = new AbortController()

    async function loadContext() {
      try {
        const payload = await fetchAdminIncidents(
          {
            filter: 'pending',
            sortField: 'createdAt',
            sortDir: 'asc',
            limit: 1,
          },
          { signal: controller.signal },
        )

        if (!controller.signal.aborted) {
          setQueueSummary({
            leadIncident: payload.incidents[0] || null,
            counts: payload.counts,
          })
        }
      } catch {
        // Leave the panel quiet if context data cannot be loaded.
      }
    }

    loadContext()

    return () => controller.abort()
  }, [])

  const { leadIncident, counts } = queueSummary

  return (
    <aside className="admin-ctx-panel">
      <div className="admin-ctx-title">Live Intelligence</div>

      <div className="admin-ctx-card">
        <h4>{PANEL_ICONS.reviewQueue} Review Queue Active</h4>
        <p>
          {leadIncident
            ? `${counts.pending} incident${counts.pending === 1 ? '' : 's'} pending review. Oldest in queue: ${leadIncident.location}.`
            : 'No incidents are currently waiting in the review queue.'}
        </p>
        <button
          className="admin-btn admin-btn-sm admin-btn-danger"
          style={{ marginTop: 8, width: '100%' }}
          onClick={() => navigate(leadIncident ? `/admin/incidents/${leadIncident.reportId}` : '/admin/incidents')}
        >
          {leadIncident ? 'Review Oldest Incident' : 'Open Queue'}
        </button>
      </div>

      <div className="admin-ctx-card">
        <h4>{PANEL_ICONS.queueLoad} Queue Load</h4>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
          <span>Pending Reviews</span>
          <span style={{ fontWeight: 700, color: 'var(--admin-warning)' }}>{counts.pending}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
          <span>Community Flagged</span>
          <span style={{ fontWeight: 700, color: 'var(--admin-danger)' }}>{counts.community}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>AI High Risk</span>
          <span style={{ fontWeight: 700, color: 'var(--admin-text)' }}>{counts['ai-flagged']}</span>
        </div>
      </div>

      <div className="admin-ctx-card">
        <h4>{PANEL_ICONS.workflow} Workflow Snapshot</h4>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
          <span>Merged Reports</span>
          <span style={{ fontWeight: 700, color: 'var(--admin-text)' }}>{counts.merged}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
          <span>Archived Reports</span>
          <span style={{ fontWeight: 700, color: 'var(--admin-text)' }}>{counts.archived}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>Completed AI Assessments</span>
          <span style={{ fontWeight: 700, color: 'var(--admin-success)' }}>{counts.completedAiReports}</span>
        </div>
      </div>

      <div className="admin-ctx-title" style={{ marginTop: 16 }}>Moderation Guidance</div>

      <div className="admin-ctx-card">
        <h4 style={{ color: 'var(--admin-warning)' }}>{PANEL_ICONS.severity} Severity hints remain the fallback</h4>
        <p>Incident reports use the user-submitted severity hint until a completed AI assessment exists.</p>
      </div>
      <div className="admin-ctx-card">
        <h4 style={{ color: 'var(--admin-warning)' }}>{PANEL_ICONS.reporter} Reporter score is intentionally blank</h4>
        <p>Trust and reporter reputation are not implemented yet, so moderation views show a dash instead of fake scoring.</p>
      </div>
    </aside>
  )
}

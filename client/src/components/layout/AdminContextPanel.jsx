import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

import { fetchAdminIncidents } from '../../services/adminIncidentsService'

const PANEL_ICONS = {
  reviewQueue: '\u{1F534}',
  queueLoad: '⚡',
  workflow: '⊕',
  severity: '◆',
  reporter: '▲',
}

export default function AdminContextPanel() {
  const navigate = useNavigate()
  const { t } = useTranslation(['admin', 'common'])
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
      <div className="admin-ctx-title">{t('adminContextPanel.liveIntelligence')}</div>

      <div className="admin-ctx-card">
        <h4>{PANEL_ICONS.reviewQueue} {t('adminContextPanel.reviewQueueActive')}</h4>
        <p>
          {leadIncident
            ? t('adminContextPanel.pendingReviewOldest', { count: counts.pending, location: leadIncident.location })
            : t('adminContextPanel.noIncidentsPending')}
        </p>
        <button
          className="admin-btn admin-btn-sm admin-btn-danger"
          style={{ marginTop: 8, width: '100%' }}
          onClick={() => navigate(leadIncident ? `/admin/incidents/${leadIncident.reportId}` : '/admin/incidents')}
        >
          {leadIncident ? t('adminContextPanel.reviewOldestIncident') : t('adminContextPanel.openQueue')}
        </button>
      </div>

      <div className="admin-ctx-card">
        <h4>{PANEL_ICONS.queueLoad} {t('adminContextPanel.queueLoad')}</h4>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
          <span>{t('adminContextPanel.pendingReviews')}</span>
          <span style={{ fontWeight: 700, color: 'var(--admin-warning)' }}>{counts.pending}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
          <span>{t('adminContextPanel.communityFlagged')}</span>
          <span style={{ fontWeight: 700, color: 'var(--admin-danger)' }}>{counts.community}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>{t('adminContextPanel.aiHighRisk')}</span>
          <span style={{ fontWeight: 700, color: 'var(--admin-text)' }}>{counts['ai-flagged']}</span>
        </div>
      </div>

      <div className="admin-ctx-card">
        <h4>{PANEL_ICONS.workflow} {t('adminContextPanel.workflowSnapshot')}</h4>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
          <span>{t('adminContextPanel.mergedReports')}</span>
          <span style={{ fontWeight: 700, color: 'var(--admin-text)' }}>{counts.merged}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
          <span>{t('adminContextPanel.archivedReports')}</span>
          <span style={{ fontWeight: 700, color: 'var(--admin-text)' }}>{counts.archived}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>{t('adminContextPanel.completedAiAssessments')}</span>
          <span style={{ fontWeight: 700, color: 'var(--admin-success)' }}>{counts.completedAiReports}</span>
        </div>
      </div>

      <div className="admin-ctx-title" style={{ marginTop: 16 }}>{t('adminContextPanel.moderationGuidance')}</div>

      <div className="admin-ctx-card">
        <h4 style={{ color: 'var(--admin-warning)' }}>{PANEL_ICONS.severity} {t('adminContextPanel.severityHintsTitle')}</h4>
        <p>{t('adminContextPanel.severityHintsBody')}</p>
      </div>
      <div className="admin-ctx-card">
        <h4 style={{ color: 'var(--admin-warning)' }}>{PANEL_ICONS.reporter} {t('adminContextPanel.reporterScoreTitle')}</h4>
        <p>{t('adminContextPanel.reporterScoreBody')}</p>
      </div>
    </aside>
  )
}

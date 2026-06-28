/**
 * SIARA Admin Inbox
 *
 * Two inbound streams unified in one workspace:
 *   1. Contact-form submissions (app.support_messages)
 *   2. Reporter responses to admin "Request More Info" actions
 *
 * Layout: header + search/tabs + status filter + split (list / detail).
 * Styling lives in styles/AdminInbox.css. No inline styles below.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

import InboxRoundedIcon            from '@mui/icons-material/InboxRounded'
import SearchRoundedIcon           from '@mui/icons-material/SearchRounded'
import ArrowBackRoundedIcon         from '@mui/icons-material/ArrowBackRounded'
import RefreshRoundedIcon          from '@mui/icons-material/RefreshRounded'
import MailOutlineRoundedIcon      from '@mui/icons-material/MailOutlineRounded'
import HelpOutlineRoundedIcon      from '@mui/icons-material/HelpOutlineRounded'
import ArchiveOutlinedIcon         from '@mui/icons-material/ArchiveOutlined'
import DraftsOutlinedIcon          from '@mui/icons-material/DraftsOutlined'
import MarkEmailReadOutlinedIcon   from '@mui/icons-material/MarkEmailReadOutlined'
import OpenInNewRoundedIcon        from '@mui/icons-material/OpenInNewRounded'
import SendRoundedIcon             from '@mui/icons-material/SendRounded'
import EmailOutlinedIcon           from '@mui/icons-material/EmailOutlined'
import AccessTimeOutlinedIcon      from '@mui/icons-material/AccessTimeOutlined'
import ChatBubbleOutlineRoundedIcon from '@mui/icons-material/ChatBubbleOutlineRounded'
import CheckCircleOutlineRoundedIcon from '@mui/icons-material/CheckCircleOutlineRounded'
import ErrorOutlineRoundedIcon     from '@mui/icons-material/ErrorOutlineRounded'

import {
  fetchAdminInbox,
  fetchAdminSupportMessages,
  updateAdminSupportMessage,
  deleteAdminSupportMessage,
  replyToAdminSupportMessage,
  updateAdminInfoReplyStatus,
} from '../../services/supportMessagesService'

import '../../styles/AdminInbox.css'

/* ──────────────────────────────────────────────────────────────────
   Constants
   ────────────────────────────────────────────────────────────────── */

const TAB_FROM_QUERY = { support: 'support', info: 'info', all: 'all' }
const QUERY_FROM_TAB = { support: 'support', info: 'info', all: '' }

const MAX_REPLY_CHARS = 4000

/* ──────────────────────────────────────────────────────────────────
   Helpers
   ────────────────────────────────────────────────────────────────── */

function timeAgo(value) {
  if (!value) return ''
  const date = new Date(value)
  const s = Math.round((Date.now() - date.getTime()) / 1000)
  if (Number.isNaN(s) || s < 0) return ''
  if (s < 60)     return 'just now'
  if (s < 3600)   return `${Math.floor(s / 60)}m`
  if (s < 86400)  return `${Math.floor(s / 3600)}h`
  if (s < 604800) return `${Math.floor(s / 86400)}d`
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function fullDate(value) {
  if (!value) return ''
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleString(undefined, {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function initials(name) {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

/**
 * Build a Gmail compose URL. Opens in a new tab and pre-fills To + Subject,
 * regardless of which mail handler the admin's OS has registered for mailto:.
 * Body is intentionally left empty so the admin can type freely.
 */
function gmailComposeUrl(to, subject) {
  const params = new URLSearchParams({
    view: 'cm',
    fs:   '1',
    to:   to || '',
    su:   subject || '',
  })
  return `https://mail.google.com/mail/?${params.toString()}`
}

/* ──────────────────────────────────────────────────────────────────
   Tiny atoms
   ────────────────────────────────────────────────────────────────── */

function Avatar({ name, isInfo, size = 'sm' }) {
  return (
    <div className={`ix-avatar${isInfo ? ' ix-avatar--info' : ''}${size === 'md' ? ' ix-avatar--md' : ''}`}>
      {initials(name)}
    </div>
  )
}

function KindChip({ isInfo }) {
  const { t } = useTranslation(['admin'])
  return isInfo ? (
    <span className="ix-chip ix-chip--info">
      <HelpOutlineRoundedIcon style={{ fontSize: 11 }} />
      {t('adminInboxPage.kindChip.infoReply')}
    </span>
  ) : (
    <span className="ix-chip ix-chip--contact">
      <MailOutlineRoundedIcon style={{ fontSize: 11 }} />
      {t('adminInboxPage.kindChip.contact')}
    </span>
  )
}

function StatusChip({ status }) {
  const { t } = useTranslation(['admin'])
  const key = status || 'new'
  const label = t(`adminInboxPage.statusChip.${key}`, key.charAt(0).toUpperCase() + key.slice(1))
  return <span className={`ix-status ix-status--${key}`}>{label}</span>
}

/* ══════════════════════════════════════════════════════════════════
   PAGE COMPONENT
   ══════════════════════════════════════════════════════════════════ */

export default function AdminInboxPage() {
  const { t } = useTranslation(['admin', 'common'])
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  const showParam = String(searchParams.get('show') || '').toLowerCase()
  const tab = TAB_FROM_QUERY[showParam] || 'all'
  const setTab = useCallback((next) => {
    const qv = QUERY_FROM_TAB[next] ?? ''
    setSearchParams((prev) => {
      const p = new URLSearchParams(prev)
      if (qv) p.set('show', qv); else p.delete('show')
      return p
    }, { replace: true })
  }, [setSearchParams])

  const [statusFilter, setStatusFilter] = useState('')
  const [searchTerm,   setSearchTerm]   = useState('')
  const [items,        setItems]        = useState([])
  const [counts,       setCounts]       = useState({})
  const [loading,      setLoading]      = useState(true)
  const [error,        setError]        = useState(null)
  const [selectedId,   setSelectedId]   = useState(null)
  const [actionState,  setActionState]  = useState({ id: null, busy: false })
  const [replyDrafts,  setReplyDrafts]  = useState({})
  const [replyStatus,  setReplyStatus]  = useState({})
  // On phones the list and detail share one column; this toggles between them.
  const [mobileView,   setMobileView]   = useState('list')

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const [inbox, list] = await Promise.all([
        fetchAdminInbox({ limit: 80 }),
        fetchAdminSupportMessages({ limit: 100, status: statusFilter || undefined }),
      ])
      setItems(Array.isArray(inbox?.items) ? inbox.items : [])
      setCounts(list?.counts || {})
    } catch (err) {
      setError(err)
    } finally {
      setLoading(false)
    }
  }, [statusFilter])

  useEffect(() => { load() }, [load])

  const filteredItems = useMemo(() => {
    const term = searchTerm.trim().toLowerCase()
    return items.filter((it) => {
      if (tab === 'support' && it.kind !== 'support_message') return false
      if (tab === 'info'    && it.kind !== 'info_response')   return false
      if (statusFilter && it.kind === 'support_message' && it.status !== statusFilter) return false
      if (term) {
        const haystack = [it.name, it.email, it.subject, it.body, it.reportTitle]
          .filter(Boolean).join(' ').toLowerCase()
        if (!haystack.includes(term)) return false
      }
      return true
    })
  }, [items, tab, statusFilter, searchTerm])

  const selected = useMemo(
    () => filteredItems.find((it) => it.id === selectedId) || filteredItems[0] || null,
    [filteredItems, selectedId],
  )

  /* ─── Actions ─── */

  async function setStatus(id, status) {
    setActionState({ id, busy: true })
    try { await updateAdminSupportMessage(id, { status }); await load() }
    catch (err) { setError(err) }
    finally { setActionState({ id: null, busy: false }) }
  }

  async function archive(id) {
    setActionState({ id, busy: true })
    try { await deleteAdminSupportMessage(id); await load() }
    catch (err) { setError(err) }
    finally { setActionState({ id: null, busy: false }) }
  }

  async function setInfoReplyStatus(reportId, status) {
    setActionState({ id: reportId, busy: true })
    try { await updateAdminInfoReplyStatus(reportId, status); await load() }
    catch (err) { setError(err) }
    finally { setActionState({ id: null, busy: false }) }
  }

  async function sendReply(id) {
    const draft = (replyDrafts[id] || '').trim()
    if (!draft) return
    setReplyStatus((p) => ({ ...p, [id]: { state: 'sending' } }))
    try {
      await replyToAdminSupportMessage(id, draft)
      setReplyStatus((p) => ({ ...p, [id]: { state: 'sent' } }))
      setReplyDrafts((p) => ({ ...p, [id]: '' }))
      await load()
    } catch (err) {
      setReplyStatus((p) => ({ ...p, [id]: { state: 'error', error: err?.message || 'Failed' } }))
    }
  }

  /* ─── Counts ─── */

  const newCount     = counts?.new_count ?? 0
  const supportCount = items.filter((i) => i.kind === 'support_message').length
  const infoCount    = items.filter((i) => i.kind === 'info_response').length

  const STATUS_OPTIONS = [
    { value: '',         label: t('adminInboxPage.statusFilter.all') },
    { value: 'new',      label: t('adminInboxPage.statusFilter.new') },
    { value: 'read',     label: t('adminInboxPage.statusFilter.read') },
    { value: 'replied',  label: t('adminInboxPage.statusFilter.replied') },
    { value: 'archived', label: t('adminInboxPage.statusFilter.archived') },
  ]

  return (
    <div className={`inbox${mobileView === 'list' ? ' inbox--list-mode' : ''}`}>

      {/* ── HEADER ─────────────────────────────────────────────── */}
      <header className="inbox__header">
        <div className="inbox__title-group">
          <div className="inbox__brand">
            <InboxRoundedIcon fontSize="inherit" />
          </div>
          <div>
            <h1 className="inbox__title">{t('adminInboxPage.title')}</h1>
            <p className="inbox__title-meta">
              <strong>{filteredItems.length}</strong> {t('adminInboxPage.messageCount', { count: filteredItems.length })}
              {newCount > 0 ? <span className="inbox__new-pill">{t('adminInboxPage.newCount', { count: newCount })}</span> : null}
            </p>
          </div>
        </div>

        <div className="inbox__header-actions">
          <button
            type="button"
            className="ix-btn"
            onClick={load}
            disabled={loading}
          >
            <RefreshRoundedIcon
              style={{ fontSize: 15 }}
              className={loading ? 'ix-spin' : ''}
            />
            {loading ? t('adminInboxPage.refreshing') : t('adminInboxPage.refresh')}
          </button>
        </div>
      </header>

      {/* ── SEARCH + TABS ──────────────────────────────────────── */}
      <div className="inbox__toolbar">
        <label className="inbox__search">
          <SearchRoundedIcon className="inbox__search-icon" />
          <input
            type="text"
            className="inbox__search-input"
            placeholder={t('adminInboxPage.searchPlaceholder')}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </label>

        <nav className="inbox__tabs">
          {[
            { key: 'all',     label: t('adminInboxPage.tabs.all'),         count: items.length   },
            { key: 'support', label: t('adminInboxPage.tabs.contact'),      count: supportCount   },
            { key: 'info',    label: t('adminInboxPage.tabs.infoReplies'),  count: infoCount      },
          ].map((tab_item) => (
            <button
              key={tab_item.key}
              type="button"
              className={`inbox__tab ${tab === tab_item.key ? 'inbox__tab--active' : ''}`}
              onClick={() => setTab(tab_item.key)}
            >
              {tab_item.label}
              <span className="inbox__tab-count">{tab_item.count}</span>
            </button>
          ))}
        </nav>
      </div>

      {/* ── STATUS FILTER (Contact only) ───────────────────────── */}
      {tab !== 'info' ? (
        <div className="inbox__filter-bar">
          <span className="inbox__filter-label">{t('adminInboxPage.statusLabel')}</span>
          <div className="inbox__segmented">
            {STATUS_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                className={`inbox__seg ${statusFilter === opt.value ? 'inbox__seg--active' : ''}`}
                onClick={() => setStatusFilter(opt.value)}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {/* ── ERROR ──────────────────────────────────────────────── */}
      {error ? (
        <div className="inbox__error">
          <ErrorOutlineRoundedIcon style={{ fontSize: 15 }} />
          {t('adminInboxPage.loadError', { message: error.message || t('adminInboxPage.unknownError') })}
        </div>
      ) : null}

      {/* ── BODY: LIST | DETAIL ────────────────────────────────── */}
      <div className="inbox__body">

        {/* ─── LIST ────────────────────────────────────────────── */}
        <div className="inbox__list">
          {filteredItems.length === 0 ? (
            <div className="inbox__list-empty">
              <InboxRoundedIcon className="inbox__list-empty-icon" />
              {loading ? t('common:actions.loading') : t('adminInboxPage.noMessagesMatch')}
              {!loading && (searchTerm || statusFilter) ? (
                <p className="inbox__list-empty-hint">{t('adminInboxPage.clearFiltersHint')}</p>
              ) : null}
            </div>
          ) : (
            filteredItems.map((it) => {
              const isInfo   = it.kind === 'info_response'
              const isSel    = selected?.id === it.id
              const isUnread = it.status === 'new' || !it.status
              return (
                <button
                  type="button"
                  key={it.id}
                  className={[
                    'inbox__item',
                    isSel    ? 'inbox__item--active' : '',
                    isUnread ? 'inbox__item--unread' : '',
                  ].filter(Boolean).join(' ')}
                  onClick={() => { setSelectedId(it.id); setMobileView('detail') }}
                >
                  <Avatar name={it.name} isInfo={isInfo} />
                  <div className="inbox__item-main">
                    <div className="inbox__item-row1">
                      <span className="inbox__item-name">
                        {it.name || it.email || t('adminInboxPage.unknownSender')}
                      </span>
                      <span className="inbox__item-time">{timeAgo(it.createdAt)}</span>
                    </div>
                    <div className="inbox__item-preview">
                      {it.subject || (it.body ? String(it.body).slice(0, 80) : '—')}
                    </div>
                    <div className="inbox__item-tags">
                      <KindChip isInfo={isInfo} />
                      <StatusChip status={it.status || 'new'} />
                      {isUnread ? <span className="inbox__item-unread-dot" /> : null}
                    </div>
                  </div>
                </button>
              )
            })
          )}
        </div>

        {/* ─── DETAIL ──────────────────────────────────────────── */}
        <div className="inbox__detail">
          <button type="button" className="inbox__back" onClick={() => setMobileView('list')}>
            <ArrowBackRoundedIcon style={{ fontSize: 16 }} />
            {t('adminInboxPage.allMessages')}
          </button>
          {!selected ? (
            <div className="inbox__empty">
              <ChatBubbleOutlineRoundedIcon className="inbox__empty-icon" />
              <h2 className="inbox__empty-title">{t('adminInboxPage.noMessageSelected')}</h2>
              <p className="inbox__empty-sub">
                {t('adminInboxPage.noMessageSelectedHint')}
              </p>
            </div>
          ) : selected.kind === 'info_response' ? (
            <InfoReplyDetail
              selected={selected}
              navigate={navigate}
              busy={actionState.busy && actionState.id === selected.reportId}
              onSetStatus={(s) => setInfoReplyStatus(selected.reportId, s)}
            />
          ) : (
            <ContactDetail
              selected={selected}
              draft={replyDrafts[selected.sourceId] || ''}
              status={replyStatus[selected.sourceId] || { state: 'idle' }}
              busy={actionState.busy && actionState.id === selected.sourceId}
              onDraftChange={(v) => setReplyDrafts((p) => ({ ...p, [selected.sourceId]: v }))}
              onSendReply={() => sendReply(selected.sourceId)}
              onSetStatus={(s) => setStatus(selected.sourceId, s)}
              onArchive={() => archive(selected.sourceId)}
            />
          )}
        </div>
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════════
   INFO-REPLY DETAIL
   ══════════════════════════════════════════════════════════════════ */

function InfoReplyDetail({ selected, navigate, busy, onSetStatus }) {
  const { t } = useTranslation(['admin'])
  return (
    <div className="inbox__detail-inner">

      {/* Sender row */}
      <header className="ix-sender">
        <div className="ix-sender__id">
          <Avatar name={selected.name} isInfo size="md" />
          <div>
            <h2 className="ix-sender__name">{selected.name || t('adminInboxPage.unknownReporter')}</h2>
            {selected.email ? (
              <div className="ix-sender__email">
                <EmailOutlinedIcon style={{ fontSize: 13 }} />
                {selected.email}
              </div>
            ) : null}
          </div>
        </div>
        <div className="ix-sender__meta">
          <KindChip isInfo />
          <StatusChip status={selected.status || 'new'} />
        </div>
      </header>

      {/* Report reference */}
      {selected.reportTitle ? (
        <div className="ix-report-ref">
          <span className="ix-report-ref__label">{t('adminInboxPage.reportLabel')}</span>
          <span className="ix-report-ref__value">{selected.reportTitle}</span>
          <span className="ix-report-ref__time">
            <AccessTimeOutlinedIcon style={{ fontSize: 13 }} />
            {t('adminInboxPage.repliedAt', { time: timeAgo(selected.respondedAt) })}
          </span>
        </div>
      ) : null}

      {/* Conversation thread */}
      <section className="ix-card">
        <div className="ix-card__head">
          <span className="ix-card__head-title">
            <ChatBubbleOutlineRoundedIcon style={{ fontSize: 14 }} />
            {t('adminInboxPage.conversation')}
          </span>
        </div>
        <div className="ix-thread">
          {selected.question ? (
            <div className="ix-thread__item">
              <span className="ix-thread__label ix-thread__label--admin">
                {t('adminInboxPage.adminQuestion')}
              </span>
              <div className="ix-bubble ix-bubble--admin">{selected.question}</div>
            </div>
          ) : null}
          <div className="ix-thread__item">
            <span className="ix-thread__label ix-thread__label--reporter">
              {t('adminInboxPage.reporterAnswer')}
            </span>
            <div className="ix-bubble ix-bubble--reporter">{selected.body}</div>
          </div>
        </div>
      </section>

      {/* Actions — info reply */}
      <section className="ix-actions">
        <div className="ix-actions__head">
          <span className="ix-actions__title">{t('adminInboxPage.actions')}</span>
          <span className="ix-actions__sub">{fullDate(selected.respondedAt)}</span>
        </div>
        <div className="ix-actions__row">
          <button
            type="button"
            className="ix-btn ix-btn--primary"
            onClick={() => navigate(`/admin/incidents/${selected.reportId}`)}
          >
            <OpenInNewRoundedIcon style={{ fontSize: 15 }} />
            {t('adminInboxPage.openIncident')}
          </button>
          {selected.email ? (
            <a
              className="ix-btn"
              href={gmailComposeUrl(selected.email, 'Re: ' + (selected.reportTitle || 'Your SIARA report'))}
              target="_blank"
              rel="noopener noreferrer"
            >
              <EmailOutlinedIcon style={{ fontSize: 15 }} />
              {t('adminInboxPage.emailReporter')}
            </a>
          ) : null}
          <button
            type="button"
            className="ix-btn"
            disabled={busy || selected.status === 'read'}
            onClick={() => onSetStatus('read')}
          >
            <DraftsOutlinedIcon style={{ fontSize: 15 }} />
            {selected.status === 'read' ? t('adminInboxPage.markedAsRead') : t('adminInboxPage.markAsRead')}
          </button>
          <button
            type="button"
            className="ix-btn ix-btn--danger"
            disabled={busy}
            onClick={() => onSetStatus('archived')}
          >
            <ArchiveOutlinedIcon style={{ fontSize: 15 }} />
            {t('adminInboxPage.archive')}
          </button>
        </div>
        <p className="ix-actions__hint">
          {t('adminInboxPage.infoReplyHint')}
        </p>
      </section>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════════
   CONTACT MESSAGE DETAIL
   ══════════════════════════════════════════════════════════════════ */

function ContactDetail({ selected, draft, status, busy, onDraftChange, onSendReply, onSetStatus, onArchive }) {
  const { t } = useTranslation(['admin'])
  const sending        = status.state === 'sending'
  const justSent       = status.state === 'sent'
  const alreadyReplied = selected.status === 'replied' && !justSent
  const isReplied      = justSent || alreadyReplied

  return (
    <div className="inbox__detail-inner">

      {/* Sender row */}
      <header className="ix-sender">
        <div className="ix-sender__id">
          <Avatar name={selected.name} size="md" />
          <div>
            <h2 className="ix-sender__name">{selected.name || t('adminInboxPage.unknownSenderFull')}</h2>
            <div className="ix-sender__email">
              <EmailOutlinedIcon style={{ fontSize: 13 }} />
              {selected.email}
            </div>
          </div>
        </div>
        <div className="ix-sender__meta">
          <KindChip />
          <StatusChip status={selected.status || 'new'} />
        </div>
      </header>

      {/* Subject */}
      {selected.subject ? (
        <h1 className="ix-subject">{selected.subject}</h1>
      ) : null}

      {/* Message body */}
      <section className="ix-card">
        <div className="ix-card__head">
          <span className="ix-card__head-title">
            <MailOutlineRoundedIcon style={{ fontSize: 14 }} />
            {t('adminInboxPage.message')}
          </span>
          <span className="ix-report-ref__time">
            <AccessTimeOutlinedIcon style={{ fontSize: 13 }} />
            {fullDate(selected.createdAt)}
          </span>
        </div>
        <div className="ix-card__body">{selected.body}</div>
      </section>

      {/* Reply composer */}
      <section className="ix-composer">
        <div className="ix-composer__head">
          <span className={`ix-composer__label${isReplied ? ' ix-composer__label--sent' : ''}`}>
            {isReplied ? t('adminInboxPage.replySent') : t('adminInboxPage.writeReply')}
          </span>
          {selected.userId ? (
            <span className="ix-delivery ix-delivery--in-app">{t('adminInboxPage.inAppNotification')}</span>
          ) : (
            <span className="ix-delivery ix-delivery--anon">{t('adminInboxPage.anonymousEmailOnly')}</span>
          )}
        </div>

        {alreadyReplied ? (
          <div className="ix-composer__notice">
            <CheckCircleOutlineRoundedIcon style={{ fontSize: 15, marginTop: 1 }} />
            <span>{t('adminInboxPage.alreadyRepliedNotice')}</span>
          </div>
        ) : null}

        {status.state === 'error' ? (
          <div className="ix-composer__error">
            <ErrorOutlineRoundedIcon style={{ fontSize: 15, marginTop: 1 }} />
            <span>{status.error}</span>
          </div>
        ) : null}

        <div className="ix-composer__textarea-wrap">
          <textarea
            className="ix-composer__textarea"
            value={draft}
            onChange={(e) => onDraftChange(e.target.value)}
            placeholder={t('adminInboxPage.replyPlaceholder', { name: selected.name || t('adminInboxPage.theSender') })}
            rows={5}
            maxLength={MAX_REPLY_CHARS}
            disabled={sending}
          />
        </div>

        <div className="ix-composer__foot">
          {(() => {
            const pct = Math.min(100, (draft.length / MAX_REPLY_CHARS) * 100)
            const tone = pct >= 95 ? 'danger' : pct >= 80 ? 'warn' : ''
            return (
              <span className={`ix-composer__counter${tone ? ` ix-composer__counter--${tone}` : ''}`}>
                <span className="ix-composer__counter-bar">
                  <span className="ix-composer__counter-bar-fill" style={{ width: `${pct}%` }} />
                </span>
                <strong>{draft.length.toLocaleString()}</strong>
                <span style={{ color: 'var(--ix-fg-4)' }}>/ {MAX_REPLY_CHARS.toLocaleString()}</span>
              </span>
            )
          })()}
          <div className="ix-composer__foot-actions">
            <a
              className="ix-btn ix-btn--ghost"
              href={gmailComposeUrl(selected.email, 'Re: ' + (selected.subject || 'Your SIARA support request'))}
              target="_blank"
              rel="noopener noreferrer"
            >
              <EmailOutlinedIcon style={{ fontSize: 14 }} />
              {t('adminInboxPage.emailInstead')}
            </a>
            <button
              type="button"
              className="ix-composer__send"
              disabled={!draft.trim() || sending}
              onClick={onSendReply}
            >
              <SendRoundedIcon style={{ fontSize: 14 }} />
              {sending ? t('adminInboxPage.sending') : t('adminInboxPage.sendReply')}
            </button>
          </div>
        </div>
      </section>

      {/* Status actions */}
      <section className="ix-actions">
        <div className="ix-actions__head">
          <span className="ix-actions__title">{t('adminInboxPage.manageThread')}</span>
        </div>
        <div className="ix-actions__row">
          <button
            type="button"
            className="ix-btn"
            disabled={busy}
            onClick={() => onSetStatus('read')}
          >
            <DraftsOutlinedIcon style={{ fontSize: 15 }} />
            {t('adminInboxPage.markAsRead')}
          </button>
          <button
            type="button"
            className="ix-btn ix-btn--success"
            disabled={busy}
            onClick={() => onSetStatus('replied')}
          >
            <MarkEmailReadOutlinedIcon style={{ fontSize: 15 }} />
            {t('adminInboxPage.markAsReplied')}
          </button>
          <button
            type="button"
            className="ix-btn ix-btn--danger"
            disabled={busy}
            onClick={onArchive}
          >
            <ArchiveOutlinedIcon style={{ fontSize: 15 }} />
            {t('adminInboxPage.archive')}
          </button>
        </div>
      </section>
    </div>
  )
}

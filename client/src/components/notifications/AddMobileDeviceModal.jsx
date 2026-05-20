// Modal that walks a logged-in web user through pairing a new mobile device.
//
// Flow:
//   1. POST /api/push/mobile/pairing-sessions  → { session, pairingUrl, code, expiresAt }
//   2. Render QR for pairingUrl, show countdown until expiresAt.
//   3. Poll GET /api/push/mobile/pairing-sessions/:id every 2s.
//   4. When session.status === 'completed', call onCompleted(session, device).
//   5. Cancel button → DELETE /api/push/mobile/pairing-sessions/:id.
//   6. On expiry, show "QR expired" and an "Issue new QR" button.
//
// Security: the QR contains ONLY the short-lived pairing URL (siara://
// pair-device?code=...). No JWT, refresh token, password, or Expo push token
// is ever encoded. The backend stores a hash of the code and enforces
// one-time-use + 5-minute TTL + per-user binding.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import QRCode from 'qrcode'

import {
  cancelMobilePairingSession,
  createMobilePairingSession,
  fetchMobilePairingSession,
} from '../../services/pushService'

const POLL_INTERVAL_MS = 2000

function formatCountdown(remainingMs) {
  const totalSeconds = Math.max(0, Math.ceil(remainingMs / 1000))
  const mm = String(Math.floor(totalSeconds / 60)).padStart(2, '0')
  const ss = String(totalSeconds % 60).padStart(2, '0')
  return `${mm}:${ss}`
}

export default function AddMobileDeviceModal({ open, onClose, onCompleted }) {
  const [stage, setStage] = useState('idle') // idle | loading | waiting | expired | completed | error
  const [error, setError] = useState('')
  const [session, setSession] = useState(null)
  const [pairingUrl, setPairingUrl] = useState('')
  const [qrDataUrl, setQrDataUrl] = useState('')
  const [nowTick, setNowTick] = useState(Date.now())
  const pollRef = useRef(null)
  const tickRef = useRef(null)

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      window.clearInterval(pollRef.current)
      pollRef.current = null
    }
  }, [])

  const stopTicker = useCallback(() => {
    if (tickRef.current) {
      window.clearInterval(tickRef.current)
      tickRef.current = null
    }
  }, [])

  const reset = useCallback(() => {
    stopPolling()
    stopTicker()
    setSession(null)
    setPairingUrl('')
    setQrDataUrl('')
    setError('')
    setStage('idle')
  }, [stopPolling, stopTicker])

  const issueSession = useCallback(async () => {
    setError('')
    setStage('loading')
    try {
      const data = await createMobilePairingSession({
        meta: { source: 'web_settings' },
      })
      if (!data?.session?.id || !data?.pairingUrl) {
        throw new Error('Pairing service did not return a usable QR code.')
      }
      setSession(data.session)
      setPairingUrl(data.pairingUrl)
      // Render the QR client-side so the raw code is never logged remotely.
      const dataUrl = await QRCode.toDataURL(data.pairingUrl, {
        margin: 2,
        scale: 6,
        errorCorrectionLevel: 'M',
        color: { dark: '#111827', light: '#ffffff' },
      })
      setQrDataUrl(dataUrl)
      setStage('waiting')
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || 'Unable to start pairing.')
      setStage('error')
    }
  }, [])

  // Kick off a session when the modal first opens; on close, abandon state so
  // a re-open does NOT reuse a stale code.
  useEffect(() => {
    if (!open) {
      reset()
      return undefined
    }
    issueSession()
    return undefined
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // 1s ticker keeps the countdown current.
  useEffect(() => {
    if (stage !== 'waiting') return undefined
    tickRef.current = window.setInterval(() => setNowTick(Date.now()), 1000)
    return () => stopTicker()
  }, [stage, stopTicker])

  // Poll the session every 2s while waiting. We mark expired client-side too
  // so the countdown banner flips even if the polled response races.
  useEffect(() => {
    if (stage !== 'waiting' || !session?.id) return undefined

    let cancelled = false
    const tick = async () => {
      try {
        const next = await fetchMobilePairingSession(session.id)
        if (cancelled || !next) return
        setSession(next)
        if (next.status === 'completed') {
          stopPolling()
          stopTicker()
          setStage('completed')
          if (typeof onCompleted === 'function') {
            onCompleted(next)
          }
        } else if (next.status === 'expired' || next.status === 'cancelled') {
          stopPolling()
          stopTicker()
          setStage('expired')
        }
      } catch (err) {
        // Polling is best-effort; surface a soft error but keep polling so a
        // transient network blip does not abort the flow.
        if (!cancelled) {
          setError(err?.response?.data?.message || err?.message || 'Pairing status check failed.')
        }
      }
    }

    // Immediate kick + interval so the user does not wait 2s for the first read.
    tick()
    pollRef.current = window.setInterval(tick, POLL_INTERVAL_MS)
    return () => {
      cancelled = true
      stopPolling()
    }
  }, [stage, session?.id, onCompleted, stopPolling, stopTicker])

  // Local expiry detection — flips the UI to "expired" without waiting for
  // the next backend poll.
  const remainingMs = useMemo(() => {
    if (!session?.expiresAt) return 0
    return new Date(session.expiresAt).getTime() - nowTick
  }, [nowTick, session?.expiresAt])

  useEffect(() => {
    if (stage === 'waiting' && remainingMs <= 0 && session?.expiresAt) {
      setStage('expired')
      stopPolling()
      stopTicker()
    }
  }, [remainingMs, session?.expiresAt, stage, stopPolling, stopTicker])

  const handleCancel = useCallback(async () => {
    const sessionId = session?.id
    stopPolling()
    stopTicker()
    if (sessionId) {
      try {
        await cancelMobilePairingSession(sessionId)
      } catch {
        // The session may already be expired/used — ignore the cleanup error.
      }
    }
    if (typeof onClose === 'function') onClose()
  }, [onClose, session?.id, stopPolling, stopTicker])

  if (!open) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-mobile-device-title"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15, 23, 42, 0.55)',
        zIndex: 2000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
    >
      <div
        style={{
          background: '#ffffff',
          borderRadius: 14,
          width: '100%',
          maxWidth: 420,
          boxShadow: '0 18px 40px rgba(0,0,0,0.18)',
          padding: 22,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h3 id="add-mobile-device-title" style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>
              Add mobile device
            </h3>
            <p style={{ marginTop: 6, fontSize: 13, color: '#475569' }}>
              Scan this QR code with the SIARA mobile app while signed in to the same account.
            </p>
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={handleCancel}
            style={{
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              fontSize: 22,
              lineHeight: 1,
              color: '#64748b',
            }}
          >
            ×
          </button>
        </div>

        <div style={{ marginTop: 16, minHeight: 280, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          {stage === 'loading' && (
            <p style={{ color: '#475569' }}>Generating pairing code…</p>
          )}

          {stage === 'error' && (
            <>
              <p style={{ color: '#b91c1c', textAlign: 'center' }}>{error || 'Pairing failed.'}</p>
              <button
                type="button"
                onClick={issueSession}
                style={{
                  marginTop: 12,
                  padding: '8px 18px',
                  borderRadius: 999,
                  border: '1px solid #1d4ed8',
                  background: '#1d4ed8',
                  color: '#ffffff',
                  cursor: 'pointer',
                }}
              >
                Retry
              </button>
            </>
          )}

          {stage === 'waiting' && qrDataUrl && (
            <>
              <img
                src={qrDataUrl}
                alt="SIARA mobile device pairing QR code"
                style={{ width: 232, height: 232, borderRadius: 8, border: '1px solid #e2e8f0' }}
              />
              <p style={{ marginTop: 10, fontSize: 13, color: '#475569' }}>
                Expires in <strong>{formatCountdown(remainingMs)}</strong>
              </p>
              <details style={{ marginTop: 8, fontSize: 12, color: '#475569' }}>
                <summary>Or paste this URL in the app</summary>
                <code style={{ display: 'block', marginTop: 6, fontSize: 11, wordBreak: 'break-all' }}>
                  {pairingUrl}
                </code>
              </details>
              {error && (
                <p style={{ marginTop: 8, fontSize: 12, color: '#b45309' }}>{error}</p>
              )}
            </>
          )}

          {stage === 'expired' && (
            <>
              <p style={{ color: '#b91c1c' }}>QR expired before pairing completed.</p>
              <button
                type="button"
                onClick={issueSession}
                style={{
                  marginTop: 12,
                  padding: '8px 18px',
                  borderRadius: 999,
                  border: '1px solid #1d4ed8',
                  background: '#1d4ed8',
                  color: '#ffffff',
                  cursor: 'pointer',
                }}
              >
                Generate new QR
              </button>
            </>
          )}

          {stage === 'completed' && (
            <p style={{ color: '#15803d' }}>
              Mobile device connected. You can close this window.
            </p>
          )}
        </div>

        <div style={{ marginTop: 18, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button
            type="button"
            onClick={handleCancel}
            style={{
              padding: '8px 16px',
              borderRadius: 999,
              border: '1px solid #cbd5f5',
              background: '#ffffff',
              color: '#1e293b',
              cursor: 'pointer',
            }}
          >
            {stage === 'completed' ? 'Done' : 'Cancel'}
          </button>
        </div>
      </div>
    </div>
  )
}

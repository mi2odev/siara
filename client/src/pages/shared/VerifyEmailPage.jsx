import React, { useContext, useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'

import { AuthContext } from '../../contexts/AuthContext'
import { getAuthenticatedRedirect } from '../../routes/routeAccess'
import { sendVerificationCode } from '../../services/authService'
import logo from '../../assets/logos/siara-logo.png'
import '../../styles/LoginPage.css'
import '../../styles/AuthFlowPage.css'

function getErrorMessage(error) {
  return error.response?.data?.message || error.message || 'Unable to verify your email right now.'
}

function getCountdownTarget(resendAvailableAt) {
  const timestamp = resendAvailableAt ? new Date(resendAvailableAt).getTime() : 0
  return Number.isFinite(timestamp) ? timestamp : 0
}

export default function VerifyEmailPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const { completeEmailVerification, isAuthenticated, isEmailVerified, user } = useContext(AuthContext)

  const [email, setEmail] = useState(searchParams.get('email') || user?.email || '')
  const [code, setCode] = useState('')
  const [rememberMe, setRememberMe] = useState(searchParams.get('rememberMe') === '1')
  const [loading, setLoading] = useState(false)
  const [resending, setResending] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState(location.state?.notice || '')
  const [resendTarget, setResendTarget] = useState(0)
  const [secondsRemaining, setSecondsRemaining] = useState(0)

  useEffect(() => {
    if (isAuthenticated && isEmailVerified) {
      navigate(getAuthenticatedRedirect(user, isEmailVerified), { replace: true })
    }
  }, [isAuthenticated, isEmailVerified, navigate, user])

  useEffect(() => {
    if (!resendTarget) {
      setSecondsRemaining(0)
      return undefined
    }

    const updateCountdown = () => {
      const remaining = Math.max(0, Math.ceil((resendTarget - Date.now()) / 1000))
      setSecondsRemaining(remaining)
    }

    updateCountdown()
    const timer = window.setInterval(updateCountdown, 1000)
    return () => window.clearInterval(timer)
  }, [resendTarget])

  const canResend = useMemo(() => secondsRemaining <= 0, [secondsRemaining])

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setNotice('')

    if (!email.trim() || !code.trim()) {
      setError('Email and verification code are required.')
      return
    }

    setLoading(true)

    try {
      const verifiedUser = await completeEmailVerification({
        email: email.trim().toLowerCase(),
        code: code.trim(),
        rememberMe,
      })

      navigate(getAuthenticatedRedirect(verifiedUser, true), { replace: true })
    } catch (verificationError) {
      setError(getErrorMessage(verificationError))
    } finally {
      setLoading(false)
    }
  }

  async function handleResendCode() {
    if (!email.trim() || !canResend) {
      return
    }

    setError('')
    setNotice('')
    setResending(true)

    try {
      const response = await sendVerificationCode(email.trim().toLowerCase())
      setNotice(response.message || 'A fresh verification code was sent to your email.')
      setResendTarget(Date.now() + 60 * 1000)
    } catch (sendError) {
      const resendAvailableAt = sendError.response?.data?.resendAvailableAt || null
      if (resendAvailableAt) {
        setResendTarget(getCountdownTarget(resendAvailableAt))
      }
      setError(getErrorMessage(sendError))
    } finally {
      setResending(false)
    }
  }

  return (
    <div className="siara-login-root">
      <div className="siara-auth-flow-shell">
        <div className="siara-auth-flow-card">
          <div className="siara-brand">
            <img src={logo} alt="SIARA logo" />
            <div>
              <div className="brand-name">SIARA</div>
              <div className="tag">Email verification</div>
            </div>
          </div>

          <h1 className="siara-form-title">Verify your email</h1>
          <p className="siara-form-sub">Enter the 6-digit code we sent to your inbox. Codes expire after 10 minutes.</p>

          {notice ? <div className="siara-notice-box">{notice}</div> : null}
          {error ? <div className="error-box" role="alert">{error}</div> : null}

          <form className="siara-auth-flow-form" onSubmit={handleSubmit}>
            <label htmlFor="verify-email-address" className="field-label">Email</label>
            <input
              id="verify-email-address"
              className="siara-input"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
            />

            <label htmlFor="verify-email-code" className="field-label">Verification code</label>
            <input
              id="verify-email-code"
              className="siara-input siara-code-input"
              inputMode="numeric"
              maxLength={6}
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="123456"
              autoComplete="one-time-code"
            />

            <label className="agree">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(event) => setRememberMe(event.target.checked)}
              />
              <span>Keep me signed in after verification.</span>
            </label>

            <button type="submit" className="siara-cta" disabled={loading}>
              {loading ? 'Verifying...' : 'Verify email'}
            </button>
          </form>

          <div className="siara-auth-inline-actions">
            <button
              type="button"
              className="siara-text-button"
              onClick={handleResendCode}
              disabled={!canResend || resending}
            >
              {resending
                ? 'Sending...'
                : canResend
                  ? 'Resend code'
                  : `Resend in ${secondsRemaining}s`}
            </button>
            <Link to="/login" className="link-accent">Back to login</Link>
          </div>
        </div>
      </div>
    </div>
  )
}

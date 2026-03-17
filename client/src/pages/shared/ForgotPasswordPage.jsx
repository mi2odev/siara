import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import {
  requestPasswordReset,
  resetPassword,
  verifyPasswordResetCode,
} from '../../services/authService'
import logo from '../../assets/logos/siara-logo.png'
import '../../styles/LoginPage.css'
import '../../styles/AuthFlowPage.css'

function getErrorMessage(error) {
  return error.response?.data?.message || error.message || 'Unable to complete this request right now.'
}

export default function ForgotPasswordPage() {
  const navigate = useNavigate()

  const [step, setStep] = useState('request')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [resetToken, setResetToken] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  async function handleRequestCode(event) {
    event.preventDefault()
    setError('')
    setNotice('')

    if (!email.trim()) {
      setError('Email is required.')
      return
    }

    setLoading(true)

    try {
      const response = await requestPasswordReset(email.trim().toLowerCase())
      setNotice(response.message || 'If that account exists, a 6-digit reset code has been sent.')
      setStep('verify')
    } catch (requestError) {
      setError(getErrorMessage(requestError))
    } finally {
      setLoading(false)
    }
  }

  async function handleVerifyCode(event) {
    event.preventDefault()
    setError('')
    setNotice('')

    if (!code.trim()) {
      setError('Reset code is required.')
      return
    }

    setLoading(true)

    try {
      const response = await verifyPasswordResetCode({
        email: email.trim().toLowerCase(),
        code: code.trim(),
      })

      setResetToken(response.resetToken || '')
      setNotice('Code verified. Choose a new password.')
      setStep('reset')
    } catch (verifyError) {
      setError(getErrorMessage(verifyError))
    } finally {
      setLoading(false)
    }
  }

  async function handleResetPassword(event) {
    event.preventDefault()
    setError('')
    setNotice('')

    if (!newPassword || !confirmPassword) {
      setError('Please enter and confirm your new password.')
      return
    }

    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters long.')
      return
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setLoading(true)

    try {
      await resetPassword({
        email: email.trim().toLowerCase(),
        resetToken,
        newPassword,
      })

      navigate('/login', {
        replace: true,
        state: {
          message: 'Password updated. You can sign in with your new password now.',
        },
      })
    } catch (resetError) {
      setError(getErrorMessage(resetError))
    } finally {
      setLoading(false)
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
              <div className="tag">Password recovery</div>
            </div>
          </div>

          <h1 className="siara-form-title">Reset your password</h1>
          <p className="siara-form-sub">Request a 6-digit reset code, verify it, then choose a new password.</p>

          {notice ? <div className="siara-notice-box">{notice}</div> : null}
          {error ? <div className="error-box" role="alert">{error}</div> : null}

          {step === 'request' ? (
            <form className="siara-auth-flow-form" onSubmit={handleRequestCode}>
              <label htmlFor="forgot-email" className="field-label">Email</label>
              <input
                id="forgot-email"
                className="siara-input"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />

              <button type="submit" className="siara-cta" disabled={loading}>
                {loading ? 'Sending code...' : 'Send reset code'}
              </button>
            </form>
          ) : null}

          {step === 'verify' ? (
            <form className="siara-auth-flow-form" onSubmit={handleVerifyCode}>
              <label htmlFor="forgot-email-verify" className="field-label">Email</label>
              <input
                id="forgot-email-verify"
                className="siara-input"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />

              <label htmlFor="forgot-code" className="field-label">Reset code</label>
              <input
                id="forgot-code"
                className="siara-input siara-code-input"
                inputMode="numeric"
                maxLength={6}
                placeholder="123456"
                value={code}
                onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
              />

              <button type="submit" className="siara-cta" disabled={loading}>
                {loading ? 'Verifying code...' : 'Verify code'}
              </button>

              <button type="button" className="siara-text-button" onClick={() => setStep('request')}>
                Send a new code
              </button>
            </form>
          ) : null}

          {step === 'reset' ? (
            <form className="siara-auth-flow-form" onSubmit={handleResetPassword}>
              <label htmlFor="forgot-new-password" className="field-label">New password</label>
              <input
                id="forgot-new-password"
                className="siara-input"
                type="password"
                autoComplete="new-password"
                placeholder="At least 8 characters"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
              />

              <label htmlFor="forgot-confirm-password" className="field-label">Confirm password</label>
              <input
                id="forgot-confirm-password"
                className="siara-input"
                type="password"
                autoComplete="new-password"
                placeholder="Confirm your password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
              />

              <button type="submit" className="siara-cta" disabled={loading}>
                {loading ? 'Saving password...' : 'Reset password'}
              </button>
            </form>
          ) : null}

          <div className="siara-auth-inline-actions">
            <Link to="/login" className="link-accent">Back to login</Link>
          </div>
        </div>
      </div>
    </div>
  )
}

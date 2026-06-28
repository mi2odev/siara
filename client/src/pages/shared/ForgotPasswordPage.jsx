import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import MailOutlineRoundedIcon from '@mui/icons-material/MailOutlineRounded'
import LockOutlinedIcon from '@mui/icons-material/LockOutlined'
import CheckRoundedIcon from '@mui/icons-material/CheckRounded'

import {
  requestPasswordReset,
  resetPassword,
  verifyPasswordResetCode,
} from '../../services/authService'
import LanguageSelect from '../../components/layout/LanguageSelect'
import logo from '../../assets/logos/siara-logo.png'
import '../../styles/LoginPage.css'
import '../../styles/AuthFlowPage.css'

function getErrorMessage(error) {
  return error.response?.data?.message || error.message || null
}

export default function ForgotPasswordPage() {
  const navigate = useNavigate()
  const { t } = useTranslation(['auth', 'common'])

  const RESET_STEPS = [
    { key: 'request', label: t('forgotPasswordPage.steps.request') },
    { key: 'verify', label: t('forgotPasswordPage.steps.verify') },
    { key: 'reset', label: t('forgotPasswordPage.steps.newPassword') },
  ]

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
      setError(t('forgotPasswordPage.errors.emailRequired'))
      return
    }

    setLoading(true)

    try {
      const response = await requestPasswordReset(email.trim().toLowerCase())
      setNotice(response.message || t('forgotPasswordPage.notices.codeSent'))
      setStep('verify')
    } catch (requestError) {
      setError(getErrorMessage(requestError) || t('forgotPasswordPage.errors.requestFailed'))
    } finally {
      setLoading(false)
    }
  }

  async function handleVerifyCode(event) {
    event.preventDefault()
    setError('')
    setNotice('')

    if (!code.trim()) {
      setError(t('forgotPasswordPage.errors.codeRequired'))
      return
    }

    setLoading(true)

    try {
      const response = await verifyPasswordResetCode({
        email: email.trim().toLowerCase(),
        code: code.trim(),
      })

      setResetToken(response.resetToken || '')
      setNotice(t('forgotPasswordPage.notices.codeVerified'))
      setStep('reset')
    } catch (verifyError) {
      setError(getErrorMessage(verifyError) || t('forgotPasswordPage.errors.requestFailed'))
    } finally {
      setLoading(false)
    }
  }

  async function handleResetPassword(event) {
    event.preventDefault()
    setError('')
    setNotice('')

    if (!newPassword || !confirmPassword) {
      setError(t('forgotPasswordPage.errors.passwordRequired'))
      return
    }

    if (newPassword.length < 8) {
      setError(t('forgotPasswordPage.errors.passwordTooShort'))
      return
    }

    if (newPassword !== confirmPassword) {
      setError(t('forgotPasswordPage.errors.passwordMismatch'))
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
          message: t('forgotPasswordPage.notices.passwordUpdated'),
        },
      })
    } catch (resetError) {
      setError(getErrorMessage(resetError) || t('forgotPasswordPage.errors.requestFailed'))
    } finally {
      setLoading(false)
    }
  }

  const activeStepIndex = RESET_STEPS.findIndex((item) => item.key === step)

  return (
    <div className="siara-login-root siara-auth-flow-page">
      <LanguageSelect floating size="compact" />
      <div className="siara-auth-flow-shell">
        <div className="siara-auth-flow-card">
          <div className="siara-brand">
            <img src={logo} alt={t('forgotPasswordPage.logoAlt')} />
            <div>
              <div className="brand-name">SIARA</div>
              <div className="tag">{t('forgotPasswordPage.tagline')}</div>
            </div>
          </div>

          <h1 className="siara-form-title">{t('forgotPasswordPage.title')}</h1>
          <p className="siara-form-sub">{t('forgotPasswordPage.subtitle')}</p>

          <ol className="siara-auth-steps" aria-label={t('forgotPasswordPage.stepsAriaLabel')}>
            {RESET_STEPS.map((item, index) => {
              const state = index < activeStepIndex ? 'is-done' : index === activeStepIndex ? 'is-active' : ''
              return (
                <li key={item.key} className={`siara-auth-step ${state}`} aria-current={index === activeStepIndex ? 'step' : undefined}>
                  <span className="siara-auth-step-dot">
                    {index < activeStepIndex ? <CheckRoundedIcon fontSize="inherit" /> : index + 1}
                  </span>
                  <span className="siara-auth-step-label">{item.label}</span>
                </li>
              )
            })}
          </ol>

          {notice ? <div className="siara-notice-box">{notice}</div> : null}
          {error ? <div className="error-box" role="alert">{error}</div> : null}

          {step === 'request' ? (
            <form className="siara-auth-flow-form" onSubmit={handleRequestCode}>
              <label htmlFor="forgot-email" className="field-label">{t('forgotPasswordPage.fields.email')}</label>
              <div className="input-shell">
                <span className="input-icon"><MailOutlineRoundedIcon fontSize="inherit" /></span>
                <input
                  id="forgot-email"
                  className="siara-input"
                  type="email"
                  autoComplete="email"
                  placeholder={t('forgotPasswordPage.placeholders.email')}
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </div>

              <button type="submit" className="siara-cta" disabled={loading}>
                {loading ? t('forgotPasswordPage.buttons.sendingCode') : t('forgotPasswordPage.buttons.sendCode')}
              </button>
            </form>
          ) : null}

          {step === 'verify' ? (
            <form className="siara-auth-flow-form" onSubmit={handleVerifyCode}>
              <label htmlFor="forgot-email-verify" className="field-label">{t('forgotPasswordPage.fields.email')}</label>
              <div className="input-shell">
                <span className="input-icon"><MailOutlineRoundedIcon fontSize="inherit" /></span>
                <input
                  id="forgot-email-verify"
                  className="siara-input"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </div>

              <label htmlFor="forgot-code" className="field-label">{t('forgotPasswordPage.fields.resetCode')}</label>
              <input
                id="forgot-code"
                className="siara-input siara-code-input"
                inputMode="numeric"
                maxLength={6}
                placeholder={t('forgotPasswordPage.placeholders.resetCode')}
                value={code}
                onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
              />
              <p className="siara-field-hint">{t('forgotPasswordPage.hints.resetCode')}</p>

              <button type="submit" className="siara-cta" disabled={loading}>
                {loading ? t('forgotPasswordPage.buttons.verifyingCode') : t('forgotPasswordPage.buttons.verifyCode')}
              </button>

              <button type="button" className="siara-text-button" onClick={() => setStep('request')}>
                {t('forgotPasswordPage.buttons.sendNewCode')}
              </button>
            </form>
          ) : null}

          {step === 'reset' ? (
            <form className="siara-auth-flow-form" onSubmit={handleResetPassword}>
              <label htmlFor="forgot-new-password" className="field-label">{t('forgotPasswordPage.fields.newPassword')}</label>
              <div className="input-shell">
                <span className="input-icon"><LockOutlinedIcon fontSize="inherit" /></span>
                <input
                  id="forgot-new-password"
                  className="siara-input"
                  type="password"
                  autoComplete="new-password"
                  placeholder={t('forgotPasswordPage.placeholders.newPassword')}
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                />
              </div>

              <label htmlFor="forgot-confirm-password" className="field-label">{t('forgotPasswordPage.fields.confirmPassword')}</label>
              <div className="input-shell">
                <span className="input-icon"><LockOutlinedIcon fontSize="inherit" /></span>
                <input
                  id="forgot-confirm-password"
                  className="siara-input"
                  type="password"
                  autoComplete="new-password"
                  placeholder={t('forgotPasswordPage.placeholders.confirmPassword')}
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                />
              </div>

              <button type="submit" className="siara-cta" disabled={loading}>
                {loading ? t('forgotPasswordPage.buttons.savingPassword') : t('forgotPasswordPage.buttons.resetPassword')}
              </button>
            </form>
          ) : null}

          <div className="siara-auth-inline-actions">
            <Link to="/login" className="link-accent">{t('forgotPasswordPage.backToLogin')}</Link>
          </div>
        </div>
      </div>
    </div>
  )
}

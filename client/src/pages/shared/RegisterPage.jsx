import React, { useContext, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

import GoogleAuthButton from '../../components/auth/GoogleAuthButton'
import LanguageSelect from '../../components/layout/LanguageSelect'
import { AuthContext } from '../../contexts/AuthContext'
import { getAuthenticatedRedirect } from '../../routes/routeAccess'
import logo from '../../assets/logos/siara-logo.png'
import i18n from '../../i18n'
import '../../styles/LoginPage.css'
import '../../styles/RegisterPage.css'

function getErrorMessage(error) {
  return error.response?.data?.message || error.message || i18n.t('auth:registerPage.errors.unableToCreate')
}

export default function RegisterPage() {
  const navigate = useNavigate()
  const { register, loginWithGoogle } = useContext(AuthContext)
  const { t } = useTranslation(['auth', 'common'])

  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [rememberMe, setRememberMe] = useState(true)
  const [agree, setAgree] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [googleError, setGoogleError] = useState('')

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')

    if (!fullName.trim() || !email.trim() || !password || !confirmPassword) {
      setError(t('registerPage.errors.fieldsRequired'))
      return
    }

    if (password.length < 8) {
      setError(t('registerPage.errors.passwordTooShort'))
      return
    }

    if (password !== confirmPassword) {
      setError(t('registerPage.errors.passwordsMismatch'))
      return
    }

    if (!agree) {
      setError(t('registerPage.errors.mustAgreeTerms'))
      return
    }

    setLoading(true)

    try {
      const response = await register({
        fullName: fullName.trim(),
        email: email.trim().toLowerCase(),
        password,
        rememberMe,
      })

      const params = new URLSearchParams({
        email: response.email || email.trim().toLowerCase(),
        rememberMe: rememberMe ? '1' : '0',
      })

      navigate(`/verify-email?${params.toString()}`, {
        replace: true,
        state: {
          notice: response.emailSent === false
            ? t('registerPage.notices.emailNotDelivered')
            : t('registerPage.notices.verificationSent'),
        },
      })
    } catch (authError) {
      setError(getErrorMessage(authError))
    } finally {
      setLoading(false)
    }
  }

  async function handleGoogleSignup(idToken) {
    setGoogleError('')
    setLoading(true)

    try {
      const user = await loginWithGoogle(idToken, rememberMe)
      console.info('[google-auth] Backend Google login succeeded on /register')
      navigate(getAuthenticatedRedirect(user, Boolean(user?.email_verified ?? true)), { replace: true })
    } catch (authError) {
      console.error('[google-auth] Backend Google login failed on /register', authError)
      setGoogleError(getErrorMessage(authError))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="siara-login-root">
      <LanguageSelect floating size="compact" />
      <div className="siara-login-grid">
        <aside className="siara-hero">
          <img src={logo} alt="SIARA" className="logo" />
          <div className="siara-hero-main">
            <div className="hero-kicker">{t('registerPage.hero.kicker')}</div>
            <div className="siara-hero-illustration">
              <div className="hero-orbits">
                <span />
                <span />
                <span />
              </div>
            </div>
            <h2 className="title">{t('registerPage.hero.title')}</h2>
            <p className="subtitle">
              {t('registerPage.hero.subtitle')}
            </p>
            <div className="hero-badges">
              <span className="hero-badge">{t('registerPage.hero.badges.emailOtp')}</span>
              <span className="hero-badge">{t('registerPage.hero.badges.googleLogin')}</span>
              <span className="hero-badge">{t('registerPage.hero.badges.secureSessions')}</span>
            </div>
          </div>
        </aside>

        <main className="siara-form-column">
          <div className="siara-form-wrap" role="region" aria-labelledby="registerTitle">
            <div className="siara-brand">
              <img src={logo} alt="SIARA logo" />
              <div>
                <div className="brand-name">SIARA</div>
                <div className="tag">{t('registerPage.brand.tagline')}</div>
              </div>
            </div>

            <h1 id="registerTitle" className="siara-form-title">{t('registerPage.form.title')}</h1>
            <p className="siara-form-sub">{t('registerPage.form.subtitle')}</p>
            <div className="siara-form-helper">{t('registerPage.form.helper')}</div>

            {error ? <div className="error-box" role="alert">{error}</div> : null}

            <form className="register-form" onSubmit={handleSubmit}>
              <label htmlFor="register-name" className="field-label">{t('registerPage.form.fullNameLabel')}</label>
              <div className="input-shell">
                <span className="input-icon" aria-hidden="true">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="1.6" />
                    <path d="M4 20c0-4 4-6 8-6s8 2 8 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                  </svg>
                </span>
                <input
                  id="register-name"
                  className="siara-input"
                  placeholder={t('registerPage.form.fullNamePlaceholder')}
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                />
              </div>

              <label htmlFor="register-email" className="field-label">{t('registerPage.form.emailLabel')}</label>
              <div className="input-shell">
                <span className="input-icon" aria-hidden="true">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="1.6" />
                    <path d="M4 7L12 12L20 7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                  </svg>
                </span>
                <input
                  id="register-email"
                  className="siara-input"
                  type="email"
                  autoComplete="email"
                  placeholder={t('registerPage.form.emailPlaceholder')}
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </div>

              <label htmlFor="register-password" className="field-label">{t('registerPage.form.passwordLabel')}</label>
              <div className="input-shell">
                <span className="input-icon" aria-hidden="true">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <rect x="6" y="8" width="12" height="10" rx="2" stroke="currentColor" strokeWidth="1.6" />
                    <path d="M9 8V6.5C9 5.12 10.12 4 11.5 4H12.5C13.88 4 15 5.12 15 6.5V8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                  </svg>
                </span>
                <input
                  id="register-password"
                  className="siara-input has-eye-toggle"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  placeholder={t('registerPage.form.passwordPlaceholder')}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
                <button
                  type="button"
                  className={`eye-toggle ${showPassword ? 'eye-open' : 'eye-closed'}`}
                  onClick={() => setShowPassword((current) => !current)}
                  aria-label={showPassword ? t('registerPage.form.hidePassword') : t('registerPage.form.showPassword')}
                >
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path
                      className="eye-outline"
                      d="M2.4 12C4.3 8.6 7.8 6.5 12 6.5C16.2 6.5 19.7 8.6 21.6 12C19.7 15.4 16.2 17.5 12 17.5C7.8 17.5 4.3 15.4 2.4 12Z"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <circle className="eye-pupil" cx="12" cy="12" r="2.25" fill="currentColor" />
                    <path
                      className="eye-slash"
                      d="M4.2 4.2L19.8 19.8"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                    />
                  </svg>
                </button>
              </div>

              <label htmlFor="register-confirm" className="field-label">{t('registerPage.form.confirmPasswordLabel')}</label>
              <div className="input-shell">
                <span className="input-icon" aria-hidden="true">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <rect x="6" y="8" width="12" height="10" rx="2" stroke="currentColor" strokeWidth="1.6" />
                    <path d="M9 8V6.5C9 5.12 10.12 4 11.5 4H12.5C13.88 4 15 5.12 15 6.5V8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                  </svg>
                </span>
                <input
                  id="register-confirm"
                  className="siara-input has-eye-toggle"
                  type={showConfirmPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  placeholder={t('registerPage.form.confirmPasswordPlaceholder')}
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                />
                <button
                  type="button"
                  className={`eye-toggle ${showConfirmPassword ? 'eye-open' : 'eye-closed'}`}
                  onClick={() => setShowConfirmPassword((current) => !current)}
                  aria-label={showConfirmPassword ? t('registerPage.form.hidePasswordConfirm') : t('registerPage.form.showPasswordConfirm')}
                >
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path
                      className="eye-outline"
                      d="M2.4 12C4.3 8.6 7.8 6.5 12 6.5C16.2 6.5 19.7 8.6 21.6 12C19.7 15.4 16.2 17.5 12 17.5C7.8 17.5 4.3 15.4 2.4 12Z"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <circle className="eye-pupil" cx="12" cy="12" r="2.25" fill="currentColor" />
                    <path
                      className="eye-slash"
                      d="M4.2 4.2L19.8 19.8"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                    />
                  </svg>
                </button>
              </div>

              <label className="agree">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(event) => setRememberMe(event.target.checked)}
                />
                <span>{t('registerPage.form.rememberMe')}</span>
              </label>

              <label className="agree">
                <input
                  type="checkbox"
                  checked={agree}
                  onChange={(event) => setAgree(event.target.checked)}
                />
                <span>{t('registerPage.form.agreeTerms')}</span>
              </label>

              <button className="siara-cta" type="submit" disabled={loading}>
                {loading ? t('registerPage.form.creatingAccount') : t('registerPage.form.createAccount')}
              </button>
            </form>

            <div className="siara-auth-divider">
              <span>{t('registerPage.form.orContinueWith')}</span>
            </div>

            {googleError ? <div className="error-box" role="alert">{googleError}</div> : null}
            <GoogleAuthButton
              disabled={loading}
              onCredential={handleGoogleSignup}
              onError={(googleAuthError) => {
                console.error('[google-auth] Register page Google button error', googleAuthError)
                setGoogleError(googleAuthError.message)
              }}
            />

            <div className="register-footer">
              {t('registerPage.form.alreadyRegistered')} <Link to="/login" className="link-accent">{t('registerPage.form.logIn')}</Link>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}

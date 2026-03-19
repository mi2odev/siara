import React, { useContext, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'

import GoogleAuthButton from '../../components/auth/GoogleAuthButton'
import { AuthContext } from '../../contexts/AuthContext'
import { getAuthenticatedRedirect } from '../../routes/routeAccess'
import logo from '../../assets/logos/siara-logo.png'
import '../../styles/LoginPage.css'

function getErrorMessage(error) {
  const apiMessage = String(error?.response?.data?.message || '').toLowerCase()

  if (
    error?.response?.status === 401
    || apiMessage.includes('invalid email or password')
    || apiMessage.includes('invalid credentials')
  ) {
    return 'Wrong password.'
  }

  return error.response?.data?.message || error.message || 'Unable to sign in right now.'
}

export default function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { login, loginWithGoogle } = useContext(AuthContext)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [rememberMe, setRememberMe] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [googleError, setGoogleError] = useState('')

  const notice = useMemo(() => {
    if (typeof location.state?.message === 'string' && location.state.message.trim()) {
      return location.state.message.trim()
    }

    return ''
  }, [location.state])

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')

    if (!email.trim() || !password) {
      setError('Email and password are required.')
      return
    }

    setLoading(true)

    try {
      const user = await login(email.trim(), password, rememberMe)
      navigate(getAuthenticatedRedirect(user, Boolean(user?.email_verified ?? true)), { replace: true })
    } catch (authError) {
      const requiresEmailVerification = authError.response?.data?.requiresEmailVerification
      if (requiresEmailVerification) {
        const params = new URLSearchParams({
          email: authError.response?.data?.email || email.trim().toLowerCase(),
          rememberMe: rememberMe ? '1' : '0',
        })

        navigate(`/verify-email?${params.toString()}`, {
          replace: true,
          state: {
            notice: 'Your email needs to be verified before you can continue.',
          },
        })
        return
      }

      setError(getErrorMessage(authError))
    } finally {
      setLoading(false)
    }
  }

  async function handleGoogleLogin(idToken) {
    setGoogleError('')
    setLoading(true)

    try {
      const user = await loginWithGoogle(idToken, rememberMe)
      console.info('[google-auth] Backend Google login succeeded on /login')
      navigate(getAuthenticatedRedirect(user, Boolean(user?.email_verified ?? true)), { replace: true })
    } catch (authError) {
      console.error('[google-auth] Backend Google login failed on /login', authError)
      setGoogleError(getErrorMessage(authError))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="siara-login-root">
      <div className="siara-login-grid">
        <aside className="siara-hero">
          <img src={logo} alt="SIARA" className="logo" />
          <div className="siara-hero-main">
            <div className="hero-kicker">AI Platform - SIARA</div>
            <div className="siara-hero-illustration">
              <div className="hero-orbits">
                <span />
                <span />
                <span />
              </div>
            </div>
            <h2 className="title">Stay ahead of road risk across your watched zones.</h2>
            <p className="subtitle">
              Sign in to access SIARA alerts, maps, predictions, and the notification center built around your safety rules.
            </p>
            <div className="hero-badges">
              <span className="hero-badge">Verified alerts</span>
              <span className="hero-badge">Smart zones</span>
              <span className="hero-badge">Weekly summaries</span>
            </div>
          </div>
        </aside>

        <main className="siara-form-column">
          <div className="siara-form-wrap" role="region" aria-labelledby="loginTitle">
            <div className="siara-brand">
              <img src={logo} alt="SIARA logo" />
              <div>
                <div className="brand-name">SIARA</div>
                <div className="tag">Road Risk Prediction Platform</div>
              </div>
            </div>

            <h1 id="loginTitle" className="siara-form-title">Welcome back</h1>
            <p className="siara-form-sub">Use your verified email to get back to your dashboard.</p>
            <div className="siara-form-helper">Secure session cookies keep you signed in when you choose Remember me.</div>

            {notice ? <div className="siara-notice-box">{notice}</div> : null}
            {error ? <div className="error-box" role="alert">{error}</div> : null}

            <form onSubmit={handleSubmit}>
              <label htmlFor="login-email" className="field-label">Email</label>
              <div className="input-shell">
                <span className="input-icon" aria-hidden="true">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="1.6" />
                    <path d="M4 7L12 12L20 7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                  </svg>
                </span>
                <input
                  id="login-email"
                  className="siara-input"
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </div>

              <label htmlFor="login-password" className="field-label">Password</label>
              <div className="input-shell">
                <span className="input-icon" aria-hidden="true">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <rect x="6" y="8" width="12" height="10" rx="2" stroke="currentColor" strokeWidth="1.6" />
                    <path d="M9 8V6.5C9 5.12 10.12 4 11.5 4H12.5C13.88 4 15 5.12 15 6.5V8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                  </svg>
                </span>
                <input
                  id="login-password"
                  className="siara-input has-eye-toggle"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="Password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
                <button
                  type="button"
                  className={`eye-toggle ${showPassword ? 'eye-open' : 'eye-closed'}`}
                  onClick={() => setShowPassword((current) => !current)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
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

              <div className="siara-row" style={{ marginTop: 12 }}>
                <label className="siara-remember">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(event) => setRememberMe(event.target.checked)}
                  />
                  {' '}
                  Remember me for 30 days
                </label>
                <div style={{ flex: 1 }} />
                <Link to="/forgot-password" className="link-accent">Forgot password?</Link>
              </div>

              <button type="submit" className="siara-cta" disabled={loading}>
                {loading ? 'Signing in...' : 'Log In'}
              </button>
            </form>

            <div className="siara-auth-divider">
              <span>or continue with</span>
            </div>

            {googleError ? <div className="error-box" role="alert">{googleError}</div> : null}
            <GoogleAuthButton
              disabled={loading}
              onCredential={handleGoogleLogin}
              onError={(googleAuthError) => {
                console.error('[google-auth] Login page Google button error', googleAuthError)
                setGoogleError(googleAuthError.message)
              }}
            />

            <div className="siara-footer-links">
              <Link to="/about">About SIARA</Link>
              <Link to="/register" className="link-accent">Create account</Link>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}

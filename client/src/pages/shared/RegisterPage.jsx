import React, { useContext, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import GoogleAuthButton from '../../components/auth/GoogleAuthButton'
import { AuthContext } from '../../contexts/AuthContext'
import { getAuthenticatedRedirect } from '../../routes/routeAccess'
import logo from '../../assets/logos/siara-logo.png'
import '../../styles/LoginPage.css'
import '../../styles/RegisterPage.css'

function getErrorMessage(error) {
  return error.response?.data?.message || error.message || 'Unable to create your account right now.'
}

export default function RegisterPage() {
  const navigate = useNavigate()
  const { register, loginWithGoogle } = useContext(AuthContext)

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
      setError('Full name, email, and password are required.')
      return
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters long.')
      return
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    if (!agree) {
      setError('Please accept the terms before creating your account.')
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
            ? 'Your account was created, but the verification email could not be delivered yet. You can resend the code from this page.'
            : 'We sent a 6-digit verification code to your email.',
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
            <h2 className="title">Create a verified SIARA account.</h2>
            <p className="subtitle">
              Set up your safety workspace, link your alert zones, and receive weekly summaries for the places you watch most closely.
            </p>
            <div className="hero-badges">
              <span className="hero-badge">Email OTP verification</span>
              <span className="hero-badge">Google login</span>
              <span className="hero-badge">Secure sessions</span>
            </div>
          </div>
        </aside>

        <main className="siara-form-column">
          <div className="siara-form-wrap" role="region" aria-labelledby="registerTitle">
            <div className="siara-brand">
              <img src={logo} alt="SIARA logo" />
              <div>
                <div className="brand-name">SIARA</div>
                <div className="tag">Road Risk Prediction Platform</div>
              </div>
            </div>

            <h1 id="registerTitle" className="siara-form-title">Create your account</h1>
            <p className="siara-form-sub">Verification keeps your alerts, weekly emails, and recovery flows tied to the right inbox.</p>
            <div className="siara-form-helper">Use Remember me if you want a longer-lived session after verification.</div>

            {error ? <div className="error-box" role="alert">{error}</div> : null}

            <form className="register-form" onSubmit={handleSubmit}>
              <label htmlFor="register-name" className="field-label">Full name</label>
              <div className="input-shell">
                <span className="input-icon" aria-hidden="true">A</span>
                <input
                  id="register-name"
                  className="siara-input"
                  placeholder="First Last"
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                />
              </div>

              <label htmlFor="register-email" className="field-label">Email</label>
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
                  placeholder="you@example.com"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </div>

              <label htmlFor="register-password" className="field-label">Password</label>
              <div className="input-shell">
                <span className="input-icon" aria-hidden="true">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <rect x="6" y="8" width="12" height="10" rx="2" stroke="currentColor" strokeWidth="1.6" />
                    <path d="M9 8V6.5C9 5.12 10.12 4 11.5 4H12.5C13.88 4 15 5.12 15 6.5V8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                  </svg>
                </span>
                <input
                  id="register-password"
                  className="siara-input"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  placeholder="At least 8 characters"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
                <button
                  type="button"
                  className={`eye-toggle ${showPassword ? 'eye-open' : 'eye-closed'}`}
                  onClick={() => setShowPassword((current) => !current)}
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>

              <label htmlFor="register-confirm" className="field-label">Confirm password</label>
              <div className="input-shell">
                <span className="input-icon" aria-hidden="true">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <rect x="6" y="8" width="12" height="10" rx="2" stroke="currentColor" strokeWidth="1.6" />
                    <path d="M9 8V6.5C9 5.12 10.12 4 11.5 4H12.5C13.88 4 15 5.12 15 6.5V8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                  </svg>
                </span>
                <input
                  id="register-confirm"
                  className="siara-input"
                  type={showConfirmPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  placeholder="Confirm password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                />
                <button
                  type="button"
                  className={`eye-toggle ${showConfirmPassword ? 'eye-open' : 'eye-closed'}`}
                  onClick={() => setShowConfirmPassword((current) => !current)}
                >
                  {showConfirmPassword ? 'Hide' : 'Show'}
                </button>
              </div>

              <label className="agree">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(event) => setRememberMe(event.target.checked)}
                />
                <span>Keep me signed in for around 30 days after verification.</span>
              </label>

              <label className="agree">
                <input
                  type="checkbox"
                  checked={agree}
                  onChange={(event) => setAgree(event.target.checked)}
                />
                <span>I agree to SIARA&apos;s terms of use and responsible reporting guidelines.</span>
              </label>

              <button className="siara-cta" type="submit" disabled={loading}>
                {loading ? 'Creating account...' : 'Create account'}
              </button>
            </form>

            <div className="siara-auth-divider">
              <span>or continue with</span>
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
              Already registered? <Link to="/login" className="link-accent">Log in</Link>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}

import React, { useRef, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { publicRequest } from '../../requestMethodes'
import '../../styles/LoginPage.css'
import '../../styles/RegisterPage.css'
import logo from '../../assets/logos/siara-logo.png'

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PHONE_REGEX = /^\+?[0-9\s().-]{8,20}$/
const REGISTER_ENDPOINT = '/auth/register'
const IS_DEVELOPMENT = import.meta.env.DEV



// FULL NAME SPLIT (first , last)
const parseFullName = (fullName) => {
  const parts = fullName.trim().split(/\s+/).filter(Boolean)

  if (parts.length === 0) {
    return { first_name: '', last_name: '' }
  }

  if (parts.length === 1) {
    return { first_name: parts[0], last_name: parts[0] }
  }

  return {
    first_name: parts[0],
    last_name: parts.slice(1).join(' '),
  }
}

const getIdentifierType = (identifier) => {
  if (EMAIL_REGEX.test(identifier)) {
    return 'email'
  }

  if (PHONE_REGEX.test(identifier)) {
    return 'phone'
  }

  return null
}

const RegisterPage = () => {
  const [name, setName] = useState('')
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [agree, setAgree] = useState(false)
  const [errors, setErrors] = useState({})
  const [loading, setLoading] = useState(false)
  const alertRef = useRef(null)

  const navigate = useNavigate()

  const validate = () => {
    const nextErrors = {}
    const trimmedName = name.trim()
    const trimmedIdentifier = identifier.trim()
    const identifierType = getIdentifierType(trimmedIdentifier)

    if (!trimmedName) {
      nextErrors.name = 'Full name is required.'
    }

    if (!trimmedIdentifier) {
      nextErrors.identifier = 'Email or phone number is required.'
    } else if (!identifierType) {
      nextErrors.identifier = 'Please enter a valid email address or phone number.'
    }

    if (!password) {
      nextErrors.password = 'Password is required.'
    } else if (password.length < 8) {
      nextErrors.password = 'Password must be at least 8 characters.'
    }

    if (!confirm) {
      nextErrors.confirm = 'Please confirm your password.'
    } else if (password !== confirm) {
      nextErrors.confirm = 'Passwords do not match.'
    }

    if (!agree) {
      nextErrors.agree = 'You must accept the terms of use.'
    }

    return nextErrors
  }


  // SUB<IT FUNCTION
  const handleSubmit = async (event) => {
    event.preventDefault()
    setErrors({})

    const validationErrors = validate()
    if (Object.keys(validationErrors).length > 0) {
      if (IS_DEVELOPMENT) {
        console.debug('[register] validation failed', validationErrors)
      }

      setErrors(validationErrors)
      setTimeout(() => {
        const invalidField = document.querySelector('[aria-invalid="true"]')
        if (invalidField) {
          invalidField.focus()
        }
      }, 50)
      return
    }

    const trimmedName = name.trim()
    const trimmedIdentifier = identifier.trim()
    const identifierType = getIdentifierType(trimmedIdentifier)
    const { first_name, last_name } = parseFullName(trimmedName)

    const payload = {
      first_name,
      last_name,
      email: identifierType === 'email' ? trimmedIdentifier.toLowerCase() : null,
      phone: identifierType === 'phone' ? trimmedIdentifier : null,
      password,
      avatar_url: null,
    }

    setLoading(true)

    try {
      if (IS_DEVELOPMENT) {
        console.debug('[register] sending request', {
          url: `${publicRequest.defaults.baseURL}${REGISTER_ENDPOINT}`,
          payload: {
            ...payload,
            password: '[REDACTED]',
          },
        })
      }

      const response = await publicRequest.post(REGISTER_ENDPOINT, payload)

      if (IS_DEVELOPMENT) {
        console.debug('[register] success', {
          status: response.status,
          userId: response.data?.user?.id || null,
        })
      }

      navigate('/login')
    } catch (error) {
      if (IS_DEVELOPMENT) {
        console.error('[register] request failed', {
          message: error.message,
          status: error.response?.status,
          data: error.response?.data,
        })
      }

      const message =
        error.response?.data?.message ||
        error.response?.data?.error ||
        error.message ||
        'Error during registration.'

      setErrors({ form: message })
      setTimeout(() => {
        if (alertRef.current) {
          alertRef.current.focus()
        }
      }, 50)
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
            <h2 className="title">SIARA - Road Accident Risk Visualizer</h2>
            <p className="subtitle">
              Frontend prototype to visualize and anticipate road accident risks in Algeria using AI and data.
            </p>
            <div className="hero-badges">
              <span className="hero-badge">Interactive Heatmaps</span>
              <span className="hero-badge">Predictive AI</span>
              <span className="hero-badge">Road Safety</span>
            </div>
          </div>
        </aside>

        <main className="siara-form-column">
          <div className="siara-form-wrap" role="region" aria-labelledby="registerTitle">
            <div className="siara-brand">
              <img src={logo} alt="SIARA logo" />
              <div>
                <div className="brand-name">SIARA</div>
                <div className="tag">Road Risk Prediction - Prototype</div>
              </div>
            </div>

            <h2 id="registerTitle" className="siara-form-title">Create an Account</h2>
            <div className="siara-form-sub">Sign up to access the dashboard and risk maps.</div>
            <div className="siara-form-helper">Access restricted to authorized SIARA users.</div>

            <form className="register-form" onSubmit={handleSubmit}>
              {errors.form && (
                <div ref={alertRef} className="form-error" role="alert" tabIndex={-1}>
                  {errors.form}
                </div>
              )}

              <label htmlFor="fullName" className="field-label">Full Name</label>
              <div className="input-shell">
                <span className="input-icon" aria-hidden="true">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="12" cy="8" r="3.2" stroke="currentColor" strokeWidth="1.6" />
                    <path d="M5 19C5.8 16.2 8.6 14.4 12 14.4C15.4 14.4 18.2 16.2 19 19" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                  </svg>
                </span>
                <input
                  id="fullName"
                  className="siara-input"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="First Last"
                  aria-invalid={errors.name ? 'true' : 'false'}
                />
              </div>
              {errors.name && <div className="field-error">{errors.name}</div>}

              <label htmlFor="identifier" className="field-label">Email or Phone</label>
              <div className="input-shell">
                <span className="input-icon" aria-hidden="true">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <rect x="3" y="5" width="18" height="14" rx="2" ry="2" stroke="currentColor" strokeWidth="1.6" />
                    <path d="M4 7L12 12L20 7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
                <input
                  id="identifier"
                  className="siara-input"
                  value={identifier}
                  onChange={(event) => setIdentifier(event.target.value)}
                  placeholder="email@example.com or +213..."
                  aria-invalid={errors.identifier ? 'true' : 'false'}
                />
              </div>
              {errors.identifier && <div className="field-error">{errors.identifier}</div>}

              <label htmlFor="password" className="field-label">Password</label>
              <div className="input-shell">
                <span className="input-icon" aria-hidden="true">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <rect x="6" y="8" width="12" height="10" rx="2" ry="2" stroke="currentColor" strokeWidth="1.6" />
                    <path d="M9 8V6.5C9 5.12 10.12 4 11.5 4H12.5C13.88 4 15 5.12 15 6.5V8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                  </svg>
                </span>
                <input
                  id="password"
                  className="siara-input"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Password"
                  aria-invalid={errors.password ? 'true' : 'false'}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((current) => !current)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className={`eye-toggle ${showPassword ? 'eye-open' : 'eye-closed'}`}
                >
                  {showPassword ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M3 3L21 21" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                      <path d="M9.88 9.88C9.34 10.42 9 11.16 9 12C9 13.66 10.34 15 12 15C12.84 15 13.58 14.66 14.12 14.12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                      <path d="M7.11 7.11C8.31 6.41 9.61 6 12 6C16.5 6 19.5 9 21 12C20.61 12.78 20.13 13.51 19.57 14.18" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                      <path d="M5.21 5.51C4.08 6.26 3.15 7.23 2.4 8.29C1.51 9.57 1 10.5 1 10.5C1 10.5 3.5 15 8 15C9.02 15 9.93 14.8 10.74 14.47" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                    </svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M2 12C3.5 9 6.5 6 11 6C15.5 6 18.5 9 20 12C18.5 15 15.5 18 11 18C6.5 18 3.5 15 2 12Z" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                      <circle cx="11" cy="12" r="3" stroke="currentColor" strokeWidth="1.6" />
                    </svg>
                  )}
                </button>
              </div>
              {errors.password && <div className="field-error">{errors.password}</div>}

              <label htmlFor="confirmPassword" className="field-label">Confirm Password</label>
              <div className="input-shell">
                <span className="input-icon" aria-hidden="true">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <rect x="6" y="8" width="12" height="10" rx="2" ry="2" stroke="currentColor" strokeWidth="1.6" />
                    <path d="M9 8V6.5C9 5.12 10.12 4 11.5 4H12.5C13.88 4 15 5.12 15 6.5V8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                  </svg>
                </span>
                <input
                  id="confirmPassword"
                  className="siara-input"
                  type={showConfirm ? 'text' : 'password'}
                  value={confirm}
                  onChange={(event) => setConfirm(event.target.value)}
                  placeholder="Confirm Password"
                  aria-invalid={errors.confirm ? 'true' : 'false'}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm((current) => !current)}
                  aria-label={showConfirm ? 'Hide confirmation' : 'Show confirmation'}
                  className={`eye-toggle ${showConfirm ? 'eye-open' : 'eye-closed'}`}
                >
                  {showConfirm ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M3 3L21 21" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                      <path d="M9.88 9.88C9.34 10.42 9 11.16 9 12C9 13.66 10.34 15 12 15C12.84 15 13.58 14.66 14.12 14.12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                      <path d="M7.11 7.11C8.31 6.41 9.61 6 12 6C16.5 6 19.5 9 21 12C20.61 12.78 20.13 13.51 19.57 14.18" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                      <path d="M5.21 5.51C4.08 6.26 3.15 7.23 2.4 8.29C1.51 9.57 1 10.5 1 10.5C1 10.5 3.5 15 8 15C9.02 15 9.93 14.8 10.74 14.47" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                    </svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M2 12C3.5 9 6.5 6 11 6C15.5 6 18.5 9 20 12C18.5 15 15.5 18 11 18C6.5 18 3.5 15 2 12Z" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                      <circle cx="11" cy="12" r="3" stroke="currentColor" strokeWidth="1.6" />
                    </svg>
                  )}
                </button>
              </div>
              {errors.confirm && <div className="field-error">{errors.confirm}</div>}

              <label className="agree">
                <input type="checkbox" checked={agree} onChange={(event) => setAgree(event.target.checked)} />
                <span>
                  I accept the <a href="#" className="terms-link">terms of use</a>
                </span>
              </label>
              {errors.agree && <div className="field-error">{errors.agree}</div>}

              <button className="siara-cta" type="submit" disabled={loading}>
                {loading ? 'Creating...' : 'Sign Up'}
              </button>

              <div className="register-footer">
                Already registered? <Link to="/login" className="link-accent">Log in</Link>
              </div>
            </form>
          </div>
        </main>
      </div>
    </div>
  )
}


export default RegisterPage
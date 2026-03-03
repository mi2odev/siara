/**
 * @file RegisterPage.jsx
 * @description SIARA platform registration page.
 *
 * Two-column layout (identical to LoginPage):
 *   - Left: hero panel with logo, illustration, and badges.
 *   - Right: registration form.
 *
 * Form fields:
 *   - Full name, email/phone, password, confirmation, terms of use.
 *
 * Features:
 *   - Client-side validation of all fields.
 *   - Show / hide password and confirmation.
 *   - Registration via AuthContext.mockRegister().
 *   - Redirect to /login after successful registration.
 */
import React, { useState, useContext } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { AuthContext } from '../../contexts/AuthContext'
import '../../styles/LoginPage.css'
import '../../styles/RegisterPage.css'
import logo from '../../assets/logos/siara-logo.png'

export default function RegisterPage() {
  // --- Form state variables ---
  const [name,setName] = useState('')               // User's full name
  const [identifier,setIdentifier] = useState('')   // Email or phone number
  const [password,setPassword] = useState('')        // Chosen password
  const [confirm,setConfirm] = useState('')          // Password confirmation
  const [showPassword,setShowPassword] = useState(false)  // Toggle password visibility
  const [showConfirm,setShowConfirm] = useState(false)    // Toggle confirmation visibility
  const [agree,setAgree] = useState(false)           // Terms of use acceptance
  const [errors,setErrors] = useState({})            // Validation errors by field
  const [loading,setLoading] = useState(false)       // Loading indicator

  const navigate = useNavigate()
  const { mockRegister } = useContext(AuthContext) || {} // Registration function provided by AuthContext

  /**
   * Validates all registration form fields.
   * - Name: required.
   * - Identifier: required (email or phone).
   * - Password: required, ≥ 8 characters.
   * - Confirmation: must match password.
   * - Terms: must be accepted.
   * @returns {Object} Errors object by field (empty if all valid).
   */
  function validate(){
    const e = {}
    if(!name) e.name = "Name is required."
    if(!identifier) e.identifier = "Email or phone number is required."
    if(!password) e.password = "Password is required."
    else if(password.length<8) e.password = "Password must be at least 8 characters."
    if(password !== confirm) e.confirm = "Passwords do not match."
    if(!agree) e.agree = "You must accept the terms of use."
    return e
  }

  /**
   * Handles registration form submission.
   * 1. Validates fields, displays errors if needed.
   * 2. Calls mockRegister() via AuthContext.
   * 3. Redirects to /login after successful registration.
   */
  async function handleSubmit(e) {
    e.preventDefault()
    const eobj = validate(); setErrors(eobj)
    if(Object.keys(eobj).length) return
    setLoading(true)
    try{
      if(mockRegister){
        await mockRegister({name,identifier,password})
      }
      // Redirect to login page after successful registration
      navigate('/login')
    }catch(err){
      // Display the server error or a default message
      setErrors({form: err.message || 'Error during registration.'})
    }finally{setLoading(false)}
  }

  // =====================================================================
  // JSX RENDER
  // =====================================================================
  return (
    <div className="siara-login-root">
      <div className="siara-login-grid">
        {/* ==================== HERO PANEL (left) ==================== */}
        {/* Identical to LoginPage hero panel */}
        <aside className="siara-hero">
          <img src={logo} alt="SIARA" className="logo" />
          <div className="siara-hero-main">
            <div className="hero-kicker">AI Platform — SIARA</div>
            <div className="siara-hero-illustration">
              <div className="hero-orbits">
                <span />
                <span />
                <span />
              </div>
            </div>
            <h2 className="title">SIARA — Road Accident Risk Visualizer</h2>
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

        {/* ==================== FORM COLUMN (right) ==================== */}
        {/* Same structure as LoginPage, content specific to registration */}
        <main className="siara-form-column">
          <div className="siara-form-wrap" role="region" aria-labelledby="registerTitle">
            {/* --- Brand header --- */}
            <div className="siara-brand">
              <img src={logo} alt="SIARA logo" />
              <div>
                <div className="brand-name">SIARA</div>
                <div className="tag">Road Risk Prediction — Prototype</div>
              </div>
            </div>

            {/* --- Form title and description --- */}
            <h2 id="registerTitle" className="siara-form-title">Create an Account</h2>
            <div className="siara-form-sub">Sign up to access the dashboard and risk maps.</div>
            <div className="siara-form-helper">Access restricted to authorized SIARA users.</div>

            {/* --- Registration form --- */}
            <form className="register-form" onSubmit={handleSubmit}>
              {/* Global form error (e.g., server error) */}
              {errors.form && <div className="form-error" role="alert">{errors.form}</div>}

          {/* --- Full name field --- */}
          <label className="field-label">Full Name</label>
          <div className="input-shell">
            <span className="input-icon" aria-hidden="true">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="12" cy="8" r="3.2" stroke="currentColor" strokeWidth="1.6" />
                <path d="M5 19C5.8 16.2 8.6 14.4 12 14.4C15.4 14.4 18.2 16.2 19 19" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            </span>
            <input className="siara-input" value={name} onChange={e=>setName(e.target.value)} placeholder="First Last" />
          </div>
          {errors.name && <div className="field-error">{errors.name}</div>}

          {/* --- Email or phone number field --- */}
          <label className="field-label">Email or Phone</label>
          <div className="input-shell">
            <span className="input-icon" aria-hidden="true">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="3" y="5" width="18" height="14" rx="2" ry="2" stroke="currentColor" strokeWidth="1.6" />
                <path d="M4 7L12 12L20 7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            <input className="siara-input" value={identifier} onChange={e=>setIdentifier(e.target.value)} placeholder="email@example.com or +213..." />
          </div>
          {errors.identifier && <div className="field-error">{errors.identifier}</div>}

          {/* --- Password field with visibility toggle --- */}
          <label className="field-label">Password</label>
          <div className="input-shell">
            <span className="input-icon" aria-hidden="true">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="6" y="8" width="12" height="10" rx="2" ry="2" stroke="currentColor" strokeWidth="1.6" />
                <path d="M9 8V6.5C9 5.12 10.12 4 11.5 4H12.5C13.88 4 15 5.12 15 6.5V8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            </span>
            <input
              className="siara-input"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={e=>setPassword(e.target.value)}
              placeholder="Password"
            />
            <button
              type="button"
              onClick={()=>setShowPassword(s=>!s)}
              aria-label={showPassword? 'Hide password':'Show password'}
              className={`eye-toggle ${showPassword ? 'eye-open' : 'eye-closed'}`}
            >
              {showPassword ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M3 3L21 21" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
                  <path d="M9.88 9.88C9.34 10.42 9 11.16 9 12C9 13.66 10.34 15 12 15C12.84 15 13.58 14.66 14.12 14.12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
                  <path d="M7.11 7.11C8.31 6.41 9.61 6 12 6C16.5 6 19.5 9 21 12C20.61 12.78 20.13 13.51 19.57 14.18" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
                  <path d="M5.21 5.51C4.08 6.26 3.15 7.23 2.4 8.29C1.51 9.57 1 10.5 1 10.5C1 10.5 3.5 15 8 15C9.02 15 9.93 14.8 10.74 14.47" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
                </svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M2 12C3.5 9 6.5 6 11 6C15.5 6 18.5 9 20 12C18.5 15 15.5 18 11 18C6.5 18 3.5 15 2 12Z" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
                  <circle cx="11" cy="12" r="3" stroke="currentColor" strokeWidth="1.6"/>
                </svg>
              )}
            </button>
          </div>
          {errors.password && <div className="field-error">{errors.password}</div>}

          {/* --- Confirm password field --- */}
          <label className="field-label">Confirm Password</label>
          <div className="input-shell">
            <span className="input-icon" aria-hidden="true">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="6" y="8" width="12" height="10" rx="2" ry="2" stroke="currentColor" strokeWidth="1.6" />
                <path d="M9 8V6.5C9 5.12 10.12 4 11.5 4H12.5C13.88 4 15 5.12 15 6.5V8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            </span>
            <input
              className="siara-input"
              type={showConfirm ? 'text' : 'password'}
              value={confirm}
              onChange={e=>setConfirm(e.target.value)}
              placeholder="Confirm Password"
            />
            <button
              type="button"
              onClick={()=>setShowConfirm(s=>!s)}
              aria-label={showConfirm? 'Hide confirmation':'Show confirmation'}
              className={`eye-toggle ${showConfirm ? 'eye-open' : 'eye-closed'}`}
            >
              {showConfirm ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M3 3L21 21" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
                  <path d="M9.88 9.88C9.34 10.42 9 11.16 9 12C9 13.66 10.34 15 12 15C12.84 15 13.58 14.66 14.12 14.12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
                  <path d="M7.11 7.11C8.31 6.41 9.61 6 12 6C16.5 6 19.5 9 21 12C20.61 12.78 20.13 13.51 19.57 14.18" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
                  <path d="M5.21 5.51C4.08 6.26 3.15 7.23 2.4 8.29C1.51 9.57 1 10.5 1 10.5C1 10.5 3.5 15 8 15C9.02 15 9.93 14.8 10.74 14.47" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
                </svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M2 12C3.5 9 6.5 6 11 6C15.5 6 18.5 9 20 12C18.5 15 15.5 18 11 18C6.5 18 3.5 15 2 12Z" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
                  <circle cx="11" cy="12" r="3" stroke="currentColor" strokeWidth="1.6"/>
                </svg>
              )}
            </button>
          </div>
          {errors.confirm && <div className="field-error">{errors.confirm}</div>}

          {/* --- Checkbox: terms of use acceptance --- */}
          <label className="agree">
            <input type="checkbox" checked={agree} onChange={e=>setAgree(e.target.checked)} />
            <span>
              I accept the <a href="#" className="terms-link">terms of use</a>
            </span>
          </label>
          {errors.agree && <div className="field-error">{errors.agree}</div>}

          {/* Main submit button */}
          <button className="siara-cta" type="submit" disabled={loading}>{loading ? 'Creating...' : "Sign Up"}</button>

          {/* Link to login page for already registered users */}
          <div className="register-footer">Already registered? <Link to="/login" className="link-accent">Log in</Link></div>
        </form>
          </div>
        </main>
      </div>
    </div>
  )
}

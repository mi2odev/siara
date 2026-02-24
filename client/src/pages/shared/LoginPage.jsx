import React, { useState, useRef, useContext } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { AuthContext } from '../../contexts/AuthContext'
import '../../styles/LoginPage.css'
import logo from '../../assets/logos/siara-logo.png'

export default function LoginPage() {
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState({})
  const alertRef = useRef(null)

  function validate() {
    const errs = {}
    if (!identifier) errs.identifier = 'Veuillez entrer un email ou un numéro valide.'
    else {
      const isEmail = identifier.includes('@')
      if (isEmail) {
        const re = /\S+@\S+\.\S+/
        if (!re.test(identifier)) errs.identifier = 'Veuillez entrer un email valide.'
      } else {
        const digits = identifier.replace(/\D/g, '')
        if (digits.length < 8) errs.identifier = 'Veuillez entrer un numéro de téléphone valide (min 8 chiffres).'
      }
    }
    if (!password) errs.password = 'Le mot de passe est requis.'
    else if (password.length < 8) errs.password = 'Le mot de passe doit contenir au moins 8 caractères.'
    return errs
  }

  const navigate = useNavigate()
  const { login } = useContext(AuthContext)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    const errs = validate()
    setFieldErrors(errs)
    if (Object.keys(errs).length) {
      setTimeout(() => {
        const el = document.querySelector('[aria-invalid="true"]')
        if (el) el.focus()
      }, 50)
      return
    }

    setLoading(true)
    try {
      const res = await login(identifier, password, remember)
      // brief success visual then navigate
      setTimeout(() => {
        if (res.role === 'admin') navigate('/admin/overview')
        else navigate('/news')
      }, 300)
    } catch (err) {
      setError(err.message || 'Erreur : Identifiants invalides')
      setTimeout(() => {
        if (alertRef.current) alertRef.current.focus()
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
            <div className="hero-kicker">Plateforme IA — SIARA</div>
            <div className="siara-hero-illustration">
              <div className="hero-orbits">
                <span />
                <span />
                <span />
              </div>
            </div>
            <h2 className="title">SIARA — Road Accident Risk Visualizer</h2>
            <p className="subtitle">Prototype frontend pour visualiser et anticiper les risques d'accidents routiers en Algérie grâce à l’IA et aux données.</p>
            <div className="hero-badges">
              <span className="hero-badge">Heatmaps interactives</span>
              <span className="hero-badge">IA prédictive</span>
              <span className="hero-badge">Sécurité routière</span>
            </div>
          </div>
        </aside>

        <main className="siara-form-column">
          <div className="siara-form-wrap" role="region" aria-labelledby="loginTitle">
            <div className="siara-brand">
              <img src={logo} alt="SIARA logo" />
              <div>
                <div className="brand-name">SIARA</div>
                <div className="tag">Prédiction des risques routiers — Prototype</div>
              </div>
            </div>

            <h2 id="loginTitle" className="siara-form-title">Se connecter</h2>
            <div className="siara-form-sub">Connectez-vous pour accéder au tableau de bord et aux outils de visualisation de risques.</div>
            <div className="siara-form-helper">Accès réservé aux utilisateurs SIARA.</div>

          {error && (
            <div ref={alertRef} role="alert" tabIndex={-1} className="error-box" style={{color:'var(--siara-error)',marginBottom:12}}>
              {error}
            </div>
          )}

            <form onSubmit={handleSubmit} aria-live="polite">
              <label htmlFor="identifier" className="field-label">Email ou numéro</label>
              <div className="input-shell">
                <span className="input-icon" aria-hidden="true">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <rect x="3" y="5" width="18" height="14" rx="2" ry="2" stroke="currentColor" strokeWidth="1.6"/>
                    <path d="M4 7L12 12L20 7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </span>
                <input id="identifier" className="siara-input" placeholder="email@exemple.com ou +213..." value={identifier} onChange={(e)=>setIdentifier(e.target.value)} aria-invalid={fieldErrors.identifier? 'true':'false'} />
              </div>

              <div style={{height:8}} />

              <label htmlFor="password" className="field-label">Mot de passe</label>
              <div className="input-shell">
                <span className="input-icon" aria-hidden="true">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <rect x="6" y="8" width="12" height="10" rx="2" ry="2" stroke="currentColor" strokeWidth="1.6"/>
                    <path d="M9 8V6.5C9 5.12 10.12 4 11.5 4H12.5C13.88 4 15 5.12 15 6.5V8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
                  </svg>
                </span>
                <input id="password" className="siara-input" placeholder="Mot de passe" type={showPassword? 'text':'password'} value={password} onChange={(e)=>setPassword(e.target.value)} aria-invalid={fieldErrors.password? 'true':'false'} />
                <button
                  type="button"
                  onClick={()=>setShowPassword(s=>!s)}
                  aria-label={showPassword? 'Masquer le mot de passe':'Afficher le mot de passe'}
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

              <div className="siara-row" style={{marginTop:12}}>
                <label style={{display:'flex',alignItems:'center',gap:8}} className="siara-remember"><input type="checkbox" checked={remember} onChange={(e)=>setRemember(e.target.checked)} /> Se souvenir de moi</label>
                <div style={{flex:1}} />
                <Link to="/forgot" className="link-accent">Mot de passe oublié ?</Link>
              </div>

              <div style={{height:8}} />

              <button type="submit" className="siara-cta" disabled={loading} aria-busy={loading}>{loading? 'Chargement...':'Se connecter'}</button>
            </form>

            <button className="siara-alt" style={{marginTop:12}}>
              <span aria-hidden="true" style={{display:'inline-flex',alignItems:'center',justifyContent:'center'}}>
                <svg width="18" height="18" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
                  <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.2C12.43 13.02 17.74 9.5 24 9.5z"/>
                  <path fill="#4285F4" d="M46.98 24.55c0-1.57-.14-3.08-.39-4.55H24v9.01h12.9c-.56 2.9-2.25 5.36-4.8 7.01l7.73 6c4.52-4.18 7.15-10.34 7.15-17.47z"/>
                  <path fill="#FBBC05" d="M10.54 28.98A14.5 14.5 0 0 1 9.5 24c0-1.7.29-3.34.8-4.88l-7.98-6.2A23.89 23.89 0 0 0 0 24c0 3.86.92 7.5 2.56 10.74l7.98-6.2z"/>
                  <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.9-5.8l-7.73-6c-2.14 1.44-4.89 2.3-8.17 2.3-6.26 0-11.57-3.52-14.46-8.72l-7.98 6.2C6.51 42.62 14.62 48 24 48z"/>
                  <path fill="none" d="M0 0h48v48H0z"/>
                </svg>
              </span>
              <span>Se connecter avec Google</span>
            </button>

            {/* Quick demo access */}
            <div style={{ marginTop: 16, padding: '14px 16px', background: 'rgba(59,130,246,0.08)', borderRadius: 12, border: '1px solid rgba(59,130,246,0.18)' }}>
              <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.8px', color: '#3b82f6', marginBottom: 8 }}>Accès démo rapide</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  type="button"
                  className="siara-alt"
                  style={{ flex: 1, fontSize: 12.5, padding: '8px 12px', margin: 0 }}
                  onClick={async () => {
                    setLoading(true)
                    try {
                      await login('admin@siara.dz', 'admin1234', false)
                      setTimeout(() => navigate('/admin/overview'), 300)
                    } catch { setError('Demo login failed') }
                    finally { setLoading(false) }
                  }}
                  disabled={loading}
                >
                  🛡️ Admin Panel
                </button>
                <button
                  type="button"
                  className="siara-alt"
                  style={{ flex: 1, fontSize: 12.5, padding: '8px 12px', margin: 0 }}
                  onClick={async () => {
                    setLoading(true)
                    try {
                      await login('user@siara.dz', 'user12345', false)
                      setTimeout(() => navigate('/news'), 300)
                    } catch { setError('Demo login failed') }
                    finally { setLoading(false) }
                  }}
                  disabled={loading}
                >
                  👤 User Demo
                </button>
              </div>
            </div>

            <div className="siara-footer-links">
              <Link to="/about">À propos de SIARA</Link>
              <Link to="/register" className="link-accent">S'inscrire</Link>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}

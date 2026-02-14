import React, { useState, useContext } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { AuthContext } from '../../contexts/AuthContext'
import '../../styles/LoginPage.css'
import '../../styles/RegisterPage.css'
import logo from '../../assets/logos/siara-logo.png'

export default function RegisterPage() {
  const [name,setName] = useState('')
  const [identifier,setIdentifier] = useState('')
  const [password,setPassword] = useState('')
  const [confirm,setConfirm] = useState('')
  const [showPassword,setShowPassword] = useState(false)
  const [showConfirm,setShowConfirm] = useState(false)
  const [agree,setAgree] = useState(false)
  const [errors,setErrors] = useState({})
  const [loading,setLoading] = useState(false)

  const navigate = useNavigate()
  const { mockRegister } = useContext(AuthContext) || {}

  function validate(){
    const e = {}
    if(!name) e.name = "Le nom est requis."
    if(!identifier) e.identifier = "Email ou numéro requis."
    if(!password) e.password = "Mot de passe requis."
    else if(password.length<8) e.password = "Le mot de passe doit contenir au moins 8 caractères."
    if(password !== confirm) e.confirm = "Les mots de passe ne correspondent pas."
    if(!agree) e.agree = "Vous devez accepter les conditions."
    return e
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const eobj = validate(); setErrors(eobj)
    if(Object.keys(eobj).length) return
    setLoading(true)
    try{
      if(mockRegister){
        await mockRegister({name,identifier,password})
      }
      // simple redirect after register
      navigate('/login')
    }catch(err){
      setErrors({form: err.message || 'Erreur lors de l\'inscription.'})
    }finally{setLoading(false)}
  }

  return (
    <div className="siara-login-root">
      <div className="siara-login-grid">
        {/* LEFT HERO: identical to LoginPage */}
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
            <p className="subtitle">
              Prototype frontend pour visualiser et anticiper les risques d'accidents routiers en Algérie grâce à l’IA et aux données.
            </p>
            <div className="hero-badges">
              <span className="hero-badge">Heatmaps interactives</span>
              <span className="hero-badge">IA prédictive</span>
              <span className="hero-badge">Sécurité routière</span>
            </div>
          </div>
        </aside>

        {/* RIGHT CARD: same shell as login, register-specific form inside */}
        <main className="siara-form-column">
          <div className="siara-form-wrap" role="region" aria-labelledby="registerTitle">
            <div className="siara-brand">
              <img src={logo} alt="SIARA logo" />
              <div>
                <div className="brand-name">SIARA</div>
                <div className="tag">Prédiction des risques routiers — Prototype</div>
              </div>
            </div>

            <h2 id="registerTitle" className="siara-form-title">Créer un compte</h2>
            <div className="siara-form-sub">Inscrivez-vous pour accéder au tableau de bord et aux cartes de risques.</div>
            <div className="siara-form-helper">Accès réservé aux utilisateurs autorisés de SIARA.</div>

            <form className="register-form" onSubmit={handleSubmit}>
              {errors.form && <div className="form-error" role="alert">{errors.form}</div>}

          <label className="field-label">Nom complet</label>
          <div className="input-shell">
            <span className="input-icon" aria-hidden="true">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="12" cy="8" r="3.2" stroke="currentColor" strokeWidth="1.6" />
                <path d="M5 19C5.8 16.2 8.6 14.4 12 14.4C15.4 14.4 18.2 16.2 19 19" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            </span>
            <input className="siara-input" value={name} onChange={e=>setName(e.target.value)} placeholder="Prénom Nom" />
          </div>
          {errors.name && <div className="field-error">{errors.name}</div>}

          <label className="field-label">Email ou numéro</label>
          <div className="input-shell">
            <span className="input-icon" aria-hidden="true">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="3" y="5" width="18" height="14" rx="2" ry="2" stroke="currentColor" strokeWidth="1.6" />
                <path d="M4 7L12 12L20 7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            <input className="siara-input" value={identifier} onChange={e=>setIdentifier(e.target.value)} placeholder="email@exemple.com ou +213..." />
          </div>
          {errors.identifier && <div className="field-error">{errors.identifier}</div>}

          <label className="field-label">Mot de passe</label>
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
              placeholder="Mot de passe"
            />
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
          {errors.password && <div className="field-error">{errors.password}</div>}

          <label className="field-label">Confirmez le mot de passe</label>
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
              placeholder="Confirmez le mot de passe"
            />
            <button
              type="button"
              onClick={()=>setShowConfirm(s=>!s)}
              aria-label={showConfirm? 'Masquer la confirmation':'Afficher la confirmation'}
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

          <label className="agree">
            <input type="checkbox" checked={agree} onChange={e=>setAgree(e.target.checked)} />
            <span>
              J'accepte les <a href="#" className="terms-link">conditions d'utilisation</a>
            </span>
          </label>
          {errors.agree && <div className="field-error">{errors.agree}</div>}

          <button className="siara-cta" type="submit" disabled={loading}>{loading ? 'Création...' : "S'inscrire"}</button>

          <div className="register-footer">Déjà inscrit ? <Link to="/login" className="link-accent">Se connecter</Link></div>
        </form>
          </div>
        </main>
      </div>
    </div>
  )
}

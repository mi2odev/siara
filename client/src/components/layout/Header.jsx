import React from 'react'
import { Link, useLocation } from 'react-router-dom'
import logo from '../../../assets/logos/siara-logo.png'

export default function Header() {
  const location = useLocation()
  const isHome = location.pathname === '/home'

  function scrollTo(id){
    const el = document.getElementById(id)
    if(el){ el.scrollIntoView({behavior:'smooth',block:'start'}) }
  }

  return (
    <header className="siara-header">
      <div className="siara-header-inner">
        <div className="brand-group">
          <Link to="/home" className="logo-link" aria-label="Accueil SIARA">
            <img src={logo} alt="SIARA" className="logo-img" loading="lazy" />
            <span className="logo-text">SIARA</span>
          </Link>
        </div>

        <nav className="main-nav" aria-label="Navigation principale">
          {isHome ? (
            <button onClick={()=>scrollTo('hero')} className="nav-link">Home</button>
          ) : (
            <Link to="/home" className="nav-link">Home</Link>
          )}
          <Link to="/map" className="nav-link">Carte</Link>
          <Link to="/predictions" className="nav-link">Prédictions</Link>
          <Link to="/admin/dashboard" className="nav-link">Dashboard</Link>
          <Link to="/contact" className="nav-link">Contact</Link>
        </nav>

        <div className="header-cta">
          <Link to="/login" className="btn-cta" aria-label="Se connecter">Se connecter</Link>
        </div>
      </div>
    </header>
  )
}

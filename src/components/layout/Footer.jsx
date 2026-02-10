import React from 'react'
import logo from '../../assets/logos/siara-logo.png'

export default function Footer() {
  return (
    <footer className="siara-footer" aria-label="Pied de page">
      <div className="footer-max">
        <div className="footer-col">
          <img src={logo} alt="Logo SIARA" className="footer-logo" loading="lazy" />
          <address className="footer-address">Alger, Algérie<br/>contact@siara.dz</address>
          <div className="footer-copy">© {new Date().getFullYear()} SIARA</div>
        </div>
        <div className="footer-col">
          <h5>Liens</h5>
          <ul className="footer-links">
            <li><a href="/home">Home</a></li>
            <li><a href="/about">About</a></li>
            <li><a href="/services">Services</a></li>
            <li><a href="/predictions">Prédictions</a></li>
            <li><a href="/contact">Contact</a></li>
          </ul>
        </div>
        <div className="footer-col">
          <h5>Contact</h5>
            <a className="footer-mail" href="mailto:contact@siara.dz">contact@siara.dz</a>
            <div className="social-row">
              <a href="#" aria-label="LinkedIn" className="social-circle">in</a>
              <a href="#" aria-label="Twitter" className="social-circle">t</a>
              <a href="#" aria-label="GitHub" className="social-circle">gh</a>
            </div>
        </div>
      </div>
    </footer>
  )
}

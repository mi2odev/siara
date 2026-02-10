import React from 'react'
import '../../styles/AboutPage.css'
import logo from '../../assets/logos/siara-logo.png'

export default function AboutPage(){
  return (
    <div className="about-root">
      <div className="about-card">
        <header className="about-header">
          <img src={logo} alt="SIARA" className="about-logo" />
          <div className="about-kicker">Prédiction des risques routiers — Prototype</div>
          <h1 className="about-title">À propos de SIARA</h1>
          <p className="about-subtitle">
            SIARA est une plateforme expérimentale qui utilise l'intelligence artificielle et les données routières
            pour visualiser et anticiper les risques d'accidents en Algérie.
          </p>
        </header>

        <section className="about-section">
          <h2>Pourquoi SIARA ?</h2>
          <p>
            L'objectif de SIARA est d'offrir aux acteurs de la sécurité routière (collectivités, décideurs, chercheurs)
            un outil moderne pour explorer les zones à risque, suivre l'évolution des accidents et tester des scénarios de prévention.
          </p>
        </section>

        <section className="about-section about-grid">
          <div>
            <h3>Fonctionnalités clés</h3>
            <ul>
              <li>Cartes interactives avec zones de risques routiers.</li>
              <li>Prédictions basées sur des modèles d'IA.</li>
              <li>Visualisation temporelle des incidents et tendances.</li>
            </ul>
          </div>
          <div>
            <h3>Statut du projet</h3>
            <p>
              Cette interface est un prototype frontend. Certaines données et services sont simulés afin d'illustrer
              l'expérience utilisateur et les parcours clés de la plateforme.
            </p>
          </div>
        </section>

        <footer className="about-footer">
          <p>
            Ce prototype a été conçu à des fins d'expérimentation pédagogique et de démonstration. Il ne remplace pas
            les dispositifs officiels de suivi et de prévention des accidents.
          </p>
        </footer>
      </div>
    </div>
  )
}

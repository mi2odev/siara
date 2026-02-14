import React from 'react'
import '../../styles/DescriptionPage.css'

export default function DescriptionPage(){
  return (
    <div className="description-root">
      <main className="description-container">
        <header className="description-header">
          <h1>SIARA — Description</h1>
          <p className="lead">Visualisation et prototype de prédiction des risques routiers — aperçu et objectifs du projet.</p>
        </header>

        <section className="description-section">
          <h2>But du projet</h2>
          <p>
            SIARA est un prototype visant à fournir une interface de visualisation des zones à risque
            et de simulation des prédictions de sinistralité routière. L'objectif est d'aider
            les décideurs et les équipes techniques à identifier les corridors à risques
            et tester des actions préventives.
          </p>
        </section>

        <section className="description-section">
          <h2>Fonctionnalités clés</h2>
          <ul>
            <li>Cartes interactives avec couches de risque et marqueurs</li>
            <li>Prédictions simulées et contrôle des paramètres</li>
            <li>Tableaux de bord administratifs pour le suivi</li>
            <li>Exports simples et partage d'aperçus</li>
          </ul>
        </section>

        <section className="description-section">
          <h2>Pour commencer</h2>
          <p>Connectez-vous via la page de connexion pour accéder aux cartes et outils de simulation.</p>
        </section>
      </main>
    </div>
  )
}

# SIARA — Comment tester le prototype

Merci d'évaluer **SIARA**, une plateforme de sécurité routière pour l'Algérie qui
permet aux citoyens de signaler des incidents, utilise l'IA pour évaluer les
risques et valider les signalements, et offre à la police et aux superviseurs des
outils opérationnels en temps réel.

Ce guide vous accompagne dans le test de chaque rôle. **Aucun compte ni mot de
passe n'est nécessaire** — la connexion de démonstration vous connecte
directement dans le rôle que vous choisissez.

---

## 1. Pour commencer

1. Ouvrez le site de démonstration : **`<DEMO_URL>`**  ← _(remplacez par votre URL déployée)_
2. Sur la page de connexion, utilisez les **boutons de démonstration en un clic**
   pour entrer dans n'importe quel rôle :
   **Citoyen · Agent de police · Superviseur · Administrateur**.
3. **Changez de langue** à tout moment grâce au sélecteur de langue — toute
   l'interface est disponible en **العربية (arabe) · Français · English (anglais)**.

> La démonstration fonctionne avec des données de test. Vous pouvez cliquer
> librement — rien ici n'affecte les opérations réelles. Pour changer de rôle,
> déconnectez-vous et choisissez un autre bouton de démonstration.

---

## 2. Que tester, par rôle

### 👤 Citoyen (conducteur) — _entièrement interactif_
L'utilisateur quotidien qui signale les dangers et consulte le risque routier.
- **Signaler un incident :** *Signaler → Créer* — suivez le formulaire en 5 étapes
  (type, détails, localisation, photo, vérification) et validez.
- **Carte des risques en direct :** *Carte* — visualisez les incidents, les zones
  dangereuses et le risque tenant compte de la météo autour d'un lieu. Si le GPS
  est bloqué, utilisez le champ **« rechercher votre ville »** pour définir une
  position manuellement.
- **Itinéraire et prédictions :** *Prédictions* — vérifiez le risque le long d'un
  itinéraire et obtenez une explication de l'IA.
- **Alertes :** créez une alerte pour une zone et recevez des notifications.

### 👮 Agent de police — _entièrement interactif_
Outils de terrain pour vérifier les incidents et agir.
- À la première entrée, vous choisirez une **zone de travail** (Wilaya → Commune)
  — cela restreint tout ce que vous voyez à votre secteur.
- **File de vérification :** *Police → Vérification* — **vérifiez** ou **rejetez**
  les incidents signalés.
- **À proximité et priorités :** consultez les incidents proches et la file de
  priorité classée par l'IA ; **attribuez-vous** un incident, **demandez du
  renfort**, ajoutez des **notes de terrain**.
- **Historique des opérations :** chaque action est journalisée à des fins de
  traçabilité.

### 🛡️ Superviseur — _entièrement interactif_
Supervision de niveau commandement des agents et des incidents d'une zone.
- **Tableau de bord et carte des opérations :** *Police → Superviseur* — vue en
  direct des agents et des incidents de la zone.
- **Coordination :** attribuez des incidents aux agents ; émettez des alertes.
- **Analytique et interventions :** examinez les tendances de la zone et planifiez
  des interventions de sécurité (contre-mesures d'infrastructure).

### 🗂️ Administrateur — _lecture seule dans la démonstration_
Le panneau de contrôle de l'opérateur interne. Vous pouvez **tout consulter** —
vue d'ensemble, examen des incidents, utilisateurs, analytique, zones, supervision
de l'IA — mais les modifications des données réelles sont désactivées pour la
démonstration. Cela vous permet d'évaluer les capacités d'administration sans
rien modifier.

---

## 3. Les retours qui nous aideraient le plus

Pendant vos tests, votre avis nous intéresse sur :
- **Utilité** — chaque écran de rôle vous donne-t-il ce dont vous auriez réellement
  besoin ?
- **Clarté** — quelque chose est-il confus, mal libellé ou difficile à trouver ?
- **Adéquation au flux de travail** — le parcours signalement → vérification →
  résolution correspond-il à votre façon de travailler ?
- **Langue et terminologie** — la formulation en arabe et en français est-elle
  correcte et naturelle ?
- **Confiance dans l'IA** — les scores de risque et les résultats de validation des
  signalements sont-ils compréhensibles et raisonnables ?

---

## 4. Bon à savoir

- **Aucune configuration, aucun mot de passe** — les boutons de démonstration
  gèrent la connexion.
- **Données de test uniquement** — les démonstrations citoyen, police et
  superviseur sont modifiables pour que vous puissiez essayer de vraies actions ;
  la démonstration administrateur est en lecture seule par conception.
- **Fonctionne sur mobile et ordinateur**, dans les trois langues.
- Questions ou problèmes pendant les tests : **mouhamedbachir2323@gmail.com**

_Merci — vos retours façonnent directement le prototype._

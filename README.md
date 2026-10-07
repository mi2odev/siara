# SIARA — Road-safety platform

SIARA helps drivers, police and administrators work from the same live picture of road danger. Citizens report accidents, the platform maps danger zones and scores risk with machine-learning models, and police officers verify and handle incidents in their work zone.

## Highlights

- **Accident reports** with photos, validation and spam detection (ML report validator)
- **Danger-zone heatmaps** and an occurrence-risk model trained on past incidents
- **Police module**: work-zone selection by Wilaya and Commune, nearby incidents within 500 m (PostGIS), verify / reject / assign / request backup, full operation history
- **Role-based dashboards** for users, police, emergency services, supervisors and admins (analytics, zones, users, system settings)
- **Real-time alerts** with Socket.IO, web push and email notifications
- **Driver quiz** with a deterministic score and a local-LLM (Ollama) explanation
- **Multilingual UI** — English, French and Arabic (RTL)

## Stack

| Part | Tech |
|---|---|
| Web client (`client/`) | React · Vite · Material UI · Tailwind CSS · Zustand · React Router · i18next · Leaflet / MapLibre · Recharts |
| API (`api/`) | Node.js · Express 5 · PostgreSQL + PostGIS · Socket.IO · JWT · Cloudinary · node-cron · web-push |
| ML (`api/anomaly-detection`, `api/danger-zone-model`) | Python · scikit-learn / CatBoost models served by an ML service |
| Mobile (`mobile/`) | Mobile client |

## Project structure

```
api/        REST + real-time API, ML models and migrations
client/     React web app (user, police, emergency, supervisor, admin)
mobile/     Mobile app
deploy/     Deployment config (ML space)
diagrams/   UML: use case, class, activity and sequence diagrams
docs/       Testing guides (EN / FR / AR)
```

## Running locally

```bash
# API
cd api
cp .env.example .env   # fill in database, JWT, Cloudinary and mail settings
npm install
npm start

# Web client
cd client
npm install
npm run dev
```

See `api/README.md` for the police module and the local driver-quiz LLM setup.

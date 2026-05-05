# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository layout

This is a multi-runtime monorepo with three cooperating processes — there is no top-level orchestration script, each must be started independently:

- `api/` — Node.js/Express backend (entry: [api/index.js](api/index.js)). Owns all HTTP routes under `/api/*`, JWT auth, PostgreSQL access, Socket.IO notifications, and proxies ML calls to the Flask service.
- `api/contollers/Model/ml_service.py` — Flask ML microservice on port `8000`. Loads joblib models for driver-quiz risk and danger-zone severity, plus SHAP explainers. The Node API talks to it via `ML_SERVICE_BASE_URL` (default `http://localhost:8000`).
- `client/` — React 19 + Vite frontend (default port `5173`).

Note: the controllers folder is intentionally spelled `contollers` (typo baked into all `require` paths — do not rename).

## Common commands

Backend (Node API, port `5000` by default):
```bash
cd api && npm start          # nodemon index.js
node scripts/diagnoseNotifications.js   # check notification listener/socket plumbing
node scripts/testReportValidator.js     # smoke-test ML report validator
node scripts/testOccurrenceRisk.js
```

ML service (Flask, port `8000`):
```bash
cd api/contollers/Model && python ml_service.py
```

Frontend (Vite):
```bash
cd client && npm run dev
cd client && npm run build
cd client && npm run lint    # eslint .
```

Optional Ollama (local LLM for quiz/risk explanation streaming) — see [api/README.md](api/README.md):
```bash
ollama pull gemma3:4b        # default; LLM_PROVIDER=ollama, OLLAMA_MODEL=gemma3:4b
```

There is no test runner configured in either `api/` or `client/` — verification is done via the `scripts/*.js` smoke scripts and the curl recipes in [api/README.md](api/README.md).

## Architecture

### Three-tier request flow
Browser → Node Express (`/api/*`) → Flask ML service (`/predict`, `/risk/*`, `/quiz/explanation/*`) → joblib models. The Node layer is the only thing the client speaks to; Flask is internal. Most ML endpoints in [api/contollers/Model/models.js](api/contollers/Model/models.js) are thin proxies that enrich the payload (weather from Open-Meteo, sun times, OSRM routing, Africa/Algiers timezone normalization) before calling Flask, then persist results via [api/services/riskPersistence.js](api/services/riskPersistence.js).

The Node API also exposes **compatibility aliases** under `/api/model/*` that mirror the canonical `/api/risk/*`, `/api/weather/*`, etc. routes — keep both in sync when adding endpoints (see bottom of [api/index.js](api/index.js)).

### Database
PostgreSQL with PostGIS. Connection is built in [api/db.js](api/db.js) from either `DATABASE_URL` or `PG*` env vars; `PGSSLMODE` controls TLS. Schemas in active use:
- `auth.*` — users, roles, user_roles
- `app.*` — domain tables: `accident_reports`, `police_operation_history`, `user_security_state`, etc.
- `gis.*` — `road_segments` (PostGIS geometry; queried via `ST_DWithin` for nearby logic, e.g. police 500m radius)
- `ml.*` — `model_versions` (an active deployed row is required at startup; absence logs `[startup] missing_active_model_version`)

Migrations live in [api/migrations/](api/migrations/) as plain timestamped `.sql` files — there is no migration runner, they are applied manually.

### Auth (JWT + roles)
[api/contollers/verifytoken.js](api/contollers/verifytoken.js) is the central auth middleware. Tokens come from a cookie (`accessToken`), `Authorization: Bearer`, or socket auth handshake. Each request re-fetches the user and checks `session_version` against the token — bumping `app.user_security_state.session_version` invalidates all outstanding tokens. Role-based helpers: `verifyTokenAndAdmin`, `verifyTokenAndPolice`, `verifyTokenAndClient`, `verifyTokenAndRoles([...])`. Police role accepts any of `police`, `police_officer`, `police officer` (normalized).

### Real-time pipeline
- [api/services/notificationListener.js](api/services/notificationListener.js) opens a dedicated PostgreSQL `LISTEN` client for DB notify channels.
- [api/services/notificationSocket.js](api/services/notificationSocket.js) is the Socket.IO server attached to the same `httpServer` as Express; the client connects via [client/src/services/notificationSocket.js](client/src/services/notificationSocket.js).
- [api/services/weeklySummaryScheduler.js](api/services/weeklySummaryScheduler.js) runs `node-cron` jobs.
All three are started in [api/index.js](api/index.js) after `runStartupChecks()`.

### ML/explanation surface
Three model families coexist:
1. **Driver quiz** ([api/driver-quiz-model/](api/driver-quiz-model/)) — RandomForest joblib + SHAP `TreeExplainer`. Score is deterministic in Python; a local LLM (Ollama) only converts the structured result into prose. SSE streaming via `POST /api/model/predict/stream`.
2. **Danger-zone severity** ([api/danger-zone-model/](api/danger-zone-model/)) — LightGBM trained on US_Accidents, deployed in Algeria as relative risk only. Inference responses set `is_calibrated_probability=false`. See [api/danger-zone-model/README.md](api/danger-zone-model/README.md) for pipeline details.
3. **Anomaly / report validation** ([api/anomaly-detection/](api/anomaly-detection/)) — `report_validator.py` (joblib) and `report_spam_model.py` (PyTorch `best_fakeddit_model.pt`, gitignored). Loaded into the same Flask app.

Risk explanation has two paths: `riskExplanationService` and `routeExplanationService` (Node-side LLM call), and `quiz_explainer.py` (Flask-side, streams chunks back through Node as SSE).

### Frontend conventions
- React 19 + Vite + Tailwind v4 (PostCSS) + MUI v7 + react-leaflet + maplibre-gl. Routing in [client/src/routes/AppRouter.jsx](client/src/routes/AppRouter.jsx) with three role gates: `ProtectedRoute`, `PublicOnlyRoute`, `NonAdminOnlyRoute`, plus `PoliceAccessGate` which forces work-zone selection (Wilaya → Commune) on first police login.
- One service module per backend domain in [client/src/services/](client/src/services/) — they are the only place that should call `axios`. State lives in Zustand stores ([client/src/stores/](client/src/stores/)) and React Contexts ([client/src/contexts/](client/src/contexts/)).
- Map UI has two stacks side-by-side: Leaflet components (`MapContainer`, `MarkersLayer`, `SiaraMap`) and a newer MapLibre stack (`MapLibreNavigationView`, `LiveLocationMap`). Recent commits indicate MapLibre is the direction for navigation/road-segment views.

## Important env vars

API (`api/.env`):
- `PORT_NUM` (default 5000), `CLIENT_ORIGIN` (default `http://localhost:5173`)
- `DATABASE_URL` *or* `PGHOST`/`PGPORT`/`PGUSER`/`PGPASSWORD`/`PGDATABASE` + `PGSSLMODE`
- `JWT_ACCESSTOKEN` (required — startup throws 500 on auth without it)
- `ML_SERVICE_BASE_URL` (default `http://localhost:8000`), `ML_SERVICE_TIMEOUT_MS`, `ML_SERVICE_STREAM_TIMEOUT_MS`
- `RISK_TIMEZONE` (default `Africa/Algiers`), `OSRM_ROUTE_URL`
- `LLM_PROVIDER`, `OLLAMA_MODEL`, `OLLAMA_BASE_URL` — see [api/README.md](api/README.md) for the full streaming/LLM env list.

## Things to know before editing

- `controllers` directory is misspelled `contollers` everywhere — keep it that way.
- The Node API mounts several **alias middlewares** before `adminUsersRoutes` (e.g. `/api/admin/users/:id/driver-quiz` rewrites to `driverQuizRoutes`). Order in [api/index.js](api/index.js) is load-bearing — don't reorder `app.use` calls without reading the comments around lines 80–110.
- Police actions (verify/reject/assign/backup/notes) write audit rows to `app.police_operation_history` — preserve this when changing police controllers.
- Domain disclaimer for danger-zone outputs: model is US-trained, used as relative risk in Algeria. Don't change response fields like `is_calibrated_probability` or `domain_warning` without coordinating model retraining.
- Large ML artifacts (`best_fakeddit_model.pt`, `api.zip`, `__pycache__/`, `.env`) are gitignored — don't commit them.

---
title: SIARA ML Service
colorFrom: blue
colorTo: indigo
sdk: docker
app_port: 8000
pinned: false
---

# SIARA ML Service

Internal Flask microservice for the SIARA road-safety platform. It is called
server-to-server by the SIARA Node/Express API (`ML_SERVICE_BASE_URL`), not
directly by browsers. Built as a Hugging Face **Docker** Space, listening on
port **8000**, served by **gunicorn** (one worker — the models are large).

> **Recommendation: make this Space private.** It serves the SIARA backend over
> `ML_SERVICE_BASE_URL` and does not need to be public.

## Models loaded

| Model | Endpoint(s) | Status at startup |
|-------|-------------|-------------------|
| Driver-quiz risk (RandomForest + SHAP) | `/predict`, `/predict/stream` | **Mandatory** — process won't start without it |
| Danger-zone severity (LightGBM multiclass) | `/risk/current`, `/risk/overlay`, `/risk/explain` | **Mandatory** |
| Sentinel OOD/confidence | `/risk/confidence` | Optional (graceful 503 if absent) |
| Occurrence probability | `/risk/occurrence/*` | Optional (graceful 503 if absent) |
| Report validator | `/report/validate` | Optional (lazy; 503 if model missing) |
| Report spam / fake (PyTorch + CLIP) | `/report-spam/classify` | **Phase 2** — returns 503 "unavailable" in this image |

Quiz explanations call a local Ollama LLM if reachable, otherwise fall back to a
deterministic template — no network is required for the service to function.

## Health

`GET /health` (and `GET /`) returns `{"status":"ok", ...}` with a per-model
readiness map. Always 200 once the process is up.

## Phase 1 vs Phase 2

This image is **Phase 1**: it omits `torch` / OpenAI CLIP / Pillow and the
`best_fakeddit_model.pt` weights to stay light. Everything except
`/report-spam/classify` is fully functional. See `DEPLOY.md` for how to enable
the spam model in Phase 2.

## Configuration

| Env var | Purpose | Default |
|---------|---------|---------|
| `REPORT_SPAM_MODEL_PATH` | Path to `best_fakeddit_model.pt` (Phase 2) | `<app>/anomaly-detection/best_fakeddit_model.pt` |
| `OLLAMA_BASE_URL` | Optional LLM for quiz prose | `http://localhost:11434` |
| `LLM_PROVIDER` | Set to disable LLM and force templates | _(unset)_ |

No database credentials or Aiven secrets are needed by this service — the Node
API owns all PostgreSQL access.

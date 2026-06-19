# syntax=docker/dockerfile:1
#
# SIARA ML service — Flask microservice for Hugging Face Spaces (Docker SDK).
#
# PHASE 1 image: ships the driver-quiz, danger-zone severity, sentinel,
# occurrence, and report-validator models. It deliberately OMITS torch / OpenAI
# CLIP / Pillow and the heavy best_fakeddit_model.pt, so /report-spam/classify
# returns HTTP 503 "unavailable" until Phase 2 (see README.md / DEPLOY.md).
#
# Build context = the assembled Space folder produced by assemble-space.ps1,
# whose root holds this Dockerfile plus the ML source tree (contollers/,
# services/, anomaly-detection/, *-model dirs) and requirements.txt.

FROM python:3.13-slim

# libgomp1 = OpenMP runtime required by LightGBM at import/predict time.
RUN apt-get update \
    && apt-get install -y --no-install-recommends libgomp1 \
    && rm -rf /var/lib/apt/lists/*

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PYTHONPATH=/app \
    HOME=/home/appuser \
    MPLCONFIGDIR=/tmp/mpl

# Run as a non-root user (Hugging Face Spaces best practice; uid 1000).
RUN useradd --create-home --uid 1000 appuser

WORKDIR /app

# Install Python deps first so this layer caches across source/model changes.
COPY requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt

# Copy the ML service source + model artifacts. .dockerignore prunes secrets,
# any Node code, redundant model copies, *.pt and caches.
COPY --chown=appuser:appuser . /app

USER appuser

EXPOSE 8000

# gunicorn, ONE worker (the LightGBM severity model is ~700 MB resident, so a
# second worker would double memory). --threads gives limited concurrency
# without a second model copy. --timeout 300 covers slow SHAP/LightGBM inference
# and the SSE streaming routes (/predict/stream, /quiz/explanation/stream).
# BASE_DIR inside ml_service.py resolves to /app, matching the model paths.
CMD ["gunicorn", \
     "--workers", "1", \
     "--threads", "4", \
     "--bind", "0.0.0.0:8000", \
     "--timeout", "300", \
     "--pythonpath", "/app", \
     "--access-logfile", "-", \
     "--error-logfile", "-", \
     "contollers.Model.ml_service:app"]

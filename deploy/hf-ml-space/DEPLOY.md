# Deploying the SIARA ML service to Hugging Face Spaces (Docker)

This folder turns the Python/Flask ML service into a self-contained Hugging Face
**Docker Space** on port **8000**, served by **gunicorn** (one worker). The Node
backend and the Aiven PostgreSQL database are **not** touched.

---

## 0. What is in this folder

| File | Purpose |
|------|---------|
| `Dockerfile` | Phase-1 image (no torch/CLIP, no `.pt`) |
| `.dockerignore` | Keeps secrets, Node code, caches, redundant models out of the image |
| `README.md` | Hugging Face Space card (`sdk: docker`, `app_port: 8000`) |
| `.gitattributes` | git-LFS rules for `*.joblib` / `*.pt` (required by HF for big files) |
| `.gitignore` | Keeps `.env` / caches out of the Space repo |
| `assemble-space.ps1` | Copies the ML service + only the needed models into `space-build/` |

The two mandatory code changes already applied to the repo:

- `api/contollers/Model/ml_service.py` — the `report_spam_model` import is now
  guarded (so the service boots without torch/CLIP), `/report-spam/classify`
  returns **503 "unavailable"** when that model is absent, and a new
  `GET /health` (+ `GET /`) liveness endpoint was added.
- `api/requirements.txt` — added `gunicorn==23.0.0`.

Nothing else in the ML service was changed; `report_spam_model.py` was **not**
edited.

---

## 1. Test locally with Docker

```powershell
# from this folder (deploy/hf-ml-space)
pwsh ./assemble-space.ps1          # builds ./space-build with code + models
cd space-build
docker build -t siara-ml .
docker run --rm -p 8000:8000 siara-ml
```

In another terminal:

```bash
# liveness
curl http://localhost:8000/health

# driver-quiz prediction (mandatory model)
curl -X POST http://localhost:8000/predict \
  -H "Content-Type: application/json" \
  -d "{\"features\":{}}"

# danger-zone severity (mandatory model)
curl -X POST http://localhost:8000/risk/current \
  -H "Content-Type: application/json" \
  -d "{\"row\":{\"Start_Lat\":36.75,\"Start_Lng\":3.06,\"Start_Time\":\"2026-03-04T10:15:00\",\"Distance(mi)\":0.5,\"Temperature(F)\":77,\"Humidity(%)\":45,\"Pressure(in)\":30.0,\"Wind_Speed(mph)\":8,\"Wind_Direction\":\"NW\",\"Precipitation(in)\":0.0}}"

# occurrence status (optional model)
curl http://localhost:8000/risk/occurrence/status

# spam classify — EXPECTED 503 in Phase 1
curl -X POST http://localhost:8000/report-spam/classify \
  -H "Content-Type: application/json" \
  -d "{\"text\":\"x\",\"image_url\":\"http://example.com/a.jpg\"}"
```

`/health` should return `{"status":"ok","models":{...}}`. The spam endpoint
returning 503 "unavailable" is correct for Phase 1.

---

## 2. Deploy to Hugging Face Spaces

1. **Create the Space**: huggingface.co → New → Space →
   **SDK = Docker**, template = *Blank*. Set it **Private**. App port is read
   from `README.md` (`app_port: 8000`).

2. **Clone the (empty) Space repo** somewhere outside this project:
   ```bash
   git clone https://huggingface.co/spaces/<your-username>/<space-name>
   ```

3. **Assemble and copy the files in.** From `deploy/hf-ml-space`:
   ```powershell
   pwsh ./assemble-space.ps1
   ```
   Then copy everything from `space-build/` into the cloned Space folder
   (it already contains `Dockerfile`, `README.md`, `.gitattributes`,
   `.dockerignore`, `.gitignore`, `requirements.txt`, and the model tree).

4. **Push (model files go via LFS automatically thanks to `.gitattributes`):**
   ```bash
   cd <cloned-space-folder>
   git lfs install
   git add .
   git commit -m "SIARA ML service (Phase 1)"
   git push
   ```
   The 700 MB LightGBM model + 157 MB sentinel are large — the first push is
   slow. HF then builds the Docker image and boots the Space on port 8000.

5. **Point the Node backend at the Space.** In `api/.env`:
   ```
   ML_SERVICE_BASE_URL=https://<your-username>-<space-name>.hf.space
   ML_SERVICE_TOKEN=hf_yourReadToken     # only if the Space is PRIVATE
   ML_SERVICE_TIMEOUT_MS=60000           # remote is slower than localhost
   ```
   (no trailing `/predict`; trailing slashes are stripped by the callers).

   **Private Space → a token is required.** Every request to a private Space
   needs `Authorization: Bearer <token>`. `mlClient.js` and
   `reportSpamDetectionService.js` add this header automatically **when
   `ML_SERVICE_TOKEN` is set** (unset = localhost dev, no header). Use an HF
   **read** token from https://huggingface.co/settings/tokens. If the Space is
   **public**, leave `ML_SERVICE_TOKEN` empty — no auth needed.

> **Model files are gitignored in the main repo** (`.joblib`, `.pt`). That only
> affects the main repo — the assembler copies them from your working tree into
> `space-build/`, and you commit them to the **Space** repo via LFS. Make sure
> the files actually exist locally before assembling (the script warns if any
> mandatory model is missing).

---

## 3. Mandatory vs optional models

**Mandatory at startup** (process will not boot if missing):
- `driver-quiz-model/driver_model.joblib`
- `driver-quiz-model/driver_model_raw.joblib`
- `driver-quiz-model/metadata.json`
- `siara_multiclass_severity_artifacts_fixed/base_lightgbm_multiclass.joblib`
- `siara_multiclass_severity_artifacts_fixed/siara_multiclass_severity_metadata.json`

**Optional (service starts, the relevant route degrades to 503/disabled):**
- Sentinel `SiaraSentinelDZ_v2.joblib` → `/risk/confidence`
- Occurrence `calibrator.joblib` + `feature_list.json` → `/risk/occurrence/*`
- Danger baseline `siara_severe_metadata.json` → baseline fields only
- Report validator `report_validator_model.joblib` → `/report/validate`
- **Report spam `best_fakeddit_model.pt` → `/report-spam/classify` (Phase 2)**

---

## 4. Phase 2 — enabling /report-spam/classify

When you are ready to ship the spam/fake classifier:

1. Add the heavy deps to `api/requirements.txt`:
   ```
   --extra-index-url https://download.pytorch.org/whl/cpu
   torch
   Pillow
   ftfy
   regex
   tqdm
   clip @ git+https://github.com/openai/CLIP.git
   ```
2. In `deploy/hf-ml-space/.dockerignore`, **remove** the `**/*.pt` and `**/*.pth`
   lines so the weights are baked in.
3. Re-assemble with the weights and rebuild:
   ```powershell
   pwsh ./assemble-space.ps1 -IncludeSpamModel
   ```
4. Commit + push to the Space. The guarded import in `ml_service.py` now
   succeeds, so `/report-spam/classify` starts working with no further code
   change. Expect a much larger image (~+1 GB) and slower cold starts.

> Note: OpenAI CLIP installs from git (`git+https://...`), so the HF build needs
> network access at build time and the dependency is unpinned. This is the main
> reason it is deferred out of Phase 1.

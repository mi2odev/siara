# Accident Occurrence Model — `occurrence_beta_v1`

LightGBM + isotonic-calibrated classifier that estimates the probability of an
accident occurring on a given road segment within a 1-hour window.

## Artifact layout

```
api/occurrence-model/occurrence_betav1_final/
├── model.joblib              # LightGBM classifier
├── preprocessor.joblib       # sklearn ColumnTransformer (categorical OHE + numeric imputer)
├── calibrator.joblib         # Isotonic calibrator over base scores
├── feature_list.json         # 23 feature names in inference order — source of truth
├── feature_mapping.json      # pipeline → DB column mapping for feature engineering
├── metrics.json              # calibrated/uncalibrated metrics, threshold tables, comparison
├── training_manifest.json    # training config, splits, weather coverage, risk thresholds
├── inference_sample.json     # example rows + expected response shape (NaN tokens in JSON)
├── feature_importance.csv    # global gain importance (fallback explanations)
├── shap_top_features.csv     # SHAP mean absolute importance per feature
└── calibration_curve.png     # reliability plot
```

The same PNG is mirrored to
`client/public/model-assets/occurrence_beta_v1/calibration_curve.png` so Vite
serves it directly in dev. Express also serves the artifact folder under
`/model-assets/occurrence_betav1_final/*` as a backend-side fallback.

## Required input features (23)

```
month, weekday, hour, hour_of_week, is_weekend, is_night,
road_class, segment_length_m, oneway, bridge, tunnel,
weather_temp, weather_dwpt, weather_rhum, weather_prcp,
weather_wdir, weather_wspd, weather_pres,
past_segment_positive_count, past_segment_positive_count_7d,
past_segment_positive_count_30d, past_road_class_positive_count,
past_segment_hourofweek_count
```

Categorical: `road_class, oneway, bridge, tunnel`. All others numeric. Missing
weather/historical values can be `null` — the preprocessor imputes them.

`feature_list.json` is the canonical order. The Node feature builder
(deferred to a follow-up PR) MUST produce rows in this exact order.

## Endpoints

### Flask (internal)

- `POST /risk/occurrence/predict` — body `{ "rows": [ {feature_map}, ... ] }`,
  returns `{ model_version, selected_model, calibration_method, decision_threshold,
  risk_level_thresholds, feature_list, predictions: [...] }`.
- `GET /risk/occurrence/metadata` — returns metrics + manifest + SHAP global
  features (used by the Admin page).

Returns **HTTP 503** with `Occurrence model is not loaded` if the joblib files
were missing at startup; the rest of the Flask service (driver-quiz, danger
zone, sentinel, spam) keeps working.

### Node (public)

- `POST /api/risk/occurrence/predict` — thin proxy with payload validation.
- `POST /api/model/risk/occurrence/predict` — alias (matches the existing
  `/api/model/*` compatibility layer).
- `GET /api/risk/occurrence/metadata` — proxies the Flask metadata endpoint.
- `GET /api/admin/models/occurrence-beta-v1` — admin-only; merges
  `ml.model_versions` row + on-disk metrics + live Flask metadata. Used by the
  Admin → AI Monitoring → **Occurrence Model (Beta)** tab.

## Headline metrics (calibrated, validation split)

| Metric | Value |
|---|---|
| ROC-AUC | 0.7228 |
| PR-AUC | 0.2255 |
| Brier | 0.0989 |
| Log loss | 0.3320 |
| Precision @ top 1% | 0.4078 |
| Recall @ top 1% | 0.0343 |
| Precision @ top 5% | 0.2981 |
| Recall @ top 5% | 0.1254 |
| Precision @ top 10% | 0.2513 |
| Recall @ top 10% | 0.2114 |

Confusion matrix at `threshold=0.2`:

| | Pred 0 | Pred 1 |
|---|---|---|
| Actual 0 | TN 419 132 | FP 73 530 |
| Actual 1 | FN 44 002 | TP 22 466 |

Risk-level thresholds (calibrated probability):

| Level | Lower bound |
|---|---|
| low | 0.0 |
| moderate | 0.05 |
| high | 0.2 |
| critical | 0.5 |

## Probability interpretation — important caveat

The training set was constructed with sampled negatives (≈4–7 negatives per
positive). The calibrated probability therefore reflects this artificial
sampled prior, **not** the real-world base rate.

> Sampled training prevalence is artificial because of negative sampling.
> Calibrated probabilities reflect this sampled prior and should be interpreted
> as relative operational risk until recalibrated against realistic exposure.

Additionally, training data is US Accidents 2016–2023. For Algeria deployment,
treat the output as **relative operational risk** unless and until the model is
recalibrated on local exposure data.

## Smoke test

```bash
# 1. Start the Flask ML service in one shell:
cd api/contollers/Model
python ml_service.py
# Expect: [occurrence] loaded occurrence_beta_v1 lightgbm + isotonic

# 2. Run the smoke test (direct Flask):
cd api
node scripts/testOccurrenceModel.js

# Or, with the Node API also running, exercise the full proxy chain:
node scripts/testOccurrenceModel.js --via-node
```

The script reads `inference_sample.json`, POSTs the rows, and asserts that
`model_version === occurrence_beta_v1`, that `calibrated_probability` lies in
[0, 1], that `risk_level` ∈ {low, moderate, high, critical}, and that the
response contains no `NaN` tokens.

## Deferred work (next PR)

These were intentionally scoped out of the integration PR:

- **DB feature builder** (`buildOccurrenceFeaturesForSegment`,
  `buildOccurrenceFeaturesForRoute`) joining `gis.road_segments`,
  `ml.segment_time_features`, `gis.accident_events` and the weather cache.
- **Persistence** of trained-model predictions into `ml.risk_predictions`
  (global) and `app.user_occurrence_risk_predictions` (personalized).
- **Route-risk integration** — replacing the rule-fusion call in the
  road-guidance path with the trained model, with the rule-based scorer kept
  as the Flask-down fallback.

The existing rule-based path at `api/services/occurrenceRiskService.js` is
untouched and continues to serve `/api/occurrence-risk/*`.

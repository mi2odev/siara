# SIARA API Notes

## Local driver quiz explanations

The driver quiz score remains deterministic in Python. The local LLM layer only turns the structured quiz result into a natural-language explanation.

### Ollama setup

Install Ollama, then pull the default free local model:

```bash
ollama pull gemma3:4b
```

Optional stronger model if your hardware allows it:

```bash
ollama pull llama3.1:8b
```

Environment defaults:

```env
LLM_PROVIDER=ollama
OLLAMA_MODEL=gemma3:4b
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_TIMEOUT_SECONDS=20
```

To switch to the stronger model, set:

```env
OLLAMA_MODEL=llama3.1:8b
```

If Ollama is unavailable, the Flask service returns a deterministic template explanation and does not crash.

### Example quiz payload

`POST /api/model/predict`

```json
{
  "dissociative": 2,
  "anxious": 3,
  "risky": 2,
  "angry": 2,
  "high_velocity": 4,
  "distress_reduction": 2,
  "patient": 3,
  "careful": 5,
  "errors": 2,
  "violations": 1,
  "lapses": 4
}
```

### Example response shape

```json
{
  "risk_label": "moderate",
  "risk_percent": 48.75,
  "risk_score": 48.75,
  "explanation_text": "1. Short summary\n...",
  "advice_text": "Your driving profile shows...",
  "class_probabilities": {
    "very_low": 0.01,
    "low": 0.12,
    "moderate": 0.54,
    "elevated": 0.22,
    "high": 0.09,
    "extreme": 0.02
  },
  "xai": {
    "predicted_class_index": 2,
    "base_value": 0.0,
    "shap_per_feature": {
      "lapses": 0.0842
    }
  },
  "quiz_result_data": {
    "overall_risk_label": "moderate",
    "overall_risk_score": 48.75,
    "score_scale": "0-100 percent. This score is computed deterministically by the Python quiz model.",
    "top_risk_factors": [],
    "top_protective_factors": [],
    "questionnaire_sources": [],
    "factor_scores": {},
    "advice_focus": []
  }
}
```

### Local explanation test

Use the Node API proxy:

```bash
curl http://localhost:5000/api/model/quiz/explanation/test
```

Or call Flask directly:

```bash
curl http://localhost:8000/quiz/explanation/test
```

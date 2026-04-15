"""LLM explanation layer for deterministic SIARA driver quiz results.

Local setup:
- Install Ollama: https://ollama.com
- Pull the default free local model: `ollama pull gemma3:4b`
- Optional stronger model if hardware allows: `ollama pull llama3.1:8b`

Runtime configuration:
- LLM_PROVIDER=ollama
- OLLAMA_MODEL=gemma3:4b
- OLLAMA_BASE_URL=http://localhost:11434
- OLLAMA_TIMEOUT_SECONDS=20
"""

from __future__ import annotations

import json
import os
from typing import Any, Dict, Iterable, List, Mapping, Optional

import requests


DEFAULT_PROVIDER = "ollama"
DEFAULT_MODEL = "gemma3:4b"
DEFAULT_BASE_URL = "http://localhost:11434"
DEFAULT_TIMEOUT_SECONDS = 20


class QuizExplainerError(RuntimeError):
    """Base exception for quiz explanation generation failures."""


class OllamaUnavailableError(QuizExplainerError):
    """Raised when the local Ollama service cannot produce an explanation."""


SYSTEM_PROMPT = """You are SIARA's driver quiz result explainer.

The Python backend has already computed the quiz risk label and score using deterministic scoring logic. You must explain only the provided structured result. Never calculate, recalculate, adjust, override, infer, or dispute the score, risk label, factor scores, probabilities, or ranking.

Safety and tone rules:
- Explain the result only; do not decide the result.
- Do not provide medical, psychological, legal, or diagnostic claims.
- Do not say or imply certainty, such as "you will cause an accident" or "this proves".
- Use a supportive, practical, non-judgmental tone.
- Output in English only.
- Keep advice concrete and driving-safety focused.

Return exactly these five short sections:
1. Short summary
2. Main risk-increasing factors
3. Main protective factors
4. Practical advice
5. Brief disclaimer
"""


def get_quiz_explainer_config(env: Optional[Mapping[str, str]] = None) -> Dict[str, Any]:
    source = env or os.environ
    timeout_raw = source.get("OLLAMA_TIMEOUT_SECONDS", str(DEFAULT_TIMEOUT_SECONDS))
    try:
        timeout_seconds = float(timeout_raw)
    except (TypeError, ValueError):
        timeout_seconds = DEFAULT_TIMEOUT_SECONDS

    return {
        "provider": source.get("LLM_PROVIDER", DEFAULT_PROVIDER).strip().lower() or DEFAULT_PROVIDER,
        "model": source.get("OLLAMA_MODEL", DEFAULT_MODEL).strip() or DEFAULT_MODEL,
        "base_url": (source.get("OLLAMA_BASE_URL", DEFAULT_BASE_URL).strip() or DEFAULT_BASE_URL).rstrip("/"),
        "timeout_seconds": max(1.0, timeout_seconds),
    }


def _clean_text(value: Any, fallback: str = "Not provided") -> str:
    text = str(value or "").replace("_", " ").strip()
    return text if text else fallback


def _as_list(value: Any) -> List[Any]:
    if value is None:
        return []
    if isinstance(value, list):
        return value
    if isinstance(value, tuple):
        return list(value)
    return [value]


def _factor_label(item: Any) -> str:
    if isinstance(item, Mapping):
        name = item.get("description") or item.get("name") or item.get("factor")
        impact = item.get("impact")
        if impact is None:
            return _clean_text(name, "Unspecified factor")
        try:
            return f"{_clean_text(name, 'Unspecified factor')} (model contribution {float(impact):+.4f})"
        except (TypeError, ValueError):
            return _clean_text(name, "Unspecified factor")
    return _clean_text(item, "Unspecified factor")


def _join_factor_labels(items: Iterable[Any], empty_text: str) -> str:
    labels = [_factor_label(item) for item in items if item is not None]
    return "; ".join(labels) if labels else empty_text


def build_quiz_explanation_prompt(result_data: Mapping[str, Any]) -> List[Dict[str, str]]:
    """Build Ollama chat messages from already-computed structured quiz data."""

    compact_payload = {
        "overall_risk_label": result_data.get("overall_risk_label"),
        "overall_risk_score": result_data.get("overall_risk_score"),
        "score_scale": result_data.get("score_scale"),
        "top_risk_factors": _as_list(result_data.get("top_risk_factors")),
        "top_protective_factors": _as_list(result_data.get("top_protective_factors")),
        "questionnaire_sources": _as_list(result_data.get("questionnaire_sources")),
        "factor_scores": result_data.get("factor_scores") or {},
        "advice_focus": _as_list(result_data.get("advice_focus")),
    }

    user_prompt = (
        "Explain this already-computed SIARA driver quiz result. "
        "Use only the provided structured data and do not perform scoring.\n\n"
        f"{json.dumps(compact_payload, ensure_ascii=True, indent=2, sort_keys=True)}"
    )

    return [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": user_prompt},
    ]


def call_ollama_chat(
    messages: List[Dict[str, str]],
    *,
    model: Optional[str] = None,
    base_url: Optional[str] = None,
    timeout_seconds: Optional[float] = None,
) -> str:
    """Call Ollama's local chat API and return the assistant message text."""

    config = get_quiz_explainer_config()
    resolved_model = model or config["model"]
    resolved_base_url = (base_url or config["base_url"]).rstrip("/")
    resolved_timeout = timeout_seconds or config["timeout_seconds"]
    url = f"{resolved_base_url}/api/chat"

    payload = {
        "model": resolved_model,
        "messages": messages,
        "stream": False,
        "options": {
            "temperature": 0.2,
            "top_p": 0.9,
        },
    }

    try:
        response = requests.post(url, json=payload, timeout=resolved_timeout)
        response.raise_for_status()
    except requests.Timeout as exc:
        raise OllamaUnavailableError(f"Ollama request timed out after {resolved_timeout} seconds") from exc
    except requests.RequestException as exc:
        raise OllamaUnavailableError(f"Ollama request failed: {exc}") from exc

    try:
        body = response.json()
    except ValueError as exc:
        raise OllamaUnavailableError("Ollama returned a non-JSON response") from exc

    content = body.get("message", {}).get("content")
    if not isinstance(content, str) or not content.strip():
        raise OllamaUnavailableError("Ollama returned an empty chat message")

    return content.strip()


def build_template_explanation(result_data: Mapping[str, Any]) -> str:
    """Deterministic fallback used when Ollama is unavailable."""

    label = _clean_text(result_data.get("overall_risk_label"), "unknown").lower()
    score = result_data.get("overall_risk_score")
    scale = _clean_text(result_data.get("score_scale"), "0-100")
    risk_factors = _join_factor_labels(
        _as_list(result_data.get("top_risk_factors")),
        "No dominant risk-increasing factor was identified in the structured result.",
    )
    protective_factors = _join_factor_labels(
        _as_list(result_data.get("top_protective_factors")),
        "No dominant protective factor was identified in the structured result.",
    )
    advice_focus = _join_factor_labels(
        _as_list(result_data.get("advice_focus")),
        "Focus on steady speed, attention, safe distance, and rule-following.",
    )

    score_text = f"{score} on {scale}" if score is not None else f"the {scale} scale"

    return "\n\n".join(
        [
            f"1. Short summary\nYour driver quiz result is {label}, with a score of {score_text}. This explanation describes the already-computed result and does not change the score.",
            f"2. Main risk-increasing factors\nThe strongest risk-increasing signals are: {risk_factors}.",
            f"3. Main protective factors\nThe strongest protective signals are: {protective_factors}.",
            f"4. Practical advice\nUse this result as a prompt to practice safer habits: {advice_focus}",
            "5. Brief disclaimer\nThis is an educational driving-safety explanation, not a diagnosis or a prediction that an accident will happen.",
        ]
    )


def explain_quiz_result(result_data: Mapping[str, Any]) -> str:
    """Return a final explanation string, using Ollama when available."""

    config = get_quiz_explainer_config()
    if config["provider"] != "ollama":
        return build_template_explanation(result_data)

    try:
        messages = build_quiz_explanation_prompt(result_data)
        return call_ollama_chat(
            messages,
            model=config["model"],
            base_url=config["base_url"],
            timeout_seconds=config["timeout_seconds"],
        )
    except QuizExplainerError as exc:
        print(f"[quiz-explainer] Falling back to template explanation: {exc}")
        return build_template_explanation(result_data)

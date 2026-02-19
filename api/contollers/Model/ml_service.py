from flask import Flask, request, jsonify
import joblib
import numpy as np
import json
import pandas as pd
import shap

app = Flask(__name__)

# ---- Paths (adjust if needed)
MODEL_PATH = r"E:\WebSites\siara\api\driver-quiz-model\driver_model.joblib"          # calibrated
RAW_MODEL_PATH = r"E:\WebSites\siara\api\driver-quiz-model\driver_model_raw.joblib" # raw RF for SHAP
META_PATH  = r"E:\WebSites\siara\api\driver-quiz-model\metadata.json"

# ---- Load artifacts
model = joblib.load(MODEL_PATH)
rf_raw = joblib.load(RAW_MODEL_PATH)

with open(META_PATH, "r") as f:
    meta = json.load(f)

FEATURES = meta["features"]               # exact feature order
ordered_labels = meta["ordered_labels"]   # ["very_low", ..., "extreme"]

# ---- Create explainer once at startup (important for performance)
explainer = shap.TreeExplainer(rf_raw)

# -----------------------------
# Advice library + helpers
# -----------------------------
def _human_label(s: str) -> str:
    return str(s).replace("_", " ").strip()

FEATURE_EXPLANATIONS = {
    "errors": "driving mistakes that may force sudden braking or late reactions",
    "violations": "breaking traffic rules (speeding, phone use, signals) which increases crash risk",
    "lapses": "attention lapses and distraction that reduce your reaction time",
    "angry": "anger and aggressive reactions to other drivers",
    "risky": "risk-taking decisions like unsafe overtakes or late lane changes",
    "high_velocity": "a tendency to drive at higher speeds, leaving less time to react",
    "anxious": "driving anxiety, which can affect decision-making under pressure",
    "patient": "patience and calmness in traffic, which reduces risky reactions",
    "careful": "careful, safety-focused driving behavior",
    "distress_reduction": "using driving as stress relief, which can increase risk if emotions are intense",
    "dissociative": "mind-wandering while driving, which can reduce awareness of hazards",
}

FEATURE_ACTIONS = {
    "errors": "Focus on scanning mirrors/blind spots and keeping a larger safety distance to avoid last-second reactions.",
    "violations": "Reduce violations by respecting speed limits/signals and avoiding phone use while driving.",
    "lapses": "Minimize distractions (phone, multitasking) and take breaks if tired to avoid “autopilot” driving.",
    "angry": "When irritated, increase following distance, slow down, and avoid engaging with other drivers.",
    "risky": "Avoid risky overtakes and last-second moves—if you’re unsure, don’t overtake.",
    "high_velocity": "Cap your speed even on empty roads; use cruise control where possible to stabilize speed.",
    "anxious": "Start with simpler routes and gradually increase difficulty to build confidence and reduce tension.",
    "patient": "Keep the calm approach—leaving earlier and accepting delays prevents impulsive decisions.",
    "careful": "Keep maintaining safety habits (seatbelt, signaling, distance) because they strongly reduce risk.",
    "distress_reduction": "If you drive to reduce stress, avoid driving when emotions are intense; use safer stress relief first.",
    "dissociative": "Stay mentally present (narrate road events to yourself) and avoid driving when mentally overloaded.",
}

def generate_advice_paragraph(risk_label: str, risk_percent: float, shap_per_feature: dict, top_k_pos=3, top_k_neg=2):
    impacts = _sorted_impacts(shap_per_feature)

    pos = [(f, v) for f, v in impacts if v > 0][:top_k_pos]
    neg = [(f, v) for f, v in impacts if v < 0][:top_k_neg]

    # 1) Opening
    label_txt = _human_label(risk_label)
    paragraph = (
        f"Your driving profile shows a {label_txt} level of risk ({risk_percent:.2f}%). "
    )

    # 2) Main drivers (positive SHAP)
    if pos:
        reasons = []
        for feat, _ in pos:
            reasons.append(FEATURE_EXPLANATIONS.get(feat, _human_label(feat)))
        # join like: "A, B, and C"
        if len(reasons) == 1:
            reasons_txt = reasons[0]
        elif len(reasons) == 2:
            reasons_txt = f"{reasons[0]} and {reasons[1]}"
        else:
            reasons_txt = ", ".join(reasons[:-1]) + f", and {reasons[-1]}"
        paragraph += f"This result is mainly influenced by {reasons_txt}. "

    # 3) Protective factors (negative SHAP)
    if neg:
        protects = []
        for feat, _ in neg:
            protects.append(FEATURE_EXPLANATIONS.get(feat, _human_label(feat)))
        if len(protects) == 1:
            protects_txt = protects[0]
        else:
            protects_txt = " and ".join(protects[:2])
        paragraph += f"On the positive side, {protects_txt} helps reduce your overall risk. "

    # 4) Actionable closing advice: pick 1–2 actions from top drivers
    actions = []
    for feat, _ in pos[:2]:
        act = FEATURE_ACTIONS.get(feat)
        if act:
            actions.append(act)

    if actions:
        # Keep it one closing sentence (still 1 paragraph)
        paragraph += "To lower your risk, " + " ".join(actions)
    else:
        paragraph += "To lower your risk, focus on staying attentive, respecting traffic rules, and keeping a safe speed and distance."

    return paragraph.strip()


def _sorted_impacts(shap_per_feature: dict):
    items = [(k, float(v)) for k, v in shap_per_feature.items()]
    return sorted(items, key=lambda kv: abs(kv[1]), reverse=True)



@app.route("/predict", methods=["POST"])
def predict():
    data = request.get_json(silent=True) or {}

    # ---- validate
    missing = [f for f in FEATURES if f not in data]
    if missing:
        return jsonify({"error": "Missing required features", "missing": missing}), 400

    try:
        x = pd.DataFrame([[float(data[f]) for f in FEATURES]], columns=FEATURES)
    except (TypeError, ValueError):
        return jsonify({"error": "All feature values must be numeric"}), 400

    # ---- calibrated probabilities (for label + risk%)
    probs = model.predict_proba(x)[0]  # length 6
    pred_class = int(np.argmax(probs))
    risk_label = ordered_labels[pred_class]

    weights = np.arange(len(ordered_labels), dtype=float)  # 0..5
    severity = float((probs * weights).sum())
    risk_percent = float(np.clip(severity / weights.max() * 100.0, 0.0, 100.0))

    # ---- SHAP explanation (raw RF)
    shap_values = explainer.shap_values(x)

    if isinstance(shap_values, list):
        # list of length n_classes, each shape (1, n_features)
        shap_for_pred = shap_values[pred_class][0]  # (n_features,)
    else:
        sv = np.array(shap_values)
        # expected shape: (1, n_features, n_classes)
        if sv.ndim == 3 and sv.shape[1] == len(FEATURES) and sv.shape[2] == len(ordered_labels):
            shap_for_pred = sv[0, :, pred_class]
        elif sv.ndim == 2 and sv.shape[1] == len(FEATURES):
            shap_for_pred = sv[0]
        else:
            return jsonify({"error": "Unexpected SHAP output shape", "shape": list(sv.shape)}), 500

    # Base value handling (can be scalar or per-class)
    base_value = explainer.expected_value
    if isinstance(base_value, (list, np.ndarray)) and len(np.atleast_1d(base_value)) == len(ordered_labels):
        base_value_pred = float(np.atleast_1d(base_value)[pred_class])
    else:
        base_value_pred = float(np.array(base_value).reshape(-1)[0])

    # ---- Return ALL features shap values
    shap_per_feature = {FEATURES[i]: float(shap_for_pred[i]) for i in range(len(FEATURES))}

    # ---- Advice (uses SHAP + your input scores)
    feature_values = {f: float(x.iloc[0][f]) for f in FEATURES}


    advice_text = generate_advice_paragraph(
    risk_label=risk_label,
    risk_percent=risk_percent,
    shap_per_feature=shap_per_feature
)


    return jsonify({
        "risk_label": risk_label,
        "risk_percent": round(risk_percent, 2),
        "class_probabilities": {ordered_labels[i]: float(round(probs[i], 6)) for i in range(len(ordered_labels))},
        "xai": {
            "predicted_class_index": pred_class,
            "base_value": base_value_pred,
            "shap_per_feature": shap_per_feature
        },
        "advice_text": advice_text
    })


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8000)

from flask import Flask, request, jsonify
import joblib
import numpy as np


app = Flask(__name__)

model = joblib.load(r"E:\WebSites\siara\api\driver-quiz-model\driver_model.joblib")
scaler = joblib.load(r"E:\WebSites\siara\api\driver-quiz-model\scaler.joblib")
label_encoder = joblib.load(r"E:\WebSites\siara\api\driver-quiz-model\label_encoder.joblib")

FEATURES = [
    "dissociative",
    "anxious",
    "risky",
    "angry",
    "high_velocity",
    "distress_reduction",
    "patient",
    "careful",
    "errors",
    "violations",
    "lapses"
]

@app.route("/predict", methods=["POST"])
def predict():
    data = request.get_json(silent=True) or {}

    missing = [f for f in FEATURES if f not in data]
    if missing:
        return jsonify({
            "error": "Missing required features",
            "missing": missing
        }), 400

    try:
        x = [[float(data[f]) for f in FEATURES]]
    except (TypeError, ValueError):
        return jsonify({"error": "All feature values must be numeric"}), 400

    x = scaler.transform(x)

    pred = model.predict(x)
    label = label_encoder.inverse_transform(pred)[0]

    probs = model.predict_proba(x)[0]
    classes = label_encoder.inverse_transform(model.classes_)

    risk_map = {
        'very_low': 0,
        'low': 1,
        'moderate': 2,
        'elevated': 3,
        'high': 4,
        'extreme': 5
    }

    normalized_classes = [str(c).strip().lower() for c in classes]
    weights = np.array([risk_map[c] for c in normalized_classes], dtype=float)

    severity = float((probs * weights).sum())
    risk_percent = (severity / 5.0) * 100.0
    risk_percent = float(np.clip(risk_percent, 0.0, 100.0))

    return jsonify({
        "prediction": label,
        "risk_percent": round(float(risk_percent), 2)
    })



# ⚠️ THIS MUST BE OUTSIDE predict()
if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8000)



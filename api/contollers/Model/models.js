const axios = require("axios");

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || "http://localhost:8000/predict";

exports.predictDriverRisk = async (req, res) => {
  try {
    const response = await axios.post(ML_SERVICE_URL, req.body, {timeout: 5000 });
if (!req.body || Object.keys(req.body).length === 0) {
  return res.status(400).json({ error: "Empty request body" });
}

    return res.json(response.data);
  } catch (err) {
    const status = err.response?.status || 500;
    const payload = err.response?.data || { error: "Model service error" };
    console.error("Model service error:", err.message);
    return res.status(status).json(payload);
  }
};

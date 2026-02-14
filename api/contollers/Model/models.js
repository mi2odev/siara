const axios = require("axios");

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || "http://localhost:8000/predict";

exports.predictDriverRisk = async (req, res) => {
  try {
    const response = await axios.post(ML_SERVICE_URL, req.body);
    return res.json(response.data);
  } catch (err) {
    const status = err.response?.status || 500;
    const payload = err.response?.data || { error: "Model service error" };
    console.error("Model service error:", err.message);
    return res.status(status).json(payload);
  }
};

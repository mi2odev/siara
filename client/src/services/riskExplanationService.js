import { publicRequest } from "../requestMethodes";

export async function explainRiskPrediction(payload) {
  const response = await publicRequest.post("/predictions/explain-risk", payload);
  return response.data || null;
}

export async function explainRoute(payload, { signal } = {}) {
  const response = await publicRequest.post("/risk/route/explain", payload, {
    signal,
  });
  return response.data || null;
}

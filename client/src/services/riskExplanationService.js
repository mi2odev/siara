import { publicRequest } from "../requestMethodes";

export async function explainRiskPrediction(payload) {
  const response = await publicRequest.post("/predictions/explain-risk", payload);
  return response.data || null;
}

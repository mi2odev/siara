// Shared helpers for surfacing the trained OCCURRENCE model (probability that an
// accident occurs) as the headline risk for routes and road segments, in place
// of the severity model's relative-danger score.
//
// The Node API enriches each route segment with `segment.occurrence`
// ({ modelOnly, personalized }) and each route with `route.occurrence_summary`.
// These helpers read the personalized probability (falling back to model-only),
// returning a 0–100 percent plus a level mapped onto the UI's low/medium/high
// tier vocabulary. They return `null` when occurrence data is unavailable so
// callers can gracefully fall back to the existing severity danger score.

export function occurrenceLevelToTier(level) {
  const t = String(level || "").trim().toLowerCase();
  if (t === "critical" || t === "high") return "high";
  if (t === "moderate" || t === "medium") return "medium";
  if (t === "low") return "low";
  return null;
}

function pickProbability(block) {
  if (!block || typeof block !== "object") return null;
  const candidates = [block.calibrated_probability, block.score, block.risk_score];
  for (const value of candidates) {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function toRisk(probability, rawLevel) {
  if (probability == null || !Number.isFinite(probability)) return null;
  const clamped = Math.max(0, Math.min(1, probability));
  const occLevel = String(rawLevel || "").trim().toLowerCase() || null;
  return {
    percent: Math.round(clamped * 1000) / 10, // 0–100, 1 decimal
    level: occurrenceLevelToTier(occLevel),
    occLevel,
  };
}

// Per-segment occurrence risk (personalized preferred, else model-only).
export function segmentOccurrenceRisk(segment) {
  const occ = segment?.occurrence;
  if (!occ) return null;
  const personalizedProb = pickProbability(occ.personalized);
  if (personalizedProb != null) {
    return toRisk(personalizedProb, occ.personalized?.risk_level);
  }
  const modelProb = pickProbability(occ.modelOnly);
  if (modelProb != null) {
    return toRisk(modelProb, occ.modelOnly?.risk_level);
  }
  return null;
}

// Whole-route occurrence risk from the route's occurrence_summary.
export function routeOccurrenceRisk(route) {
  const s = route?.occurrence_summary;
  if (!s) return null;
  const personalized = Number(s.average_personalized_probability);
  if (Number.isFinite(personalized)) {
    return toRisk(personalized, s.average_personalized_risk_level);
  }
  const model = Number(s.average_modelOnly_probability);
  if (Number.isFinite(model)) {
    return toRisk(model, s.average_modelOnly_risk_level);
  }
  return null;
}

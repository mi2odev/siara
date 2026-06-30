import { publicRequest } from "../requestMethodes";

function normalizeError(error, fallback) {
  return new Error(
    error?.response?.data?.error
      || error?.response?.data?.message
      || error?.message
      || fallback,
  );
}

/**
 * Phase 2 — citizen safety overlay.
 * Fetches public-visible road-safety interventions (speed control, signage,
 * roadwork, lighting) to plot on the driver-facing map.
 *
 * @param {object} params
 * @param {number} [params.lat]   centre latitude for a nearby filter
 * @param {number} [params.lng]   centre longitude for a nearby filter
 * @param {number} [params.radiusKm] search radius in km (server caps at 200)
 * @param {string} [params.type]  restrict to a single intervention type
 * @param {number} [params.limit] max items (server caps at 500)
 * @returns {Promise<{ items: Array }>}
 */
export async function getSafetyOverlay(params = {}) {
  try {
    const query = {};
    if (Number.isFinite(Number(params.lat))) query.lat = params.lat;
    if (Number.isFinite(Number(params.lng))) query.lng = params.lng;
    if (Number.isFinite(Number(params.radiusKm))) query.radiusKm = params.radiusKm;
    if (params.type) query.type = params.type;
    if (Number.isFinite(Number(params.limit))) query.limit = params.limit;

    const response = await publicRequest.get("/risk/safety-overlay", { params: query });
    const items = Array.isArray(response.data?.items) ? response.data.items : [];
    return { items };
  } catch (error) {
    throw normalizeError(error, "Failed to load the safety overlay");
  }
}

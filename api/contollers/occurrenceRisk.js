const router = require("express").Router();
const createError = require("http-errors");

const {
  predictOccurrenceRisk,
  listUserOccurrenceRiskHistory,
  canViewOccurrenceRisk,
} = require("../services/occurrenceRiskService");
const { getForecastZones } = require("../services/forecastZonesService");
const {
  verifyToken,
  verifyTokenAndAdmin,
  verifyTokenAndPolice,
} = require("./verifytoken");

function parseBoundsFromQuery(query = {}) {
  const north = Number(query.north);
  const south = Number(query.south);
  const east = Number(query.east);
  const west = Number(query.west);
  if (![north, south, east, west].every(Number.isFinite)) return null;
  return { north, south, east, west };
}

function rethrowAsHttp(error) {
  if (error?.status && Number.isInteger(error.status)) {
    throw createError(error.status, error.message || "Occurrence risk error");
  }
  throw error;
}

router.post("/segment", verifyToken, async (req, res, next) => {
  try {
    const body = req.body && typeof req.body === "object" ? req.body : {};
    const personalize = body.personalize !== false;
    const result = await predictOccurrenceRisk({
      userId: personalize ? req.user.userId : null,
      roadSegmentId: body.roadSegmentId ?? body.road_segment_id,
      timeBucket: body.timeBucket ?? body.time_bucket,
      weather: body.weather || null,
      roadFeaturesOverride: body.roadFeatures || null,
      contextOverride: body.context || null,
      persist: body.persist !== false,
      deadline: req.deadline,
    });
    return res.status(200).json(result);
  } catch (error) {
    try {
      rethrowAsHttp(error);
    } catch (httpError) {
      return next(httpError);
    }
    return next(error);
  }
});

// AI "predicted danger zones" for the visible map area. Scores accident
// hotspots in-bounds with the occurrence model for the forecast time
// (timestamp or now + hours). Authenticated so the score can be personalized.
router.get("/forecast-zones", verifyToken, async (req, res, next) => {
  try {
    const bounds = parseBoundsFromQuery(req.query || {});
    if (!bounds) {
      throw createError(400, "north, south, east and west query params are required");
    }
    const result = await getForecastZones({
      bounds,
      timestamp: req.query?.timestamp || null,
      horizonHours: req.query?.hours,
      zoom: req.query?.zoom,
      userId: req.user.userId,
    });
    return res.status(200).json(result);
  } catch (error) {
    try {
      rethrowAsHttp(error);
    } catch (httpError) {
      return next(httpError);
    }
    return next(error);
  }
});

router.get("/me/history", verifyToken, async (req, res, next) => {
  try {
    const history = await listUserOccurrenceRiskHistory(req.user.userId, {
      limit: req.query?.limit,
      offset: req.query?.offset,
    });
    return res.status(200).json(history);
  } catch (error) {
    return next(error);
  }
});

async function handleScopedUserView(req, res, next) {
  try {
    const targetUserId = String(req.params.userId || "").trim();
    if (!targetUserId) {
      throw createError(400, "userId is required");
    }
    if (!canViewOccurrenceRisk(req.user, targetUserId)) {
      throw createError(403, "You are not allowed to view this user's occurrence risk");
    }
    const history = await listUserOccurrenceRiskHistory(targetUserId, {
      limit: req.query?.limit,
      offset: req.query?.offset,
    });
    return res.status(200).json({ userId: targetUserId, ...history });
  } catch (error) {
    return next(error);
  }
}

router.get("/admin/users/:userId", verifyTokenAndAdmin, handleScopedUserView);
router.get("/police/users/:userId", verifyTokenAndPolice, handleScopedUserView);

module.exports = router;

const router = require("express").Router();
const createError = require("http-errors");

const {
  getDangerHeatClusters,
  parseHoursFromRequest,
} = require("../services/reportDangerHeatmapService");

function parseOptionalBounds(query) {
  const hasAny =
    query?.north != null || query?.south != null || query?.east != null || query?.west != null;
  if (!hasAny) return null;
  const north = Number(query.north);
  const south = Number(query.south);
  const east = Number(query.east);
  const west = Number(query.west);
  if (
    !Number.isFinite(north) ||
    !Number.isFinite(south) ||
    !Number.isFinite(east) ||
    !Number.isFinite(west)
  ) {
    throw createError(400, "north, south, east, west must all be finite numbers");
  }
  if (north <= south) {
    throw createError(400, "north must be greater than south");
  }
  if (east <= west) {
    throw createError(400, "east must be greater than west");
  }
  return { north, south, east, west };
}

router.get("/report-danger-heatmap", async (req, res, next) => {
  try {
    const hours = parseHoursFromRequest(req.query?.hours ?? req.query?.range);
    const bounds = parseOptionalBounds(req.query || {});
    const result = await getDangerHeatClusters({ hours, bounds });
    return res.status(200).json(result);
  } catch (error) {
    return next(error);
  }
});

module.exports = router;

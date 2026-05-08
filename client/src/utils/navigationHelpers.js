// Navigation helpers for SIARA pseudo-GPS guidance.
// The current map stack is react-leaflet (Leaflet 2D), which does not support
// real tilt or perspective camera. These helpers power a "pseudo-navigation"
// experience: heading-based marker rotation, route progress tracking,
// distance/ETA estimation, and lightweight instruction extraction from path
// geometry. For true 3D tilt, the project would need to migrate to MapLibre GL
// or Mapbox GL — the consumer code in SiaraMap is structured so the camera /
// banner / summary modules can be swapped in place when that happens.

import StraightOutlinedIcon from '@mui/icons-material/StraightOutlined';
import TurnSlightLeftOutlinedIcon from '@mui/icons-material/TurnSlightLeftOutlined';
import TurnSlightRightOutlinedIcon from '@mui/icons-material/TurnSlightRightOutlined';
import TurnLeftOutlinedIcon from '@mui/icons-material/TurnLeftOutlined';
import TurnRightOutlinedIcon from '@mui/icons-material/TurnRightOutlined';
import TurnSharpLeftOutlinedIcon from '@mui/icons-material/TurnSharpLeftOutlined';
import TurnSharpRightOutlinedIcon from '@mui/icons-material/TurnSharpRightOutlined';
import UTurnLeftOutlinedIcon from '@mui/icons-material/UTurnLeftOutlined';
import SportsScoreOutlinedIcon from '@mui/icons-material/SportsScoreOutlined';

const EARTH_RADIUS_M = 6371000;

const toRad = (degrees) => (Number(degrees) * Math.PI) / 180;
const toDeg = (radians) => (Number(radians) * 180) / Math.PI;

function asLatLng(input) {
  if (!input) return null;
  if (Array.isArray(input)) {
    const lat = Number(input[0]);
    const lng = Number(input[1]);
    return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
  }
  if (typeof input === 'object') {
    const lat = Number(input.lat ?? input[0]);
    const lng = Number(input.lng ?? input.lon ?? input[1]);
    return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
  }
  return null;
}

export function haversineDistanceMeters(a, b) {
  const pa = asLatLng(a);
  const pb = asLatLng(b);
  if (!pa || !pb) return 0;
  const dLat = toRad(pb.lat - pa.lat);
  const dLng = toRad(pb.lng - pa.lng);
  const lat1 = toRad(pa.lat);
  const lat2 = toRad(pb.lat);
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h = sinLat * sinLat + Math.cos(lat1) * Math.cos(lat2) * sinLng * sinLng;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function bearingDegrees(from, to) {
  const a = asLatLng(from);
  const b = asLatLng(to);
  if (!a || !b) return 0;
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const dLng = toRad(b.lng - a.lng);
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2)
    - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  const bearing = (toDeg(Math.atan2(y, x)) + 360) % 360;
  return bearing;
}

export function compassDirectionFromBearing(bearing) {
  const value = ((Number(bearing) % 360) + 360) % 360;
  if (value < 22.5 || value >= 337.5) return 'north';
  if (value < 67.5) return 'northeast';
  if (value < 112.5) return 'east';
  if (value < 157.5) return 'southeast';
  if (value < 202.5) return 'south';
  if (value < 247.5) return 'southwest';
  if (value < 292.5) return 'west';
  return 'northwest';
}

function turnTypeFromDelta(deltaDeg) {
  // delta normalized into [-180, 180]
  let delta = Number(deltaDeg);
  if (!Number.isFinite(delta)) return 'continue';
  delta = ((delta + 540) % 360) - 180;
  const abs = Math.abs(delta);
  if (abs < 20) return 'continue';
  if (abs < 60) return delta < 0 ? 'slightLeft' : 'slightRight';
  if (abs < 130) return delta < 0 ? 'left' : 'right';
  if (abs < 175) return delta < 0 ? 'sharpLeft' : 'sharpRight';
  return 'uTurn';
}

const TURN_LABELS = {
  continue: 'Continue straight',
  slightLeft: 'Bear left',
  slightRight: 'Bear right',
  left: 'Turn left',
  right: 'Turn right',
  sharpLeft: 'Sharp left',
  sharpRight: 'Sharp right',
  uTurn: 'Make a U-turn',
};

const TURN_ICONS = {
  continue: StraightOutlinedIcon,
  slightLeft: TurnSlightLeftOutlinedIcon,
  slightRight: TurnSlightRightOutlinedIcon,
  left: TurnLeftOutlinedIcon,
  right: TurnRightOutlinedIcon,
  sharpLeft: TurnSharpLeftOutlinedIcon,
  sharpRight: TurnSharpRightOutlinedIcon,
  uTurn: UTurnLeftOutlinedIcon,
};

function normalizePath(rawPath) {
  if (!Array.isArray(rawPath)) return [];
  return rawPath
    .map((point) => {
      if (Array.isArray(point) && point.length >= 2) {
        const lat = Number(point[0]);
        const lng = Number(point[1]);
        return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
      }
      if (point && typeof point === 'object') {
        const lat = Number(point.lat);
        const lng = Number(point.lng);
        return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
      }
      return null;
    })
    .filter(Boolean);
}

export function pathLengthMeters(path) {
  const points = normalizePath(path);
  let total = 0;
  for (let i = 1; i < points.length; i += 1) {
    total += haversineDistanceMeters(points[i - 1], points[i]);
  }
  return total;
}

// Find the closest point on a polyline to a given location.
// Returns { index, projection: {lat,lng}, distanceFromStartM, distanceToPathM }
export function nearestPointOnPath(target, rawPath) {
  const points = normalizePath(rawPath);
  const point = asLatLng(target);
  if (!point || points.length === 0) return null;
  if (points.length === 1) {
    return {
      index: 0,
      projection: points[0],
      distanceFromStartM: 0,
      distanceToPathM: haversineDistanceMeters(point, points[0]),
    };
  }

  let bestIndex = 0;
  let bestProjection = points[0];
  let bestDistance = haversineDistanceMeters(point, points[0]);
  let bestDistanceFromStart = 0;
  let cumulative = 0;

  for (let i = 1; i < points.length; i += 1) {
    const a = points[i - 1];
    const b = points[i];
    const segLen = haversineDistanceMeters(a, b);
    if (segLen === 0) {
      cumulative += segLen;
      continue;
    }

    // Linear projection in lat/lng space (good enough at city scale).
    const ax = a.lng;
    const ay = a.lat;
    const bx = b.lng;
    const by = b.lat;
    const px = point.lng;
    const py = point.lat;
    const dx = bx - ax;
    const dy = by - ay;
    const denom = dx * dx + dy * dy;
    let t = denom > 0 ? ((px - ax) * dx + (py - ay) * dy) / denom : 0;
    if (t < 0) t = 0;
    if (t > 1) t = 1;
    const projection = { lat: ay + t * dy, lng: ax + t * dx };
    const distance = haversineDistanceMeters(point, projection);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = i - 1;
      bestProjection = projection;
      bestDistanceFromStart = cumulative + segLen * t;
    }
    cumulative += segLen;
  }

  return {
    index: bestIndex,
    projection: bestProjection,
    distanceFromStartM: bestDistanceFromStart,
    distanceToPathM: bestDistance,
  };
}

// Build a lightweight set of navigation steps from a path by detecting
// direction changes at vertices. Each step has: position, instruction,
// distanceFromStartM, bearing.
export function deriveStepsFromPath(rawPath, { thresholdDeg = 25 } = {}) {
  const points = normalizePath(rawPath);
  if (points.length < 2) return [];

  const totalLen = pathLengthMeters(points);
  const steps = [];
  let cumulative = 0;
  const initialBearing = bearingDegrees(points[0], points[1]);
  steps.push({
    index: 0,
    position: points[0],
    distanceFromStartM: 0,
    distanceFromPreviousM: 0,
    bearing: initialBearing,
    direction: compassDirectionFromBearing(initialBearing),
    turnType: 'continue',
    instruction: `Head ${compassDirectionFromBearing(initialBearing)}`,
    icon: TURN_ICONS.continue,
  });

  let lastBearing = initialBearing;
  let lastStepDistance = 0;

  for (let i = 1; i < points.length - 1; i += 1) {
    cumulative += haversineDistanceMeters(points[i - 1], points[i]);
    const incomingBearing = bearingDegrees(points[i - 1], points[i]);
    const outgoingBearing = bearingDegrees(points[i], points[i + 1]);
    const delta = outgoingBearing - incomingBearing;
    const turnType = turnTypeFromDelta(delta);
    if (turnType !== 'continue' && Math.abs(((delta + 540) % 360) - 180) >= thresholdDeg) {
      steps.push({
        index: i,
        position: points[i],
        distanceFromStartM: cumulative,
        distanceFromPreviousM: cumulative - lastStepDistance,
        bearing: outgoingBearing,
        direction: compassDirectionFromBearing(outgoingBearing),
        turnType,
        instruction: TURN_LABELS[turnType] || 'Continue straight',
        icon: TURN_ICONS[turnType] || TURN_ICONS.continue,
      });
      lastStepDistance = cumulative;
      lastBearing = outgoingBearing;
    }
  }

  // Final "arrive" step
  cumulative = totalLen;
  steps.push({
    index: points.length - 1,
    position: points[points.length - 1],
    distanceFromStartM: cumulative,
    distanceFromPreviousM: cumulative - lastStepDistance,
    bearing: lastBearing,
    direction: compassDirectionFromBearing(lastBearing),
    turnType: 'arrive',
    instruction: 'Arrive at destination',
    icon: SportsScoreOutlinedIcon,
  });

  return steps;
}

export function findCurrentStepIndex(steps, distanceFromStartM, { lookAhead = 25 } = {}) {
  if (!Array.isArray(steps) || steps.length === 0) return -1;
  const distance = Number(distanceFromStartM) || 0;
  for (let i = 0; i < steps.length; i += 1) {
    if (steps[i].distanceFromStartM >= distance + lookAhead) {
      return Math.max(0, i);
    }
  }
  return steps.length - 1;
}

export function formatDistanceMeters(meters) {
  const value = Number(meters);
  if (!Number.isFinite(value) || value < 0) return '—';
  if (value < 50) return `${Math.round(value)} m`;
  if (value < 1000) return `${Math.round(value / 10) * 10} m`;
  if (value < 10000) return `${(value / 1000).toFixed(1)} km`;
  return `${Math.round(value / 1000)} km`;
}

export function formatDurationSeconds(seconds) {
  const value = Number(seconds);
  if (!Number.isFinite(value) || value < 0) return '—';
  if (value < 60) return `${Math.round(value)} s`;
  const minutes = Math.round(value / 60);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;
  return remaining > 0 ? `${hours}h ${remaining}m` : `${hours}h`;
}

export function formatClockTime(date) {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// Compute progress for a route relative to the user's current location.
export function computeRouteProgress(userPosition, route) {
  const path =
    Array.isArray(route?.path) && route.path.length >= 2
      ? route.path
      : Array.isArray(route?.geometry?.coordinates)
        ? route.geometry.coordinates.map((c) =>
            Array.isArray(c) && c.length >= 2 ? [Number(c[1]), Number(c[0])] : null,
          ).filter(Boolean)
        : [];
  if (path.length < 2) return null;

  const totalDistanceM = pathLengthMeters(path);
  const totalDurationMin = Number(route?.duration_min);
  const totalDurationSeconds = Number.isFinite(totalDurationMin)
    ? totalDurationMin * 60
    : null;

  const projection = nearestPointOnPath(userPosition, path);
  if (!projection) return null;

  const distanceFromStartM = projection.distanceFromStartM;
  const distanceRemainingM = Math.max(0, totalDistanceM - distanceFromStartM);
  const fraction = totalDistanceM > 0 ? distanceFromStartM / totalDistanceM : 0;
  const remainingFraction = Math.max(0, 1 - fraction);
  const etaSeconds = totalDurationSeconds != null
    ? totalDurationSeconds * remainingFraction
    : null;

  return {
    totalDistanceM,
    totalDurationSeconds,
    distanceFromStartM,
    distanceRemainingM,
    fraction,
    remainingFraction,
    etaSeconds,
    projection: projection.projection,
    distanceOffPathM: projection.distanceToPathM,
    pathPoints: path,
  };
}

export const NAVIGATION_TURN_LABELS = TURN_LABELS;
export const NAVIGATION_TURN_ICONS = TURN_ICONS;

// ---------------------------------------------------------------------------
// Current-segment detection helpers
//
// In MapLibre navigation mode we want SIARA to figure out, on its own, which
// piece of the *selected* route the user is currently driving on so the
// segment risk card can update without a click. These helpers do that purely
// in geometry (no backend), so they work on every position update without
// network noise.
// ---------------------------------------------------------------------------

// Distance from `point` to the line segment (a, b), in meters. Uses a small
// equirectangular projection so the math is fast and good enough at city
// scale (the same trick `nearestPointOnPath` uses).
export function getDistancePointToSegmentMeters(point, segmentStart, segmentEnd) {
  const p = asLatLng(point);
  const a = asLatLng(segmentStart);
  const b = asLatLng(segmentEnd);
  if (!p || !a || !b) return Infinity;
  const ax = a.lng;
  const ay = a.lat;
  const bx = b.lng;
  const by = b.lat;
  const px = p.lng;
  const py = p.lat;
  const dx = bx - ax;
  const dy = by - ay;
  const denom = dx * dx + dy * dy;
  let t = denom > 0 ? ((px - ax) * dx + (py - ay) * dy) / denom : 0;
  if (t < 0) t = 0;
  if (t > 1) t = 1;
  const projection = { lat: ay + t * dy, lng: ax + t * dx };
  return haversineDistanceMeters(p, projection);
}

// Closest distance from `point` to a polyline (any number of vertices).
export function getDistancePointToPolylineMeters(point, path) {
  const points = normalizePath(path);
  if (points.length === 0) return Infinity;
  if (points.length === 1) return haversineDistanceMeters(point, points[0]);
  let best = Infinity;
  for (let i = 1; i < points.length; i += 1) {
    const distance = getDistancePointToSegmentMeters(point, points[i - 1], points[i]);
    if (distance < best) best = distance;
  }
  return best;
}

// Find the closest segment in selectedRoute.segments to the user. We treat
// each entry of `segments` as a polyline (segment.path) — the route splits
// itself into per-risk slices, so each segment is the natural unit the UI
// already renders. Returns { segment, segmentIndex, distanceM } or null.
export function findClosestRouteSegment(userLocation, segments) {
  const user = asLatLng(userLocation);
  if (!user || !Array.isArray(segments) || segments.length === 0) return null;
  let best = null;
  for (let i = 0; i < segments.length; i += 1) {
    const segment = segments[i];
    const path = Array.isArray(segment?.path) ? segment.path : [];
    if (path.length < 2) continue;
    const distance = getDistancePointToPolylineMeters(user, path);
    if (best == null || distance < best.distanceM) {
      best = { segment, segmentIndex: i, distanceM: distance };
    }
  }
  return best;
}

// Decide whether the user is "on" a segment of the selected route. If the
// closest segment is within `thresholdMeters`, return it; otherwise null.
// This is the public entry point the UI consumes.
export function getCurrentSegmentForUser(userLocation, selectedRoute, thresholdMeters = 80) {
  if (!selectedRoute) return null;
  const segments = Array.isArray(selectedRoute.segments) ? selectedRoute.segments : [];
  const closest = findClosestRouteSegment(userLocation, segments);
  if (!closest) return null;
  const limit = Number.isFinite(Number(thresholdMeters))
    ? Number(thresholdMeters)
    : 80;
  if (closest.distanceM > limit) return null;
  return closest;
}

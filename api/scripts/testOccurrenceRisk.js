#!/usr/bin/env node
/**
 * Manual test cases for the SIARA occurrence-risk prototype.
 * These tests exercise the pure rule-fusion / multiplier helpers
 * (no DB writes), so they can run without the Flask service or PostGIS data.
 *
 * Run:
 *     node scripts/testOccurrenceRisk.js
 */

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const {
  calculateGlobalOccurrenceScore,
  driverMultiplierFromProfile,
  riskLevelFromScore,
  canViewOccurrenceRisk,
} = require("../services/occurrenceRiskService");

function colour(text, code) {
  if (!process.stdout.isTTY) return text;
  return `\x1b[${code}m${text}\x1b[0m`;
}

let passed = 0;
let failed = 0;
function assert(name, condition, detail = "") {
  if (condition) {
    passed += 1;
    console.log(`${colour("PASS", 32)} ${name}${detail ? ` — ${detail}` : ""}`);
  } else {
    failed += 1;
    console.log(`${colour("FAIL", 31)} ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

function clamp(value) {
  return Math.max(0.01, Math.min(0.99, value));
}

// --- Case 1: normal weather, no reports/alerts/history, no driver quiz ----
const case1 = calculateGlobalOccurrenceScore({
  timeBucket: new Date("2026-04-29T11:00:00Z"),
  weather: { visibility_km: 12, precipitation_mm: 0, wind_kmh: 8 },
  roadFeatures: { road_class: "residential" },
  context: {},
});
const case1Personalized = clamp(case1.score * driverMultiplierFromProfile(null).multiplier);
assert(
  "Case 1 — quiet baseline keeps risk in 'low' band",
  riskLevelFromScore(case1.score) === "low",
  `score=${case1.score.toFixed(4)}`,
);
assert(
  "Case 1 — no quiz means personalized equals global",
  Math.abs(case1Personalized - case1.score) < 0.0001,
  `personalized=${case1Personalized.toFixed(4)}`,
);

// --- Case 2: bad weather, junction, recent verified reports ---------------
const case2 = calculateGlobalOccurrenceScore({
  timeBucket: new Date("2026-04-29T18:00:00Z"),
  weather: { visibility_km: 0.6, precipitation_mm: 8, wind_kmh: 50 },
  roadFeatures: { road_class: "primary", junction_flag: true, urban_flag: true, maxspeed: 90 },
  context: {
    reports_2h: 2,
    reports_24h: 4,
    verified_reports_24h: 2,
    active_alerts: 1,
    accidents_30d: 3,
  },
});
assert(
  "Case 2 — bad weather + junction + reports raises risk above moderate",
  case2.score > case1.score && riskLevelFromScore(case2.score) !== "low",
  `score=${case2.score.toFixed(4)} level=${riskLevelFromScore(case2.score)}`,
);

// --- Case 3: same scenario, user with high driver-quiz score --------------
const highDriverProfile = { latestRiskScore: 80, latestResultLabel: "high_risk" };
const highDriver = driverMultiplierFromProfile(highDriverProfile);
const case3Personalized = clamp(case2.score * highDriver.multiplier);
assert(
  "Case 3 — high-risk driver multiplier > 1.0",
  highDriver.multiplier > 1.0,
  `multiplier=${highDriver.multiplier}`,
);
assert(
  "Case 3 — personalized >= global (clamped at 0.99)",
  case3Personalized + 1e-6 >= case2.score || case3Personalized === 0.99,
  `personalized=${case3Personalized.toFixed(4)} global=${case2.score.toFixed(4)}`,
);

// --- Case 4: same scenario, user with low driver-quiz score --------------
const lowDriverProfile = { latestRiskScore: 10, latestResultLabel: "low_risk" };
const lowDriver = driverMultiplierFromProfile(lowDriverProfile);
const case4Personalized = clamp(case2.score * lowDriver.multiplier);
assert(
  "Case 4 — low-risk driver multiplier < 1.0",
  lowDriver.multiplier < 1.0,
  `multiplier=${lowDriver.multiplier}`,
);
assert(
  "Case 4 — personalized < global (slightly lower)",
  case4Personalized < case2.score,
  `personalized=${case4Personalized.toFixed(4)} global=${case2.score.toFixed(4)}`,
);

// --- Cases 5/6/7: access control -----------------------------------------
const owner = { userId: "u1", roles: ["citizen"] };
const otherCitizen = { userId: "u2", roles: ["citizen"] };
const policeUser = { userId: "p1", roles: ["police"] };
const policeOfficerUser = { userId: "p2", roles: ["police_officer"] };
const adminUser = { userId: "a1", roles: ["admin"] };

assert(
  "Case 5 — normal user blocked from another user's occurrence risk",
  canViewOccurrenceRisk(otherCitizen, "u1") === false,
);
assert(
  "Case 5b — owner can view their own occurrence risk",
  canViewOccurrenceRisk(owner, "u1") === true,
);
assert(
  "Case 6 — police can view a user's occurrence risk",
  canViewOccurrenceRisk(policeUser, "u1") === true && canViewOccurrenceRisk(policeOfficerUser, "u1") === true,
);
assert(
  "Case 7 — admin can view a user's occurrence risk",
  canViewOccurrenceRisk(adminUser, "u1") === true,
);

console.log(`\n${passed} passed, ${failed} failed.`);
process.exit(failed === 0 ? 0 : 1);

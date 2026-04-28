const pool = require("../db");

const MODEL_NAME = "siara_occurrence_rule_fusion";
const MODEL_VERSION_TAG = "occurrence_v1_rule_fusion";
const MODEL_TARGET_TYPE = "accident_occurrence";
const MODEL_ALGORITHM = "rule_fusion";
const MODEL_FEATURE_SET = "segment_time_context_driver_optional";
const MODEL_ARTIFACT_PATH = "internal://rule-fusion/occurrence_v1";
const MODEL_DATA_SOURCE = "SIARA_DB";
const PROTOTYPE_WARNING =
  "Prototype occurrence score. This is not yet a trained calibrated occurrence probability.";

const SCORE_MIN = 0.01;
const SCORE_MAX = 0.99;

const DEV_LOGS_ENABLED = (process.env.NODE_ENV || "development") !== "production";

function logOccurrence(event, details = {}) {
  if (DEV_LOGS_ENABLED) {
    console.info("[occurrence-risk]", event, details);
  }
}

function safeNumber(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function clampScore(value) {
  if (!Number.isFinite(value)) return SCORE_MIN;
  return Math.max(SCORE_MIN, Math.min(SCORE_MAX, value));
}

function riskLevelFromScore(score) {
  const numeric = Number(score);
  if (!Number.isFinite(numeric)) return "low";
  if (numeric < 0.25) return "low";
  if (numeric < 0.5) return "moderate";
  if (numeric < 0.75) return "high";
  return "extreme";
}

function parsePositiveBigint(value) {
  const text = String(value ?? "").trim();
  if (!/^\d+$/.test(text)) return null;
  return text;
}

function coerceTimeBucket(timeBucket) {
  const dt = timeBucket ? new Date(timeBucket) : new Date();
  if (Number.isNaN(dt.getTime())) {
    const error = new Error("Invalid timeBucket");
    error.status = 400;
    throw error;
  }
  // Bucket on minute, matching ml.risk_predictions.time_bucket convention.
  const truncated = new Date(dt);
  truncated.setUTCSeconds(0, 0);
  return truncated;
}

function isHourInRange(hour, start, end) {
  if (start <= end) return hour >= start && hour <= end;
  return hour >= start || hour <= end;
}

function applyTimeRules(timeBucket, contributions) {
  const dt = new Date(timeBucket);
  const hour = dt.getUTCHours();
  const dayOfWeek = dt.getUTCDay();
  let delta = 0;
  const reasons = [];

  if (isHourInRange(hour, 7, 9)) {
    delta += 0.06;
    reasons.push({ feature: "morning_rush_hour", impact: 0.06 });
  }
  if (isHourInRange(hour, 16, 19)) {
    delta += 0.07;
    reasons.push({ feature: "evening_rush_hour", impact: 0.07 });
  }
  if (isHourInRange(hour, 22, 5)) {
    delta += 0.05;
    reasons.push({ feature: "night_window", impact: 0.05 });
  }
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    delta += 0.03;
    reasons.push({ feature: "weekend", impact: 0.03 });
  }

  contributions.time = { delta, reasons, hour, dayOfWeek };
  return delta;
}

function applyWeatherRules(weather, contributions) {
  let delta = 0;
  const reasons = [];
  const visibility = safeNumber(weather?.visibility_km ?? weather?.visibilityKm);
  const precipitation = safeNumber(weather?.precipitation_mm ?? weather?.precipitationMm);
  const wind = safeNumber(weather?.wind_kmh ?? weather?.windKmh);

  if (visibility != null) {
    if (visibility < 1) {
      delta += 0.12;
      reasons.push({ feature: "visibility_lt_1km", impact: 0.12, value: visibility });
    } else if (visibility < 3) {
      delta += 0.08;
      reasons.push({ feature: "visibility_lt_3km", impact: 0.08, value: visibility });
    }
  }
  if (precipitation != null) {
    if (precipitation >= 5) {
      delta += 0.1;
      reasons.push({ feature: "precipitation_gte_5mm", impact: 0.1, value: precipitation });
    } else if (precipitation > 0) {
      delta += 0.05;
      reasons.push({ feature: "precipitation_present", impact: 0.05, value: precipitation });
    }
  }
  if (wind != null && wind >= 40) {
    delta += 0.05;
    reasons.push({ feature: "wind_gte_40kmh", impact: 0.05, value: wind });
  }

  contributions.weather = { delta, reasons, visibility, precipitation, wind };
  return delta;
}

function readBoolean(source, ...keys) {
  for (const key of keys) {
    const value = source?.[key];
    if (value === true || value === 1 || value === "1" || value === "true") return true;
    if (value === false || value === 0 || value === "0" || value === "false") return false;
  }
  return null;
}

function applyRoadRules(roadFeatures, contributions) {
  let delta = 0;
  const reasons = [];

  const isJunction = readBoolean(
    roadFeatures,
    "junction_flag",
    "is_junction",
    "junction",
  );
  const isRoundabout = readBoolean(
    roadFeatures,
    "roundabout_flag",
    "is_roundabout",
    "roundabout",
  );
  const isUrban = readBoolean(
    roadFeatures,
    "urban_flag",
    "is_urban",
    "urban",
  );
  const maxspeed = safeNumber(roadFeatures?.maxspeed ?? roadFeatures?.max_speed);
  const roadClass = String(roadFeatures?.road_class || "").trim().toLowerCase();

  if (isJunction) {
    delta += 0.06;
    reasons.push({ feature: "junction_flag", impact: 0.06 });
  }
  if (isRoundabout) {
    delta += 0.04;
    reasons.push({ feature: "roundabout_flag", impact: 0.04 });
  }
  if (isUrban) {
    delta += 0.03;
    reasons.push({ feature: "urban_flag", impact: 0.03 });
  }
  if (maxspeed != null) {
    if (maxspeed >= 120) {
      delta += 0.1;
      reasons.push({ feature: "maxspeed_gte_120", impact: 0.1, value: maxspeed });
    } else if (maxspeed >= 90) {
      delta += 0.07;
      reasons.push({ feature: "maxspeed_gte_90", impact: 0.07, value: maxspeed });
    }
  }
  if (roadClass === "motorway" || roadClass === "trunk") {
    delta += 0.06;
    reasons.push({ feature: "road_class_motorway_trunk", impact: 0.06, value: roadClass });
  } else if (roadClass === "primary") {
    delta += 0.04;
    reasons.push({ feature: "road_class_primary", impact: 0.04, value: roadClass });
  }

  contributions.road = { delta, reasons, isJunction, isRoundabout, isUrban, maxspeed, roadClass };
  return delta;
}

function applyContextRules(context, contributions) {
  let delta = 0;
  const reasons = [];

  const recent2h = Math.min(0.12, Number(context?.reports_2h || 0) * 0.04);
  const recent24h = Math.min(0.1, Number(context?.reports_24h || 0) * 0.015);
  const verified24h = Math.min(0.1, Number(context?.verified_reports_24h || 0) * 0.05);
  const spamPenalty = Math.min(0.06, Number(context?.spam_reports_24h || 0) * 0.02);
  const alerts = Math.min(0.15, Number(context?.active_alerts || 0) * 0.08);
  const accidents30 = Math.min(0.14, Number(context?.accidents_30d || 0) * 0.03);
  const accidents365 = Math.min(0.12, Number(context?.accidents_365d || 0) * 0.005);

  if (recent2h > 0) {
    delta += recent2h;
    reasons.push({ feature: "reports_2h", impact: recent2h, count: context?.reports_2h });
  }
  if (recent24h > 0) {
    delta += recent24h;
    reasons.push({ feature: "reports_24h", impact: recent24h, count: context?.reports_24h });
  }
  if (verified24h > 0) {
    delta += verified24h;
    reasons.push({
      feature: "verified_reports_24h",
      impact: verified24h,
      count: context?.verified_reports_24h,
    });
  }
  if (spamPenalty > 0) {
    delta -= spamPenalty;
    reasons.push({
      feature: "spam_reports_24h",
      impact: -spamPenalty,
      count: context?.spam_reports_24h,
    });
  }
  if (alerts > 0) {
    delta += alerts;
    reasons.push({ feature: "active_operational_alerts", impact: alerts, count: context?.active_alerts });
  }
  if (accidents30 > 0) {
    delta += accidents30;
    reasons.push({ feature: "accidents_30d", impact: accidents30, count: context?.accidents_30d });
  }
  if (accidents365 > 0) {
    delta += accidents365;
    reasons.push({ feature: "accidents_365d", impact: accidents365, count: context?.accidents_365d });
  }

  const avgSeverity = safeNumber(context?.avg_historical_severity);
  if (avgSeverity != null) {
    if (avgSeverity >= 3) {
      delta += 0.06;
      reasons.push({ feature: "avg_historical_severity_gte_3", impact: 0.06, value: avgSeverity });
    } else if (avgSeverity >= 2) {
      delta += 0.03;
      reasons.push({ feature: "avg_historical_severity_gte_2", impact: 0.03, value: avgSeverity });
    }
  }

  contributions.context = { delta, reasons, summary: { ...context } };
  return delta;
}

function calculateGlobalOccurrenceScore({
  timeBucket,
  weather = null,
  roadFeatures = null,
  context = null,
}) {
  const contributions = {};
  let score = 0.08;
  contributions.baseline = 0.08;
  score += applyTimeRules(timeBucket, contributions);
  score += applyWeatherRules(weather || {}, contributions);
  score += applyRoadRules(roadFeatures || {}, contributions);
  score += applyContextRules(context || {}, contributions);

  const clamped = clampScore(score);
  contributions.raw_score = Number(score.toFixed(4));
  contributions.clamped_score = Number(clamped.toFixed(4));
  return { score: clamped, contributions };
}

function driverMultiplierFromProfile(profile) {
  if (!profile || profile.latestRiskScore == null) {
    return {
      multiplier: 1.0,
      normalizedDriverRisk: 0.5,
      hasProfile: false,
      reason:
        "Neutral multiplier applied because no driver quiz result is available for this user.",
    };
  }
  const numeric = Number(profile.latestRiskScore);
  if (!Number.isFinite(numeric)) {
    return {
      multiplier: 1.0,
      normalizedDriverRisk: 0.5,
      hasProfile: false,
      reason: "Neutral multiplier applied because driver quiz risk score is invalid.",
    };
  }
  const normalized = Math.max(0, Math.min(1, numeric / 100));
  const multiplier = 0.85 + normalized * 0.4;
  return {
    multiplier: Number(multiplier.toFixed(4)),
    normalizedDriverRisk: Number(normalized.toFixed(4)),
    hasProfile: true,
    reason: `Driver quiz risk score ${Math.round(numeric)}/100 mapped to multiplier ${multiplier.toFixed(2)}.`,
  };
}

async function loadRoadSegment(client, roadSegmentId) {
  const result = await client.query(
    `
      select
        id,
        coalesce(road_class, '') as road_class,
        to_jsonb(rs.*) as raw
      from gis.road_segments rs
      where id = $1
      limit 1
    `,
    [roadSegmentId],
  );
  if (result.rowCount === 0) return null;
  const row = result.rows[0];
  const raw = row.raw || {};
  return {
    id: String(row.id),
    road_class: row.road_class || raw.road_class || null,
    junction_flag: raw.junction_flag ?? raw.is_junction ?? raw.junction ?? null,
    roundabout_flag: raw.roundabout_flag ?? raw.is_roundabout ?? raw.roundabout ?? null,
    urban_flag: raw.urban_flag ?? raw.is_urban ?? raw.urban ?? null,
    maxspeed: raw.maxspeed ?? raw.max_speed ?? null,
  };
}

async function loadSegmentTimeFeatures(client, roadSegmentId, timeBucket) {
  try {
    const result = await client.query(
      `
        select to_jsonb(stf.*) as features
        from ml.segment_time_features stf
        where stf.road_segment_id = $1
          and stf.time_bucket = date_trunc('minute', $2::timestamptz)
        order by stf.id desc
        limit 1
      `,
      [roadSegmentId, new Date(timeBucket).toISOString()],
    );
    return result.rows[0]?.features || null;
  } catch (error) {
    logOccurrence("segment_time_features_unavailable", {
      message: error?.message,
      code: error?.code,
    });
    return null;
  }
}

async function loadContextSignals(client, roadSegmentId, timeBucket) {
  const isoTime = new Date(timeBucket).toISOString();
  const fallback = {
    reports_2h: 0,
    reports_24h: 0,
    verified_reports_24h: 0,
    spam_reports_24h: 0,
    active_alerts: 0,
    accidents_30d: 0,
    accidents_365d: 0,
    avg_historical_severity: null,
  };

  try {
    const reports = await client.query(
      `
        with seg as (
          select geom from gis.road_segments where id = $1 limit 1
        )
        select
          count(*) filter (
            where ar.created_at >= $2::timestamptz - interval '2 hours'
          )::int as reports_2h,
          count(*) filter (
            where ar.created_at >= $2::timestamptz - interval '24 hours'
          )::int as reports_24h,
          count(*) filter (
            where ar.created_at >= $2::timestamptz - interval '24 hours'
              and (
                ar.status = 'verified'
                or ar.review_verdict = 'confirmed_legit'
                or ar.verified_by_officer_id is not null
              )
          )::int as verified_reports_24h,
          count(*) filter (
            where ar.created_at >= $2::timestamptz - interval '24 hours'
              and (
                ar.latest_predicted_label = 'spam'
                or ar.review_verdict = 'confirmed_spam'
              )
          )::int as spam_reports_24h
        from app.accident_reports ar, seg
        where ar.incident_location is not null
          and ST_DWithin(
            ar.incident_location,
            seg.geom::geography,
            300
          )
      `,
      [roadSegmentId, isoTime],
    );
    const row = reports.rows[0] || {};
    fallback.reports_2h = Number(row.reports_2h || 0);
    fallback.reports_24h = Number(row.reports_24h || 0);
    fallback.verified_reports_24h = Number(row.verified_reports_24h || 0);
    fallback.spam_reports_24h = Number(row.spam_reports_24h || 0);
  } catch (error) {
    logOccurrence("reports_context_unavailable", { message: error?.message });
  }

  try {
    const accidents = await client.query(
      `
        with seg as (
          select geom from gis.road_segments where id = $1 limit 1
        )
        select
          count(*) filter (where ae.event_time >= $2::timestamptz - interval '30 days')::int
            as accidents_30d,
          count(*) filter (where ae.event_time >= $2::timestamptz - interval '365 days')::int
            as accidents_365d,
          avg(case when ae.event_time >= $2::timestamptz - interval '365 days' then ae.severity end)
            as avg_severity
        from gis.accident_events ae, seg
        where ae.location is not null
          and ST_DWithin(ae.location::geography, seg.geom::geography, 300)
      `,
      [roadSegmentId, isoTime],
    );
    const row = accidents.rows[0] || {};
    fallback.accidents_30d = Number(row.accidents_30d || 0);
    fallback.accidents_365d = Number(row.accidents_365d || 0);
    if (row.avg_severity != null) {
      fallback.avg_historical_severity = Number(row.avg_severity);
    }
  } catch (error) {
    logOccurrence("accident_history_unavailable", { message: error?.message });
  }

  try {
    const alerts = await client.query(
      `
        with seg as (
          select geom from gis.road_segments where id = $1 limit 1
        )
        select count(distinct oa.id)::int as active_alerts
        from app.operational_alerts oa
        left join gis.admin_areas aa on aa.id = oa.admin_area_id
        cross join seg
        where lower(coalesce(oa.status, '')) = 'active'
          and (oa.starts_at is null or oa.starts_at <= $2::timestamptz)
          and (oa.ends_at is null or oa.ends_at >= $2::timestamptz)
          and (
            aa.geom is null
            or ST_Intersects(aa.geom, seg.geom)
          )
      `,
      [roadSegmentId, isoTime],
    );
    fallback.active_alerts = Number(alerts.rows[0]?.active_alerts || 0);
  } catch (error) {
    logOccurrence("operational_alerts_unavailable", { message: error?.message });
  }

  return fallback;
}

async function loadDriverProfile(client, userId) {
  if (!userId) return null;
  try {
    const result = await client.query(
      `
        select
          user_id,
          latest_attempt_id,
          latest_risk_score,
          latest_result_label,
          latest_result_title,
          latest_result_description,
          latest_recommendation_description,
          category_scores,
          last_completed_at
        from app.user_driver_quiz_profile
        where user_id = $1
        limit 1
      `,
      [userId],
    );
    if (result.rowCount === 0) return null;
    const row = result.rows[0];
    return {
      userId: row.user_id,
      latestAttemptId: row.latest_attempt_id,
      latestRiskScore: row.latest_risk_score == null ? null : Number(row.latest_risk_score),
      latestResultLabel: row.latest_result_label,
      latestResultTitle: row.latest_result_title,
      latestResultDescription: row.latest_result_description,
      latestRecommendationDescription: row.latest_recommendation_description,
      categoryScores: row.category_scores || {},
      lastCompletedAt: row.last_completed_at,
    };
  } catch (error) {
    logOccurrence("driver_profile_unavailable", { message: error?.message });
    return null;
  }
}

async function ensureModelVersionId(client) {
  const select = await client.query(
    `
      select id
      from ml.model_versions
      where model_name = $1
        and target_type = $2
      order by created_at desc
      limit 1
    `,
    [MODEL_NAME, MODEL_TARGET_TYPE],
  );
  if (select.rowCount > 0) {
    return select.rows[0].id;
  }
  const insert = await client.query(
    `
      insert into ml.model_versions (
        model_name,
        target_type,
        algorithm,
        feature_set_name,
        data_source,
        calibration_method,
        artifact_path,
        status,
        is_active,
        created_at
      )
      values ($1, $2, $3, $4, $5, 'not_calibrated', $6, 'active', true, now())
      returning id
    `,
    [
      MODEL_NAME,
      MODEL_TARGET_TYPE,
      MODEL_ALGORITHM,
      MODEL_FEATURE_SET,
      MODEL_DATA_SOURCE,
      MODEL_ARTIFACT_PATH,
    ],
  );
  return insert.rows[0].id;
}

async function persistGlobalPrediction(
  client,
  { roadSegmentId, timeBucket, score, contributions, modelVersionId },
) {
  const featureRow = await client.query(
    `
      select id
      from ml.segment_time_features
      where road_segment_id = $1
        and time_bucket = date_trunc('minute', $2::timestamptz)
      order by id desc
      limit 1
    `,
    [roadSegmentId, new Date(timeBucket).toISOString()],
  );
  const featureId = featureRow.rows[0]?.id || null;
  const riskLevel = riskLevelFromScore(score);
  const globalScoreRounded = Number(score.toFixed(4));
  const confidenceScore = 0.5;

  console.log("[occurrence-risk] persisting global prediction", {
    roadSegmentId,
    timeBucket: new Date(timeBucket).toISOString(),
    globalScore: globalScoreRounded,
    globalRiskLevel: riskLevel,
    sourceType: "live",
    algorithm: MODEL_ALGORITHM,
  });

  // Prototype occurrence model: do NOT store a calibrated probability — this
  // is a rule-fusion score, not a calibrated trained probability. Use the
  // existing "live" source_type per the ml.risk_predictions check constraint;
  // the rule_fusion identity lives on the model_versions row instead.
  const insert = await client.query(
    `
      insert into ml.risk_predictions (
        road_segment_id,
        model_version_id,
        feature_id,
        time_bucket,
        risk_score,
        risk_level,
        calibrated_probability,
        confidence_score,
        drift_flag,
        source_type,
        status,
        warning_message,
        predicted_at
      )
      values (
        $1, $2, $3,
        date_trunc('minute', $4::timestamptz),
        $5, $6, NULL, $7, false, 'live', 'active', $8, now()
      )
      on conflict (road_segment_id, time_bucket, model_version_id)
      do update set
        feature_id = excluded.feature_id,
        risk_score = excluded.risk_score,
        risk_level = excluded.risk_level,
        calibrated_probability = NULL,
        confidence_score = excluded.confidence_score,
        drift_flag = false,
        source_type = excluded.source_type,
        status = excluded.status,
        warning_message = excluded.warning_message,
        predicted_at = now()
      returning id
    `,
    [
      roadSegmentId,
      modelVersionId,
      featureId,
      new Date(timeBucket).toISOString(),
      globalScoreRounded,
      riskLevel,
      confidenceScore,
      PROTOTYPE_WARNING,
    ],
  );
  return { predictionId: insert.rows[0]?.id || null, riskLevel, featureId };
}

async function persistPersonalizedPrediction(
  client,
  {
    userId,
    roadSegmentId,
    timeBucket,
    globalPredictionId,
    globalScore,
    globalRiskLevel,
    personalizedScore,
    personalizedRiskLevel,
    driverProfile,
    explanation,
  },
) {
  const result = await client.query(
    `
      insert into app.user_occurrence_risk_predictions (
        user_id,
        road_segment_id,
        global_prediction_id,
        time_bucket,
        global_occurrence_score,
        personalized_occurrence_score,
        global_risk_level,
        personalized_risk_level,
        driver_risk_score,
        driver_result_label,
        driver_category_scores,
        explanation,
        model_version,
        created_at
      )
      values (
        $1, $2, $3,
        date_trunc('minute', $4::timestamptz),
        $5, $6, $7, $8, $9, $10, $11::jsonb, $12::jsonb, $13, now()
      )
      on conflict (user_id, road_segment_id, time_bucket, model_version)
      do update set
        global_prediction_id = excluded.global_prediction_id,
        global_occurrence_score = excluded.global_occurrence_score,
        personalized_occurrence_score = excluded.personalized_occurrence_score,
        global_risk_level = excluded.global_risk_level,
        personalized_risk_level = excluded.personalized_risk_level,
        driver_risk_score = excluded.driver_risk_score,
        driver_result_label = excluded.driver_result_label,
        driver_category_scores = excluded.driver_category_scores,
        explanation = excluded.explanation,
        created_at = now()
      returning id, created_at
    `,
    [
      userId,
      roadSegmentId,
      globalPredictionId,
      new Date(timeBucket).toISOString(),
      Number(globalScore.toFixed(4)),
      Number(personalizedScore.toFixed(4)),
      globalRiskLevel,
      personalizedRiskLevel,
      driverProfile?.latestRiskScore ?? null,
      driverProfile?.latestResultLabel ?? null,
      JSON.stringify(driverProfile?.categoryScores || {}),
      JSON.stringify(explanation || {}),
      MODEL_VERSION_TAG,
    ],
  );
  return result.rows[0] || null;
}

async function predictOccurrenceRiskForSegment({
  userId = null,
  roadSegmentId,
  timeBucket,
  weather = null,
  roadFeaturesOverride = null,
  contextOverride = null,
  persist = true,
  db = pool,
} = {}) {
  const segmentIdText = parsePositiveBigint(roadSegmentId);
  if (!segmentIdText) {
    const error = new Error("roadSegmentId must be a positive integer");
    error.status = 400;
    throw error;
  }
  const truncatedTime = coerceTimeBucket(timeBucket);

  const useTransaction = persist && db === pool;
  const client = useTransaction ? await db.connect() : db;

  try {
    if (useTransaction) await client.query("begin");

    const segment = await loadRoadSegment(client, segmentIdText);
    if (!segment) {
      const error = new Error("road segment not found");
      error.status = 404;
      throw error;
    }

    const featureRow = await loadSegmentTimeFeatures(client, segmentIdText, truncatedTime);
    const roadFeatures = {
      ...segment,
      ...(featureRow || {}),
      ...(roadFeaturesOverride || {}),
    };
    const effectiveWeather = weather || (featureRow ? {
      visibility_km: featureRow.visibility_km ?? featureRow.visibility,
      precipitation_mm: featureRow.precipitation_mm ?? featureRow.precipitation,
      wind_kmh: featureRow.wind_kmh ?? featureRow.wind_speed_kmh,
    } : null);

    const context = contextOverride
      ? contextOverride
      : await loadContextSignals(client, segmentIdText, truncatedTime);

    const driverProfile = await loadDriverProfile(client, userId);
    const driver = driverMultiplierFromProfile(driverProfile);

    const { score: globalScore, contributions } = calculateGlobalOccurrenceScore({
      timeBucket: truncatedTime,
      weather: effectiveWeather,
      roadFeatures,
      context,
    });
    const personalizedScore = clampScore(globalScore * driver.multiplier);
    const globalRiskLevel = riskLevelFromScore(globalScore);
    const personalizedRiskLevel = riskLevelFromScore(personalizedScore);

    const explanation = {
      model_version: MODEL_VERSION_TAG,
      warning: PROTOTYPE_WARNING,
      time: contributions.time,
      weather: contributions.weather,
      road: contributions.road,
      context: contributions.context,
      baseline: contributions.baseline,
      raw_score: contributions.raw_score,
      clamped_score: contributions.clamped_score,
      driver_behavior: driver,
    };

    let globalPredictionId = null;
    let modelVersionId = null;
    let savedPersonalized = null;
    if (persist) {
      modelVersionId = await ensureModelVersionId(client);
      const globalSaved = await persistGlobalPrediction(client, {
        roadSegmentId: segmentIdText,
        timeBucket: truncatedTime,
        score: globalScore,
        contributions,
        modelVersionId,
      });
      globalPredictionId = globalSaved.predictionId;

      if (userId) {
        savedPersonalized = await persistPersonalizedPrediction(client, {
          userId,
          roadSegmentId: segmentIdText,
          timeBucket: truncatedTime,
          globalPredictionId,
          globalScore,
          globalRiskLevel,
          personalizedScore,
          personalizedRiskLevel,
          driverProfile,
          explanation,
        });
      }
    }

    if (useTransaction) await client.query("commit");

    logOccurrence("predicted", {
      roadSegmentId: segmentIdText,
      userId: userId || null,
      timeBucket: truncatedTime.toISOString(),
      globalScore: Number(globalScore.toFixed(4)),
      driverMultiplier: driver.multiplier,
      personalizedScore: Number(personalizedScore.toFixed(4)),
      modelVersion: MODEL_VERSION_TAG,
      globalPredictionId,
      hasDriverProfile: driver.hasProfile,
    });

    return {
      road_segment_id: segmentIdText,
      time_bucket: truncatedTime.toISOString(),
      global_occurrence_score: Number(globalScore.toFixed(4)),
      global_risk_level: globalRiskLevel,
      personalized_occurrence_score: Number(personalizedScore.toFixed(4)),
      personalized_risk_level: personalizedRiskLevel,
      confidence_score: 0.5,
      driver_behavior: {
        has_driver_profile: driver.hasProfile,
        latest_risk_score: driverProfile?.latestRiskScore ?? null,
        latest_result_label: driverProfile?.latestResultLabel ?? null,
        multiplier: driver.multiplier,
        normalized_driver_risk: driver.normalizedDriverRisk,
        reason: driver.reason,
      },
      explanation,
      persisted: {
        global_prediction_id: globalPredictionId,
        personalized_prediction_id: savedPersonalized?.id || null,
        model_version: MODEL_VERSION_TAG,
      },
      warning: PROTOTYPE_WARNING,
    };
  } catch (error) {
    if (useTransaction) await client.query("rollback").catch(() => {});
    throw error;
  } finally {
    if (useTransaction) client.release();
  }
}

async function listUserOccurrenceRiskHistory(userId, { limit = 20, offset = 0 } = {}, db = pool) {
  const safeLimit = Math.max(1, Math.min(100, Number(limit) || 20));
  const safeOffset = Math.max(0, Number(offset) || 0);
  const result = await db.query(
    `
      select id, road_segment_id, time_bucket, global_occurrence_score,
             personalized_occurrence_score, global_risk_level, personalized_risk_level,
             driver_risk_score, driver_result_label, model_version, created_at
      from app.user_occurrence_risk_predictions
      where user_id = $1
      order by created_at desc
      limit $2 offset $3
    `,
    [userId, safeLimit + 1, safeOffset],
  );
  const hasMore = result.rows.length > safeLimit;
  const rows = hasMore ? result.rows.slice(0, safeLimit) : result.rows;
  return {
    items: rows.map((row) => ({
      id: row.id,
      roadSegmentId: String(row.road_segment_id),
      timeBucket: row.time_bucket,
      globalOccurrenceScore: Number(row.global_occurrence_score),
      personalizedOccurrenceScore: Number(row.personalized_occurrence_score),
      globalRiskLevel: row.global_risk_level,
      personalizedRiskLevel: row.personalized_risk_level,
      driverRiskScore:
        row.driver_risk_score == null ? null : Number(row.driver_risk_score),
      driverResultLabel: row.driver_result_label,
      modelVersion: row.model_version,
      createdAt: row.created_at,
    })),
    pagination: { limit: safeLimit, offset: safeOffset, hasMore },
  };
}

function canViewOccurrenceRisk(requestUser, targetUserId) {
  if (!requestUser || !targetUserId) return false;
  const requesterId = requestUser.userId || requestUser.id;
  if (requesterId && String(requesterId) === String(targetUserId)) return true;
  const roles = Array.isArray(requestUser.roles) ? requestUser.roles : [];
  if (roles.includes("admin")) return true;
  const policeRoles = ["police", "police_officer", "police officer"];
  if (roles.some((role) => policeRoles.includes(String(role).toLowerCase()))) return true;
  return false;
}

module.exports = {
  MODEL_NAME,
  MODEL_VERSION_TAG,
  PROTOTYPE_WARNING,
  predictOccurrenceRiskForSegment,
  calculateGlobalOccurrenceScore,
  driverMultiplierFromProfile,
  riskLevelFromScore,
  listUserOccurrenceRiskHistory,
  canViewOccurrenceRisk,
};

/* eslint-disable no-console */
// Read-only database health inspector.
//
// Connects with the same config as the app (DATABASE_URL or PG* + PGSSLMODE
// from api/.env) and prints a health report: schemas, key tables + row counts,
// whether the recent migrations applied, and whether the pilot / occurrence /
// intervention features have the data they need.
//
// SAFETY: the session is forced READ ONLY, so this script physically cannot
// modify the database — every write would error. Run with:
//   cd api && node scripts/inspectDb.js
//
// To point it at the hosted DB, set in api/.env (gitignored):
//   DATABASE_URL=postgres://USER:PASSWORD@HOST:PORT/DBNAME
//   PGSSLMODE=require

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });
const { Pool } = require("pg");

// Build a pool with lenient SSL. Hosted Postgres (Aiven / Render / Supabase)
// presents a self-signed CA chain, so we accept it without a CA bundle
// (rejectUnauthorized: false) and strip sslmode from the URL so pg doesn't force
// strict verify-full over that choice. Local DBs keep PGSSLMODE semantics.
function buildPool() {
  const lenientSsl = { rejectUnauthorized: false };
  if (process.env.DATABASE_URL) {
    let conn = process.env.DATABASE_URL;
    try {
      const u = new URL(conn);
      u.searchParams.delete("sslmode");
      conn = u.toString();
    } catch { /* leave connection string as-is */ }
    return new Pool({ connectionString: conn, ssl: lenientSsl });
  }
  const sslMode = String(process.env.PGSSLMODE || "").toLowerCase();
  return new Pool({
    host: process.env.PGHOST,
    port: Number(process.env.PGPORT),
    user: process.env.PGUSER,
    password: process.env.PGPASSWORD,
    database: process.env.PGDATABASE,
    ssl: !sslMode || sslMode === "disable" || sslMode === "false" ? false : lenientSsl,
  });
}

const pool = buildPool();

const PASS = "✓";
const WARN = "⚠";
const FAIL = "✗";

function line(mark, label, detail = "") {
  console.log(`  ${mark} ${label}${detail ? ` — ${detail}` : ""}`);
}

async function main() {
  const client = await pool.connect();
  let issues = 0;
  let warnings = 0;

  // Belt-and-braces: make the whole session read only.
  await client.query("SET default_transaction_read_only = on");

  const q = async (sql, params) => (await client.query(sql, params)).rows;
  const safe = async (label, fn) => {
    try {
      return await fn();
    } catch (err) {
      issues += 1;
      line(FAIL, label, err.message);
      return null;
    }
  };

  console.log("\n=== SIARA database health (read-only) ===\n");

  // 1. Connection + PostGIS
  await safe("Connection", async () => {
    const [{ version }] = await q("SELECT version()");
    line(PASS, "Connected", version.split(",")[0]);
  });
  await safe("PostGIS extension", async () => {
    const rows = await q("SELECT extversion FROM pg_extension WHERE extname = 'postgis'");
    if (rows.length) line(PASS, "PostGIS installed", `v${rows[0].extversion}`);
    else { warnings += 1; line(WARN, "PostGIS NOT installed", "spatial queries will fail"); }
  });

  // 2. Schemas
  await safe("Schemas", async () => {
    const wanted = ["auth", "app", "gis", "ml"];
    const rows = await q(
      "SELECT schema_name FROM information_schema.schemata WHERE schema_name = ANY($1)",
      [wanted],
    );
    const present = new Set(rows.map((r) => r.schema_name));
    for (const s of wanted) {
      if (present.has(s)) line(PASS, `schema ${s}`);
      else { issues += 1; line(FAIL, `schema ${s} MISSING`); }
    }
  });

  // 3. Key tables + row counts
  console.log("\n--- Tables & row counts ---");
  const tables = [
    ["auth.users", true],
    ["app.accident_reports", true],
    ["app.zone_interventions", false],
    ["app.police_operation_history", false],
    ["gis.road_segments", true],
    ["gis.admin_areas", false],
    ["ml.model_versions", true],
    ["ml.risk_predictions", false],
  ];
  for (const [table, critical] of tables) {
    await safe(table, async () => {
      const reg = await q("SELECT to_regclass($1) AS t", [table]);
      if (!reg[0].t) {
        if (critical) { issues += 1; line(FAIL, `${table} MISSING`); }
        else { warnings += 1; line(WARN, `${table} missing`, "feature/migration not applied"); }
        return;
      }
      const [{ n }] = await q(`SELECT COUNT(*)::int AS n FROM ${table}`);
      line(n > 0 ? PASS : WARN, table, `${n} rows`);
      if (n === 0 && critical) warnings += 1;
    });
  }

  // 4. Migration checks — does zone_interventions have the new columns?
  console.log("\n--- Migration checks ---");
  await safe("zone_interventions columns", async () => {
    const reg = await q("SELECT to_regclass('app.zone_interventions') AS t");
    if (!reg[0].t) { warnings += 1; line(WARN, "zone_interventions absent", "apply 20260628 + 20260630 migrations"); return; }
    const cols = (await q(
      `SELECT column_name FROM information_schema.columns
       WHERE table_schema='app' AND table_name='zone_interventions'`,
    )).map((r) => r.column_name);
    const need = ["intervention_type", "status", "road_segment_id", "location", "visibility"];
    for (const c of need) {
      if (cols.includes(c)) line(PASS, `column ${c}`);
      else { issues += 1; line(FAIL, `column ${c} MISSING`, c === "visibility" ? "apply 20260630_intervention_visibility.sql" : "apply 20260628_zone_interventions.sql"); }
    }
  });

  await safe("accident_reports columns", async () => {
    const cols = (await q(
      `SELECT column_name FROM information_schema.columns
       WHERE table_schema='app' AND table_name='accident_reports'`,
    )).map((r) => r.column_name);
    const need = ["status", "severity_hint", "incident_location", "location_label", "verified_at", "resolved_at"];
    for (const c of need) {
      if (cols.includes(c)) line(PASS, `column ${c}`);
      else { issues += 1; line(FAIL, `column ${c} MISSING`); }
    }
  });

  // 5. Active ML model version (required at startup)
  await safe("active ml.model_versions", async () => {
    const rows = await q(
      `SELECT model_name, status FROM ml.model_versions
       WHERE is_active = true AND lower(coalesce(status,'')) IN ('deployed','active')
       ORDER BY created_at DESC LIMIT 1`,
    );
    if (rows.length) line(PASS, "active model version", `${rows[0].model_name} (${rows[0].status})`);
    else { issues += 1; line(FAIL, "no active model version", "startup logs [startup] missing_active_model_version"); }
  });

  // 6. Feature-readiness: road geometry, occurrence predictions
  console.log("\n--- Feature readiness ---");
  await safe("road_segments geometry", async () => {
    const [{ n, srid }] = await q(
      `SELECT COUNT(*)::int AS n, MAX(ST_SRID(geom)) AS srid
       FROM gis.road_segments WHERE geom IS NOT NULL`,
    );
    if (n > 0) line(PASS, "road segments with geometry", `${n} (SRID ${srid})`);
    else { issues += 1; line(FAIL, "no road geometry", "pilot spatial join + intervention centroid need this"); }
  });
  await safe("occurrence predictions", async () => {
    const reg = await q("SELECT to_regclass('ml.risk_predictions') AS t");
    if (!reg[0].t) { warnings += 1; line(WARN, "ml.risk_predictions absent"); return; }
    const [{ n, recent }] = await q(
      `SELECT COUNT(*)::int AS n,
              COUNT(*) FILTER (WHERE predicted_at >= now() - interval '30 days')::int AS recent
       FROM ml.risk_predictions`,
    );
    if (n > 0) line(recent > 0 ? PASS : WARN, "risk predictions", `${n} total, ${recent} in last 30d (pilot 'occurrence' column)`);
    else { warnings += 1; line(WARN, "no risk predictions", "pilot occurrence column will show '—'"); }
  });

  // 7. Data sanity for pilot/impact
  console.log("\n--- Reports & interventions data ---");
  await safe("report status distribution", async () => {
    const rows = await q(
      `SELECT status, COUNT(*)::int AS n FROM app.accident_reports GROUP BY status ORDER BY n DESC`,
    );
    if (!rows.length) { warnings += 1; line(WARN, "no accident reports", "pilot/impact will be empty"); return; }
    line(PASS, "report statuses", rows.map((r) => `${r.status}:${r.n}`).join("  "));
    const verified = rows.filter((r) => ["verified", "dispatched", "resolved"].includes(r.status)).reduce((s, r) => s + r.n, 0);
    if (verified === 0) { warnings += 1; line(WARN, "no verified reports", "pilot ranks by verified reports → may be empty"); }
  });
  await safe("interventions breakdown", async () => {
    const reg = await q("SELECT to_regclass('app.zone_interventions') AS t");
    if (!reg[0].t) return;
    const byStatus = await q("SELECT status, COUNT(*)::int AS n FROM app.zone_interventions GROUP BY status");
    const hasVis = (await q(
      `SELECT 1 FROM information_schema.columns WHERE table_schema='app' AND table_name='zone_interventions' AND column_name='visibility'`,
    )).length;
    const byVis = hasVis ? await q("SELECT visibility, COUNT(*)::int AS n FROM app.zone_interventions GROUP BY visibility") : [];
    const withLoc = await q(
      `SELECT COUNT(*)::int AS n FROM app.zone_interventions zi
       LEFT JOIN gis.road_segments rs ON rs.id = zi.road_segment_id
       WHERE zi.location IS NOT NULL OR rs.geom IS NOT NULL`,
    );
    line(PASS, "interventions by status", byStatus.length ? byStatus.map((r) => `${r.status}:${r.n}`).join("  ") : "none yet");
    if (hasVis) line(PASS, "interventions by visibility", byVis.length ? byVis.map((r) => `${r.visibility}:${r.n}`).join("  ") : "none yet");
    line(PASS, "interventions plottable on map", `${withLoc[0].n} have a location/segment`);
  });

  console.log("\n=== Summary ===");
  console.log(`  ${issues === 0 ? PASS : FAIL} ${issues} critical issue(s)`);
  console.log(`  ${warnings === 0 ? PASS : WARN} ${warnings} warning(s)\n`);

  client.release();
  await pool.end();
  process.exit(issues > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("\nInspector failed to run:", err.message);
  console.error("Check api/.env (DATABASE_URL / PG* + PGSSLMODE=require for hosted DBs).\n");
  process.exit(2);
});

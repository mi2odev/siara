/* eslint-disable no-console */
// Read-only connection diagnostics. Shows max_connections, how many are in use,
// by which app/user/state, and whether idle connections are piling up (a leak)
// — the cause of "remaining connection slots are reserved for ... SUPERUSER".
//
//   cd api && node scripts/inspectConnections.js

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });
const { Pool } = require("pg");

function buildPool() {
  const lenientSsl = { rejectUnauthorized: false };
  if (process.env.DATABASE_URL) {
    let conn = process.env.DATABASE_URL;
    try { const u = new URL(conn); u.searchParams.delete("sslmode"); conn = u.toString(); } catch { /* noop */ }
    return new Pool({ connectionString: conn, ssl: lenientSsl, max: 1 });
  }
  const sslMode = String(process.env.PGSSLMODE || "").toLowerCase();
  return new Pool({
    host: process.env.PGHOST, port: Number(process.env.PGPORT), user: process.env.PGUSER,
    password: process.env.PGPASSWORD, database: process.env.PGDATABASE, max: 1,
    ssl: !sslMode || sslMode === "disable" || sslMode === "false" ? false : lenientSsl,
  });
}

const pool = buildPool();

async function main() {
  const client = await pool.connect();
  await client.query("SET default_transaction_read_only = on");
  const q = async (s) => (await client.query(s)).rows;

  const max = Number((await q("SHOW max_connections"))[0].max_connections);
  const reserved = Number((await q("SHOW superuser_reserved_connections"))[0].superuser_reserved_connections);
  const total = (await q("SELECT count(*)::int n FROM pg_stat_activity"))[0].n;

  console.log("\n=== Connection usage ===");
  console.log(`  max_connections          : ${max}`);
  console.log(`  superuser_reserved       : ${reserved}`);
  console.log(`  usable by app            : ${max - reserved}`);
  console.log(`  currently in use (total) : ${total}`);
  console.log(`  headroom                 : ${max - total}`);

  console.log("\n--- By state ---");
  for (const r of await q("SELECT coalesce(state,'(null)') state, count(*)::int n FROM pg_stat_activity GROUP BY 1 ORDER BY n DESC")) {
    console.log(`  ${String(r.state).padEnd(20)} ${r.n}`);
  }

  console.log("\n--- By database ---");
  for (const r of await q("SELECT coalesce(datname,'(none)') db, count(*)::int n FROM pg_stat_activity GROUP BY 1 ORDER BY n DESC")) {
    console.log(`  ${String(r.db).padEnd(20)} ${r.n}`);
  }

  console.log("\n--- By app / user / state (top 25) ---");
  for (const r of await q(`
    SELECT coalesce(application_name,'(none)') app, usename, coalesce(state,'(null)') state, count(*)::int n
    FROM pg_stat_activity GROUP BY 1,2,3 ORDER BY n DESC LIMIT 25
  `)) {
    console.log(`  ${String(r.n).padStart(3)}  ${String(r.app).padEnd(22)} ${String(r.usename).padEnd(14)} ${r.state}`);
  }

  const idleOld = (await q("SELECT count(*)::int n FROM pg_stat_activity WHERE state='idle' AND now()-state_change > interval '5 minutes'"))[0].n;
  const idleInTx = (await q("SELECT count(*)::int n FROM pg_stat_activity WHERE state='idle in transaction'"))[0].n;
  console.log("\n--- Leak signals ---");
  console.log(`  idle > 5 min        : ${idleOld}  (connections held open but doing nothing)`);
  console.log(`  idle in transaction : ${idleInTx}  (worst kind — holds locks + a slot)`);

  console.log("\n--- Longest-idle connections (top 10) ---");
  for (const r of await q(`
    SELECT coalesce(application_name,'(none)') app, usename, coalesce(state,'(null)') state,
           date_trunc('second', now()-state_change)::text AS idle_for
    FROM pg_stat_activity
    WHERE pid <> pg_backend_pid()
    ORDER BY state_change ASC NULLS LAST LIMIT 10
  `)) {
    console.log(`  idle ${String(r.idle_for).padEnd(16)} ${String(r.app).padEnd(22)} ${r.usename} (${r.state})`);
  }
  console.log("");

  client.release();
  await pool.end();
}

main().catch((e) => { console.error("Failed:", e.message); process.exit(1); });

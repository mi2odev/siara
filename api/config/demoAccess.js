// Demo access configuration — shared by authService (provisioning + login) and
// verifytoken (read-only enforcement) so the demo identities live in ONE place.
// Leaf module: requires nothing, so it is safe to import from the auth hot path.

const DEMO_ROLE_PROFILES = {
  citizen: { roleName: "citizen", email: "demo.citizen@siara.dz", firstName: "Demo", lastName: "Citizen" },
  police: { roleName: "police", email: "demo.police@siara.dz", firstName: "Demo", lastName: "Officer" },
  supervisor: { roleName: "police_supervisor", email: "demo.supervisor@siara.dz", firstName: "Demo", lastName: "Supervisor" },
  admin: { roleName: "admin", email: "demo.admin@siara.dz", firstName: "Demo", lastName: "Admin" },
};

const DEMO_ROLE_KEYS = Object.keys(DEMO_ROLE_PROFILES);

const DEMO_ROLE_ALIASES = {
  user: "citizen",
  citizen: "citizen",
  police: "police",
  police_officer: "police",
  officer: "police",
  police_supervisor: "supervisor",
  supervisor: "supervisor",
  admin: "admin",
  administrator: "admin",
};

// Where testers are told to reach out for real-data changes.
const DEMO_CONTACT_EMAIL = "mouhamedbachir2323@gmail.com";

// Every demo account email (used to detect "is this a demo account?").
const DEMO_EMAILS = new Set(DEMO_ROLE_KEYS.map((key) => DEMO_ROLE_PROFILES[key].email.toLowerCase()));

// Read-only demo accounts: only the ADMIN demo is restricted — the citizen /
// police / supervisor demos operate on their own demo data and stay writable.
const READ_ONLY_DEMO_EMAILS = new Set([DEMO_ROLE_PROFILES.admin.email.toLowerCase()]);

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function isDemoEmail(email) {
  return DEMO_EMAILS.has(normalizeEmail(email));
}

function isReadOnlyDemoEmail(email) {
  return READ_ONLY_DEMO_EMAILS.has(normalizeEmail(email));
}

function isDemoLoginEnabled() {
  return String(process.env.ALLOW_DEMO_LOGIN ?? "true").trim().toLowerCase() !== "false";
}

function normalizeDemoRole(value) {
  const key = String(value || "").trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (DEMO_ROLE_PROFILES[key]) return key;
  return DEMO_ROLE_ALIASES[key] || null;
}

module.exports = {
  DEMO_ROLE_PROFILES,
  DEMO_ROLE_KEYS,
  DEMO_CONTACT_EMAIL,
  isDemoEmail,
  isReadOnlyDemoEmail,
  isDemoLoginEnabled,
  normalizeDemoRole,
};

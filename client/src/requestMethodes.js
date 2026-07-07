import axios from "axios";

export const API_ORIGIN = (import.meta.env.VITE_API_URL || "http://localhost:5000").replace(/\/+$/, "");
export const BASE_URL = `${API_ORIGIN}/api/`;

export const publicRequest = axios.create({
  baseURL: BASE_URL,
  withCredentials: true,
});

export const userRequest = axios.create({
  baseURL: BASE_URL,
  withCredentials: true,
});

// ─── Central session-expiry handling ────────────────────────────────────────
// The API invalidates tokens aggressively: 12h/30d expiry, plus a session_version
// bump on password reset / admin ban that makes outstanding tokens return
// `403 "Token is not valid"`. Without a central handler every caller had to cope
// with that on its own, so an expired/invalidated session showed up as broken or
// half-loaded screens. Here we detect only genuine session-expiry responses and
// emit one decoupled event; a component inside the router (SessionExpiryHandler)
// clears auth state and routes to /login with a friendly notice.

// Auth endpoints handle their own 401/403 (e.g. a wrong-password login is a 401
// that must NOT look like an expired session), so they are excluded.
const AUTH_PATH_RE = /\/auth\/(login|register|google|session|logout|demo-login|password|verify-email)/i;

// 403 is overloaded (authorization denial, ban, demo read-only, unverified email).
// Only these are true session failures — everything else stays logged in.
const NON_SESSION_CODES = new Set([
  "ACCOUNT_BANNED",
  "ACCOUNT_INACTIVE",
  "DEMO_READ_ONLY",
  "EMAIL_VERIFICATION_REQUIRED",
]);

function isSessionExpiredError(error) {
  const status = error?.response?.status;
  if (status !== 401 && status !== 403) {
    return false;
  }

  const url = String(error?.config?.url || "");
  if (AUTH_PATH_RE.test(url)) {
    return false;
  }

  const data = error?.response?.data || {};
  const code = String(data.code || "").toUpperCase();
  if (NON_SESSION_CODES.has(code)) {
    return false;
  }

  const message = String(data.error || data.message || "").toLowerCase();
  // A role/authorization denial ("You are not allowed to do that") is not a
  // session problem — keep the user signed in.
  if (message.includes("not allowed to do that")) {
    return false;
  }

  if (status === 401) {
    // Any 401 on a non-auth endpoint means the session is missing or expired.
    return true;
  }

  // status === 403: only the explicit invalid-token message counts.
  return message.includes("token is not valid");
}

// Debounce so a burst of parallel requests failing at once fires a single event.
let sessionExpiredNotified = false;
function notifySessionExpired() {
  if (sessionExpiredNotified) {
    return;
  }
  sessionExpiredNotified = true;
  window.setTimeout(() => {
    sessionExpiredNotified = false;
  }, 3000);

  if (typeof window !== "undefined" && typeof window.dispatchEvent === "function") {
    window.dispatchEvent(new CustomEvent("siara:session-expired"));
  }
}

export const SESSION_EXPIRED_EVENT = "siara:session-expired";

function attachSessionExpiryInterceptor(instance) {
  instance.interceptors.response.use(
    (response) => response,
    (error) => {
      if (isSessionExpiredError(error)) {
        notifySessionExpired();
      }
      // Re-reject so existing per-call error handling still runs unchanged.
      return Promise.reject(error);
    },
  );
}

attachSessionExpiryInterceptor(userRequest);
attachSessionExpiryInterceptor(publicRequest);

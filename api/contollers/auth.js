const router = require("express").Router();
const createError = require("http-errors");

const {
  EMAIL_VERIFICATION_REQUIRED_CODE,
  clearSessionCookie,
  confirmEmailVerification,
  fetchEmailPreferences,
  loginUser,
  loginWithGoogle,
  mapUser,
  registerUser,
  requestPasswordReset,
  resetPassword,
  sendVerificationCode,
  updateEmailPreferences,
  verifyResetCode,
} = require("../services/authService");
const { resolveOptionalAuthenticatedUser, verifyToken } = require("./verifytoken");

function normalizeOptionalString(value) {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function buildSessionResponse(user, extra = {}) {
  return {
    authenticated: Boolean(user),
    requiresEmailVerification: Boolean(user && user.email && !user.email_verified),
    user: user ? mapUser(user) : null,
    ...extra,
  };
}

router.post("/register", async (req, res, next) => {
  try {
    const fullName = normalizeOptionalString(req.body.fullName)
      || [req.body.first_name, req.body.last_name].filter(Boolean).join(" ").trim();

    const result = await registerUser({
      email: req.body.email,
      password: req.body.password,
      fullName,
      rememberMe: req.body.rememberMe,
    });

    return res.status(201).json(result);
  } catch (error) {
    return next(error);
  }
});

router.post("/verify-email/send", async (req, res, next) => {
  try {
    const result = await sendVerificationCode({
      email: req.body.email,
    });

    return res.status(200).json(result);
  } catch (error) {
    return next(error);
  }
});

router.post("/verify-email/confirm", async (req, res, next) => {
  try {
    const result = await confirmEmailVerification({
      email: req.body.email,
      code: req.body.code,
      rememberMe: req.body.rememberMe,
      res,
    });

    return res.status(200).json(result);
  } catch (error) {
    return next(error);
  }
});

router.post("/login", async (req, res, next) => {
  try {
    const result = await loginUser({
      identifier: req.body.email || req.body.emailOrPhone,
      password: req.body.password,
      rememberMe: req.body.rememberMe,
      res,
    });

    return res.status(200).json(result);
  } catch (error) {
    if (error.code === EMAIL_VERIFICATION_REQUIRED_CODE) {
      return res.status(403).json({
        message: error.message,
        code: error.code,
        requiresEmailVerification: true,
        email: error.email || null,
      });
    }

    return next(error);
  }
});

router.post("/password/forgot", async (req, res, next) => {
  try {
    const result = await requestPasswordReset({
      email: req.body.email,
    });

    return res.status(200).json(result);
  } catch (error) {
    return next(error);
  }
});

router.post("/password/verify-code", async (req, res, next) => {
  try {
    const result = await verifyResetCode({
      email: req.body.email,
      code: req.body.code,
    });

    return res.status(200).json(result);
  } catch (error) {
    return next(error);
  }
});

router.post("/password/reset", async (req, res, next) => {
  try {
    const result = await resetPassword({
      email: req.body.email,
      resetToken: req.body.resetToken,
      newPassword: req.body.newPassword,
      res,
    });

    return res.status(200).json(result);
  } catch (error) {
    return next(error);
  }
});

router.post("/google", async (req, res, next) => {
  try {
    const result = await loginWithGoogle({
      credential: req.body.credential,
      rememberMe: req.body.rememberMe,
      res,
    });

    return res.status(200).json(result);
  } catch (error) {
    return next(error);
  }
});

router.get("/session", async (req, res, next) => {
  try {
    const user = await resolveOptionalAuthenticatedUser(req);
    return res.status(200).json(buildSessionResponse(user));
  } catch (error) {
    return next(error);
  }
});

router.get("/me", verifyToken, async (req, res, next) => {
  try {
    return res.status(200).json({
      user: mapUser(req.user),
    });
  } catch (error) {
    return next(error);
  }
});

router.post("/logout", async (req, res, next) => {
  try {
    clearSessionCookie(res);
    return res.status(200).json({ ok: true });
  } catch (error) {
    return next(error);
  }
});

router.get("/email-preferences", verifyToken, async (req, res, next) => {
  try {
    const preferences = await fetchEmailPreferences(req.user.userId);
    return res.status(200).json({ preferences });
  } catch (error) {
    return next(error);
  }
});

router.patch("/email-preferences", verifyToken, async (req, res, next) => {
  try {
    const preferences = await updateEmailPreferences(req.user.userId, {
      weeklySummaryEnabled: req.body.weeklySummaryEnabled,
      productUpdatesEnabled: req.body.productUpdatesEnabled,
      marketingEnabled: req.body.marketingEnabled,
    });

    return res.status(200).json({ preferences });
  } catch (error) {
    return next(error);
  }
});

router.use((error, req, res, next) => {
  if (error.status === 429) {
    return res.status(429).json({
      message: error.message,
      resendAvailableAt: error.resendAvailableAt || null,
    });
  }

  return next(error);
});

module.exports = router;

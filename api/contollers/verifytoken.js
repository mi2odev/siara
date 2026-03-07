const jwt = require("jsonwebtoken");
const createError = require("http-errors");

function hasRole(user, roleName) {
  return Array.isArray(user?.roles) && user.roles.includes(roleName);
}

function verifyToken(req, res, next) {
  try {
    const token = req.cookies?.accessToken;

    if (!token) {
      throw createError(401, "You are not authenticated");
    }

    if (!process.env.JWT_ACCESSTOKEN) {
      throw createError(500, "JWT_ACCESSTOKEN is not configured");
    }

    const decodedToken = jwt.verify(token, process.env.JWT_ACCESSTOKEN);
    req.user = decodedToken;

    return next();
  } catch (err) {
    if (err.name === "JsonWebTokenError" || err.name === "TokenExpiredError") {
      return res.status(403).json({ error: "Token is not valid" });
    }

    return next(err);
  }
}

function verifyTokenAndAdmin(req, res, next) {
  return verifyToken(req, res, () => {
    if (hasRole(req.user, "admin")) {
      return next();
    }

    return res.status(403).json({ error: "You are not allowed to do that" });
  });
}

function verifyTokenAndClient(req, res, next) {
  return verifyToken(req, res, () => {
    if (hasRole(req.user, "citizen")) {
      return next();
    }

    return res.status(403).json({ error: "You are not allowed to do that" });
  });
}

module.exports = { verifyTokenAndClient, verifyToken, verifyTokenAndAdmin };

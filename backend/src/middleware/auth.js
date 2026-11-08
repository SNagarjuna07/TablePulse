const jwt = require("jsonwebtoken");
const env = require("../config/env");
const User = require("../models/User");
const ApiError = require("../utils/ApiError");

// Protects a route: needs "Authorization: Bearer <token>". Puts the user on req.user.
// The user (and role) is loaded from the database each time, so a role change takes effect at once.
async function requireAuth(req, res, next) {
  const [scheme, token] = (req.headers.authorization || "").split(" ");
  if (scheme !== "Bearer" || !token) throw ApiError.unauthorized();

  let payload;
  try {
    payload = jwt.verify(token, env.jwtSecret);
  } catch (err) {
    throw ApiError.unauthorized("Session expired. Please sign in again.");
  }

  const user = await User.findById(payload.sub);
  if (!user) throw ApiError.unauthorized();

  req.user = user;
  next();
}

// Use after requireAuth: requireRole('manager')
function requireRole(role) {
  return (req, res, next) => {
    if (req.user.role !== role) throw ApiError.forbidden("Managers only.");
    next();
  };
}

module.exports = { requireAuth, requireRole };
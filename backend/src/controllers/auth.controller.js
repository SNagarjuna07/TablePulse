const authService = require("../services/auth.service");

// Controllers only read the request and send the response.
// Express 5 passes errors from async functions to the error handler by itself.
exports.register = async (req, res) => {
  const result = await authService.register(req.body || {});
  res.status(201).json(result);
};

exports.login = async (req, res) => {
  const result = await authService.login(req.body || {});
  res.json(result);
};

exports.me = async (req, res) => {
  res.json(req.user);
};
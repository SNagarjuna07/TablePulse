const ApiError = require("../utils/ApiError");

// Express recognises an error handler by its 4 arguments, so keep all 4.
module.exports = function errorHandler(err, req, res, next) {
  // Bad JSON in the request body
  if (err.type === "entity.parse.failed") {
    err = ApiError.validation("Request body is not valid JSON.");
  }

  // Mongoose schema validation failed: turn it into per-field messages
  if (err.name === "ValidationError" && err.errors) {
    const fields = {};
    for (const key of Object.keys(err.errors))
      fields[key] = err.errors[key].message;
    err = ApiError.validation(undefined, fields);
  }

  if (err instanceof ApiError) {
    const body = { code: err.code, message: err.message };
    if (err.fields) body.fields = err.fields;
    return res.status(err.status).json(body);
  }

  console.error(err); // unexpected bug: log it, do not leak details to the client
  res.status(500).json({ code: "UNKNOWN", message: "Something went wrong." });
};

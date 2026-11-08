// Every error sent to the client has the shape { code, message, fields? } 
class ApiError extends Error {
  constructor(status, code, message, fields) {
    super(message);
    this.status = status;
    this.code = code;
    this.fields = fields;
  }

  static validation(message, fields) {
    return new ApiError(
      400,
      "VALIDATION",
      message || "Please fix the highlighted fields.",
      fields,
    );
  }
  static unauthorized(message) {
    return new ApiError(
      401,
      "UNAUTHORIZED",
      message || "Please sign in again.",
    );
  }
  static forbidden(message) {
    return new ApiError(
      403,
      "FORBIDDEN",
      message || "You are not allowed to do this.",
    );
  }
  static notFound(message) {
    return new ApiError(404, "NOT_FOUND", message || "Not found.");
  }
  static conflict(code, message) {
    return new ApiError(409, code, message);
  }
}

module.exports = ApiError;

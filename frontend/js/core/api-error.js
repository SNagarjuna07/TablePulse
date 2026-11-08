(function () {
  'use strict';

  // Every backend error body must be: { code, message, fields? }
  angular.module('tablepulse').factory('ApiError', function () {
    function ApiError(status, code, message, fields) {
      this.status = status;
      this.code = code;
      this.message = message;
      this.fields = fields || null;
    }

    // Turns an $http response or anything thrown by the mock into an ApiError.
    ApiError.from = function (err) {
      if (err instanceof ApiError) return err;
      if (err && typeof err.status === 'number' && 'data' in err) {
        if (err.status <= 0) {
          return new ApiError(0, 'NETWORK', 'Cannot reach the server. Check your connection and try again.');
        }
        var body = err.data && typeof err.data === 'object' ? err.data : {};
        return new ApiError(err.status, body.code || 'HTTP_' + err.status, body.message || 'Something went wrong.', body.fields);
      }
      return new ApiError(500, 'UNKNOWN', 'Something went wrong.');
    };

    return ApiError;
  });
})();

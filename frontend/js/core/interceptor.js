(function () {
  'use strict';

  // Adds "Authorization: Bearer <jwt>" to API calls and turns every HTTP failure into an ApiError.
  // A 401 outside /auth/ means the session expired, so sign out and go to sign-in.
  // $injector is used lazily because Auth -> Api -> $http -> this interceptor would be circular.
  angular.module('tablepulse').factory('tpHttpInterceptor', tpHttpInterceptor);

  tpHttpInterceptor.$inject = ['$injector', '$q', 'TP_ENV', 'ApiError'];
  function tpHttpInterceptor($injector, $q, TP_ENV, ApiError) {
    function isApi(url) { return typeof url === 'string' && url.indexOf(TP_ENV.apiUrl) === 0; }

    return {
      request: function (config) {
        if (isApi(config.url)) {
          var token = $injector.get('Auth').token();
          if (token) config.headers.Authorization = 'Bearer ' + token;
        }
        return config;
      },

      responseError: function (rejection) {
        if (!rejection.config || !isApi(rejection.config.url)) return $q.reject(rejection);
        var err = ApiError.from(rejection);
        if (err.status === 401 && rejection.config.url.indexOf('/auth/') === -1) {
          var $location = $injector.get('$location');
          var back = $location.url();
          $injector.get('Auth').signOut();
          $location.path('/sign-in').search({ returnUrl: back });
        }
        return $q.reject(err);
      }
    };
  }
})();

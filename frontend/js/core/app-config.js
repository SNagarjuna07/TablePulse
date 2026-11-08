(function () {
  'use strict';

  // Restaurant rules (hours, duration, max party). load() never rejects: it resolves null if the server is down.
  angular.module('tablepulse').factory('AppConfig', ['Api', '$q', function (Api, $q) {
    var cfg = null;
    return {
      get: function () { return cfg; },
      load: function (force) {
        if (cfg && !force) return $q.resolve(cfg);
        return Api.getConfig().then(function (c) { cfg = c; return c; }, function () { cfg = null; return null; });
      }
    };
  }]);
})();

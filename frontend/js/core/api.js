(function () {
  'use strict';

  // The only door between the UI and data. Pages inject "Api" and never know which one they get.
  // env.js decides: MockApi (browser) or HttpApi (Express backend). Same method names on both.
  angular.module('tablepulse').factory('Api', ['TP_ENV', '$injector', function (TP_ENV, $injector) {
    return $injector.get(TP_ENV.useMockApi ? 'MockApi' : 'HttpApi');
  }]);
})();

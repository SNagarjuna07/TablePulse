(function () {
  'use strict';

  // Real backend. Endpoints are documented in API_CONTRACT.md.
  angular.module('tablepulse').factory('HttpApi', HttpApi);

  HttpApi.$inject = ['$http', 'TP_ENV'];
  function HttpApi($http, TP_ENV) {
    var base = TP_ENV.apiUrl;
    function data(response) { return response.data; }

    return {
      getConfig: function () { return $http.get(base + '/config').then(data); },
      register: function (input) { return $http.post(base + '/auth/register', input).then(data); },
      login: function (input) { return $http.post(base + '/auth/login', input).then(data); },
      me: function () { return $http.get(base + '/auth/me').then(data); },

      recommend: function (q) {
        return $http.get(base + '/availability', { params: { date: q.date, time: q.time, guests: q.guests, pref: q.pref } }).then(data);
      },
      createReservation: function (input) { return $http.post(base + '/reservations', input).then(data); },
      myReservations: function () { return $http.get(base + '/reservations/mine').then(data); },
      cancelReservation: function (id) {
        return $http.patch(base + '/reservations/' + encodeURIComponent(id) + '/cancel', {}).then(data);
      },

      reservationsOn: function (date) { return $http.get(base + '/reservations', { params: { date: date } }).then(data); },
      getFloor: function (date, time) { return $http.get(base + '/floor', { params: { date: date, time: time } }).then(data); },
      setTableStatus: function (tableId, status) {
        return $http.patch(base + '/tables/' + encodeURIComponent(tableId) + '/status', { status: status }).then(function () { return undefined; });
      }
    };
  }
})();

(function () {
  'use strict';

  // Customers see only the reservations that belong to their account.
  angular.module('tablepulse').component('tpMyReservations', {
    templateUrl: 'templates/my-reservations.html',
    controller: MyReservationsCtrl
  });

  MyReservationsCtrl.$inject = ['Api', 'ApiError', '$window'];
  function MyReservationsCtrl(Api, ApiError, $window) {
    var vm = this;
    vm.items = [];
    vm.loading = true;
    vm.error = '';
    vm.cancellingId = null;

    vm.$onInit = function () {
      Api.myReservations().then(function (list) {
        vm.items = list;
      }, function (e) {
        vm.error = ApiError.from(e).message;
      }).finally(function () { vm.loading = false; });
    };

    vm.cancel = function (r) {
      if (!$window.confirm('Cancel booking ' + r.code + '?')) return;
      vm.error = '';
      vm.cancellingId = r.id;
      Api.cancelReservation(r.id).then(function (updated) {
        vm.items = vm.items.map(function (x) { return x.id === updated.id ? updated : x; });
      }, function (e) {
        vm.error = ApiError.from(e).message;
      }).finally(function () { vm.cancellingId = null; });
    };
  }
})();

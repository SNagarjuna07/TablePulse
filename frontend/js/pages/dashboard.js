(function () {
  'use strict';

  // Manager view: every reservation for one day, with cancel.
  angular.module('tablepulse').component('tpDashboard', {
    templateUrl: 'templates/dashboard.html',
    controller: DashboardCtrl
  });

  DashboardCtrl.$inject = ['Api', 'ApiError', 'TpDate', '$window'];
  function DashboardCtrl(Api, ApiError, TpDate, $window) {
    var vm = this;
    var seq = 0;                       // ignore stale responses when the date changes quickly

    vm.fmtDate = TpDate.formatDate;
    vm.dateObj = new Date();
    vm.date = TpDate.todayString();
    vm.items = [];
    vm.loading = true;
    vm.error = '';
    vm.cancellingId = null;
    vm.stats = { confirmed: 0, guests: 0, cancelled: 0 };

    function recalc() {
      var confirmed = vm.items.filter(function (r) { return r.status === 'confirmed'; });
      vm.stats = {
        confirmed: confirmed.length,
        guests: confirmed.reduce(function (sum, r) { return sum + r.guests; }, 0),
        cancelled: vm.items.length - confirmed.length
      };
    }

    function load() {
      var mine = ++seq;
      vm.loading = true;
      vm.error = '';
      Api.reservationsOn(vm.date).then(function (list) {
        if (mine !== seq) return;
        vm.items = list;
        recalc();
      }, function (e) {
        if (mine !== seq) return;
        vm.items = [];
        recalc();
        vm.error = ApiError.from(e).message;
      }).finally(function () { if (mine === seq) vm.loading = false; });
    }

    vm.$onInit = load;

    vm.onDateChange = function () {
      var date = TpDate.toDateString(vm.dateObj);
      if (!date) return;
      vm.date = date;
      load();
    };

    vm.cancel = function (r) {
      if (!$window.confirm('Cancel booking ' + r.code + ' for ' + r.name + '?')) return;
      vm.error = '';
      vm.cancellingId = r.id;
      Api.cancelReservation(r.id).then(function (updated) {
        vm.items = vm.items.map(function (x) { return x.id === updated.id ? updated : x; });
        recalc();
      }, function (e) {
        vm.error = ApiError.from(e).message;
      }).finally(function () { vm.cancellingId = null; });
    };
  }
})();

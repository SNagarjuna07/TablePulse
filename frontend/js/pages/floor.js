(function () {
  'use strict';

  // Manager view: availability of every table at a chosen date and time.
  // <tp-floor cfg="$resolve.cfg">
  angular.module('tablepulse').component('tpFloor', {
    templateUrl: 'templates/floor.html',
    bindings: { cfg: '<' },
    controller: FloorCtrl
  });

  FloorCtrl.$inject = ['Api', 'ApiError', 'TpDate', 'TP_ZONE_NAMES'];
  function FloorCtrl(Api, ApiError, TpDate, ZONE_NAMES) {
    var vm = this;
    var seq = 0;

    vm.zoneNames = ZONE_NAMES;
    vm.fmtDate = TpDate.formatDate;
    vm.fmtTime = TpDate.formatTime;
    vm.legend = ['available', 'reserved', 'occupied', 'cleaning'];
    vm.manualOptions = ['available', 'occupied', 'cleaning'];

    vm.dateObj = new Date();
    vm.date = TpDate.todayString();
    vm.time = '';
    vm.slots = [];
    vm.floor = [];
    vm.counts = { available: 0, reserved: 0, occupied: 0, cleaning: 0 };
    vm.loading = false;
    vm.error = '';
    vm.busyId = null;

    vm.isToday = function () { return vm.date === TpDate.todayString(); };

    vm.$onInit = function () {
      if (!vm.cfg) return;
      vm.slots = TpDate.buildSlots(vm.cfg);
      vm.time = TpDate.nextSlot(vm.slots);
      load();
    };

    function recount() {
      var counts = { available: 0, reserved: 0, occupied: 0, cleaning: 0 };
      vm.floor.forEach(function (s) { counts[s.state]++; });
      vm.counts = counts;
    }

    function load() {
      var mine = ++seq;
      vm.loading = true;
      vm.error = '';
      Api.getFloor(vm.date, vm.time).then(function (floor) {
        if (mine !== seq) return;
        vm.floor = floor;
        recount();
      }, function (e) {
        if (mine !== seq) return;
        vm.floor = [];
        recount();
        vm.error = ApiError.from(e).message;
      }).finally(function () { if (mine === seq) vm.loading = false; });
    }

    vm.onDateChange = function () {
      var date = TpDate.toDateString(vm.dateObj);
      if (!date) return;
      vm.date = date;
      load();
    };

    vm.onTimeChange = load;

    vm.setStatus = function (slot, status) {
      vm.busyId = slot.table.id;
      Api.setTableStatus(slot.table.id, status).then(function () {
        vm.busyId = null;
        load();
      }, function (e) {
        vm.busyId = null;
        vm.error = ApiError.from(e).message;
      });
    };
  }
})();

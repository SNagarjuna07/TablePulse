(function () {
  'use strict';

  // <tp-reserve cfg="$resolve.cfg"> (cfg comes from the route "resolve")
  angular.module('tablepulse').component('tpReserve', {
    templateUrl: 'templates/reserve.html',
    bindings: { cfg: '<' },
    controller: ReserveCtrl
  });

  ReserveCtrl.$inject = ['Api', 'Auth', 'AppConfig', 'ApiError', 'TpDate', 'TpValidation', 'TP_ZONE_NAMES', 'TP_PREF_OPTIONS'];
  function ReserveCtrl(Api, Auth, AppConfig, ApiError, TpDate, TpValidation, ZONE_NAMES, PREF_OPTIONS) {
    var vm = this;

    vm.zoneNames = ZONE_NAMES;
    vm.prefOptions = PREF_OPTIONS;
    vm.fmtDate = TpDate.formatDate;
    vm.fmtTime = TpDate.formatTime;

    vm.form = { name: '', email: '', phone: '', guests: 2, date: '', time: null, pref: 'any', requests: '' };
    vm.dateObj = null;           // the <input type="date"> model (AngularJS needs a Date object)
    vm.guestOptions = [];
    vm.slotOptions = [];
    vm.errors = {};
    vm.serverError = '';
    vm.results = [];
    vm.searched = false;
    vm.loading = false;
    vm.creating = null;          // table id being booked
    vm.booking = null;

    vm.$onInit = function () {
      var user = Auth.user();
      if (user) {
        vm.form.name = user.name;
        vm.form.email = user.email;
      }
      buildOptions();
    };

    function buildOptions() {
      var cfg = vm.cfg;
      vm.guestOptions = [];
      vm.slotOptions = [];
      if (!cfg) return;
      for (var n = 1; n <= cfg.maxPartySize; n++) vm.guestOptions.push(n);
      vm.slotOptions = TpDate.buildSlots(cfg).map(function (value) {
        return {
          value: value,
          label: TpDate.formatTime(value),
          // Times already past (or inside the notice window) are disabled for today.
          disabled: !!vm.form.date && TpDate.isInPast(vm.form.date, value, cfg.minLeadMinutes)
        };
      });
    }

    function clearResults() {
      vm.results = [];
      vm.searched = false;
      vm.serverError = '';
    }

    vm.retryConfig = function () {
      AppConfig.load(true).then(function (cfg) {
        vm.cfg = cfg;
        buildOptions();
      });
    };

    vm.onDateChange = function () {
      vm.form.date = TpDate.toDateString(vm.dateObj);
      var cfg = vm.cfg;
      if (vm.form.time && vm.form.date && cfg && TpDate.isInPast(vm.form.date, vm.form.time, cfg.minLeadMinutes)) {
        vm.form.time = null;       // null (not '') selects the "Select a time" placeholder
      }
      buildOptions();
      clearResults();
    };

    // Changing the plan makes old recommendations stale.
    vm.onPlanChange = clearResults;

    vm.guestLabel = function (n) { return n + (n === 1 ? ' guest' : ' guests'); };

    vm.search = function () {
      if (!vm.cfg) return;
      vm.errors = TpValidation.validateBooking(vm.form, vm.cfg);
      vm.serverError = '';
      if (Object.keys(vm.errors).length) {
        vm.results = [];
        vm.searched = false;
        return;
      }
      runSearch();
    };

    function runSearch() {
      var f = vm.form;
      vm.loading = true;
      Api.recommend({ date: f.date, time: f.time, guests: f.guests, pref: f.pref }).then(function (results) {
        vm.results = results;
        vm.searched = true;
      }, function (e) {
        var err = ApiError.from(e);
        if (err.fields) vm.errors = angular.extend({}, err.fields);
        vm.serverError = err.message;
        vm.results = [];
      }).finally(function () { vm.loading = false; });
    }

    vm.choose = function (rec) {
      var f = vm.form;
      vm.serverError = '';
      vm.creating = rec.table.id;
      Api.createReservation({
        tableId: rec.table.id,
        name: f.name.trim(),
        email: f.email.trim(),
        phone: TpValidation.normalizePhone(f.phone),
        date: f.date,
        time: f.time,
        guests: f.guests,
        pref: f.pref,
        requests: String(f.requests || '').trim()
      }).then(function (reservation) {
        vm.booking = reservation;
        vm.results = [];
        vm.searched = false;
      }, function (e) {
        var err = ApiError.from(e);
        if (err.fields) vm.errors = angular.extend({}, err.fields);
        if (err.code === 'SLOT_TAKEN') runSearch();   // someone booked it first: show fresh options
        vm.serverError = err.message;
      }).finally(function () { vm.creating = null; });
    };

    vm.startAgain = function () {
      vm.booking = null;
      vm.dateObj = null;
      vm.form.date = '';
      vm.form.time = null;
      vm.form.requests = '';
      vm.errors = {};
      buildOptions();
    };
  }
})();

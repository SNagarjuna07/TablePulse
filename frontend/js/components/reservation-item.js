(function () {
  'use strict';

  // One reservation row. Used by My Reservations (customer) and Dashboard (manager).
  // <tp-reservation-item reservation="r" show-customer="true" busy="false" on-cancel="vm.cancel(r)">
  angular.module('tablepulse').component('tpReservationItem', {
    templateUrl: 'templates/reservation-item.html',
    bindings: { reservation: '<', showCustomer: '<', busy: '<', onCancel: '&' },
    controller: ReservationItemCtrl
  });

  ReservationItemCtrl.$inject = ['TpDate', 'TP_ZONE_NAMES'];
  function ReservationItemCtrl(TpDate, ZONE_NAMES) {
    var vm = this;
    vm.zoneNames = ZONE_NAMES;
    vm.fmtDate = TpDate.formatDate;
    vm.fmtTime = TpDate.formatTime;
    vm.canCancel = function () {
      var r = vm.reservation;
      return !!r && r.status === 'confirmed' && !TpDate.isInPast(r.date, r.time);
    };
  }
})();

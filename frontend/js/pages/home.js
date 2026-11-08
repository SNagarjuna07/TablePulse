(function () {
  'use strict';

  angular.module('tablepulse').component('tpHome', {
    templateUrl: 'templates/home.html',
    controller: HomeCtrl
  });

  HomeCtrl.$inject = ['$window'];
  function HomeCtrl($window) {
    var vm = this;
    // Sample floor status for the preview. Not live data.
    vm.miniFloor = ['available', 'available', 'reserved', 'available', 'occupied', 'cleaning',
                    'available', 'reserved', 'available', 'occupied', 'available', 'cleaning'];
    vm.scrollTo = function (id) {
      var el = $window.document.getElementById(id);
      if (el && el.scrollIntoView) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };
  }
})();

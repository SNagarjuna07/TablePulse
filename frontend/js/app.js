(function () {
  'use strict';

  angular
    .module('tablepulse', ['ngRoute'])
    .constant('TP_ENV', window.TP_ENV)
    .config(configure)
    .run(run)
    .controller('ShellCtrl', ShellCtrl);

  // Route guards use "resolve": a rejected guard cancels the route and triggers $routeChangeError.
  function guard(role) {
    return ['Auth', '$q', function (Auth, $q) {
      if (!Auth.isSignedIn()) return $q.reject('AUTH_REQUIRED');
      if (role === 'manager' && !Auth.isManager()) return $q.reject('FORBIDDEN');
      return true;
    }];
  }

  // Restaurant rules are loaded before the page shows. Never rejects (null means "server down").
  function loadConfig() {
    return ['AppConfig', function (AppConfig) { return AppConfig.load(); }];
  }

  configure.$inject = ['$routeProvider', '$locationProvider', '$httpProvider'];
  function configure($routeProvider, $locationProvider, $httpProvider) {
    $locationProvider.hashPrefix('!');
    $httpProvider.interceptors.push('tpHttpInterceptor');

    // ngRoute has no "component" shorthand, so each route renders a component tag.
    // Values from "resolve" are available as $resolve.<name> (cfg is passed in as a binding).
    $routeProvider
      .when('/', { title: 'TablePulse', template: '<tp-home></tp-home>' })
      .when('/sign-in', { title: 'Sign in', template: '<tp-sign-in></tp-sign-in>' })
      .when('/reserve', { title: 'Reserve a table', template: '<tp-reserve cfg="$resolve.cfg"></tp-reserve>', resolve: { guard: guard('user'), cfg: loadConfig() } })
      .when('/my-reservations', { title: 'My reservations', template: '<tp-my-reservations></tp-my-reservations>', resolve: { guard: guard('user') } })
      .when('/dashboard', { title: 'Dashboard', template: '<tp-dashboard></tp-dashboard>', resolve: { guard: guard('manager') } })
      .when('/floor', { title: 'Floor plan', template: '<tp-floor cfg="$resolve.cfg"></tp-floor>', resolve: { guard: guard('manager'), cfg: loadConfig() } })
      .otherwise({ redirectTo: '/' });
  }

  run.$inject = ['$rootScope', '$location', '$window', 'Auth'];
  function run($rootScope, $location, $window, Auth) {
    $rootScope.$on('$routeChangeError', function (event, current, previous, rejection) {
      if (rejection === 'AUTH_REQUIRED') {
        var wanted = $location.url();            // read BEFORE changing the path
        $location.path('/sign-in').search({ returnUrl: wanted });
      } else if (rejection === 'FORBIDDEN') {
        $location.url('/');
      }
    });

    $rootScope.$on('$routeChangeSuccess', function (event, current) {
      var route = current && current.$$route;
      var title = route && route.title;
      $window.document.title = !title || title === 'TablePulse' ? 'TablePulse' : title + ' · TablePulse';
      try { $window.scrollTo(0, 0); } catch (e) { /* not available in some test environments */ }
    });

    // Re-check the stored session with the server (role or token may have changed).
    Auth.refresh();
  }

  ShellCtrl.$inject = ['Auth', '$location'];
  function ShellCtrl(Auth, $location) {
    var shell = this;
    shell.auth = Auth;
    shell.isActive = function (path) { return $location.path() === path; };
    shell.signOut = function () {
      Auth.signOut();
      $location.url('/');
    };
  }
})();

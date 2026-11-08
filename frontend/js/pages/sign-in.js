(function () {
  'use strict';

  angular.module('tablepulse').component('tpSignIn', {
    templateUrl: 'templates/sign-in.html',
    controller: SignInCtrl
  });

  SignInCtrl.$inject = ['Auth', 'ApiError', 'TpValidation', 'TP_ENV', '$location', '$routeParams'];
  function SignInCtrl(Auth, ApiError, TpValidation, TP_ENV, $location, $routeParams) {
    var vm = this;
    vm.mockMode = TP_ENV.useMockApi;
    vm.mode = 'login';
    vm.busy = false;
    vm.error = '';
    vm.errors = {};
    vm.form = { name: '', email: '', password: '' };

    vm.setMode = function (mode) {
      vm.mode = mode;
      vm.error = '';
      vm.errors = {};
    };

    function validate() {
      var errs = {};
      var f = vm.form;
      if (vm.mode === 'register' && String(f.name || '').trim().length < 2) errs.name = 'Please enter your full name.';
      if (!String(f.email || '').trim()) errs.email = 'Please enter your email.';
      else if (!TpValidation.EMAIL_RE.test(f.email.trim())) errs.email = 'Please enter a valid email address.';
      if (!f.password) errs.password = 'Please enter your password.';
      else if (vm.mode === 'register' && f.password.length < 8) errs.password = 'Password must be at least 8 characters.';
      return errs;
    }

    // Back to the page the user wanted, otherwise a sensible home for their role.
    function destination(user) {
      var target = $routeParams.returnUrl;
      if (target && target.charAt(0) === '/' && target.charAt(1) !== '/') return target;
      return user.role === 'manager' ? '/dashboard' : '/reserve';
    }

    vm.submit = function () {
      vm.error = '';
      vm.errors = validate();
      if (Object.keys(vm.errors).length) return;

      var f = vm.form;
      var request = vm.mode === 'login'
        ? Auth.login({ email: f.email.trim(), password: f.password })
        : Auth.register({ name: f.name.trim(), email: f.email.trim(), password: f.password });

      vm.busy = true;
      request.then(function (user) {
        $location.url(destination(user));
      }, function (e) {
        var err = ApiError.from(e);
        vm.error = err.message;
        if (err.fields) vm.errors = angular.extend({}, err.fields);
      }).finally(function () { vm.busy = false; });
    };
  }
})();

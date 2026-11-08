(function () {
  'use strict';

  // Holds the signed-in user and JWT. The server decides the role, never the client.
  angular.module('tablepulse').factory('Auth', Auth);

  Auth.$inject = ['Api', 'TpStorage', 'TpKeys'];
  function Auth(Api, TpStorage, TpKeys) {
    var token = localStorage.getItem(TpKeys.TOKEN);
    var user = token ? TpStorage.read(TpKeys.USER, null) : null;

    function setSession(result) {
      token = result.token;
      user = result.user;
      localStorage.setItem(TpKeys.TOKEN, token);
      TpStorage.write(TpKeys.USER, user);
    }

    function signOut() {
      token = null;
      user = null;
      localStorage.removeItem(TpKeys.TOKEN);
      localStorage.removeItem(TpKeys.USER);
    }

    return {
      user: function () { return user; },
      token: function () { return token; },
      isSignedIn: function () { return !!user && !!token; },
      isManager: function () { return !!user && user.role === 'manager'; },

      login: function (input) {
        return Api.login(input).then(function (r) { setSession(r); return r.user; });
      },
      register: function (input) {
        return Api.register(input).then(function (r) { setSession(r); return r.user; });
      },
      signOut: signOut,

      // Re-checks the stored session with the server (role may have changed, token may have expired).
      refresh: function () {
        if (!token) return;
        Api.me().then(function (u) {
          user = u;
          TpStorage.write(TpKeys.USER, u);
        }, function () { signOut(); });
      }
    };
  }
})();

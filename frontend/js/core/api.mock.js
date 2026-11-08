(function () {
  'use strict';

  // In-browser fake server so the UI works with no backend. Passwords are stored in plain text:
  // demo only. Every rule here is what the real Express API must do.
  angular.module('tablepulse').factory('MockApi', MockApi);

  MockApi.$inject = ['$q', '$timeout', 'TpStorage', 'TpKeys', 'TpDate', 'TpValidation', 'TpEngine', 'ApiError'];
  function MockApi($q, $timeout, TpStorage, TpKeys, TpDate, TpValidation, TpEngine, ApiError) {
    var LATENCY_MS = 250;
    var KEYS = { users: 'tp_mock_users', reservations: 'tp_mock_reservations', status: 'tp_mock_status' };

    var TABLES = [
      { id: 'T01', label: 'T01', cap: 2, zone: 'window' }, { id: 'T02', label: 'T02', cap: 4, zone: 'window' },
      { id: 'T03', label: 'T03', cap: 2, zone: 'window' }, { id: 'T04', label: 'T04', cap: 4, zone: 'window' },
      { id: 'T05', label: 'T05', cap: 4, zone: 'centre' }, { id: 'T06', label: 'T06', cap: 6, zone: 'centre' },
      { id: 'T07', label: 'T07', cap: 2, zone: 'quiet' },  { id: 'T08', label: 'T08', cap: 4, zone: 'quiet' },
      { id: 'T09', label: 'T09', cap: 6, zone: 'outdoor' }, { id: 'T10', label: 'T10', cap: 4, zone: 'outdoor' },
      { id: 'T11', label: 'T11', cap: 8, zone: 'centre' }, { id: 'T12', label: 'T12', cap: 2, zone: 'outdoor' }
    ];

    var CONFIG = {
      openTime: '11:00',
      closeTime: '23:00',
      slotMinutes: 30,
      durationMinutes: 120,
      minLeadMinutes: 30,
      maxPartySize: Math.max.apply(null, TABLES.map(function (t) { return t.cap; }))
    };

    var SEED_MANAGER = { id: 'u-manager', name: 'Restaurant Manager', email: 'manager@tablepulse.demo', password: 'manager123', role: 'manager' };

    function uid() { return Math.random().toString(36).slice(2, 10) + Date.now().toString(36); }

    // Runs fn after a short delay. A thrown ApiError becomes a rejected promise.
    function respond(fn) {
      var d = $q.defer();
      $timeout(function () {
        try { d.resolve(fn()); } catch (e) { d.reject(e); }
      }, LATENCY_MS);
      return d.promise;
    }

    function users() {
      var list = TpStorage.read(KEYS.users, []);
      var hasManager = list.some(function (u) { return u.id === SEED_MANAGER.id; });
      return hasManager ? list : [SEED_MANAGER].concat(list);
    }
    function reservations() { return TpStorage.read(KEYS.reservations, []); }
    function manualStatus() { return TpStorage.read(KEYS.status, {}); }

    function publicUser(u) { return { id: u.id, name: u.name, email: u.email, role: u.role }; }
    function session(u) { return { user: publicUser(u), token: 'mock.' + u.id }; }

    function requireUser() {
      var token = localStorage.getItem(TpKeys.TOKEN);
      var user = null;
      if (token && token.indexOf('mock.') === 0) {
        var id = token.slice(5);
        user = users().filter(function (u) { return u.id === id; })[0] || null;
      }
      if (!user) throw new ApiError(401, 'UNAUTHORIZED', 'Please sign in again.');
      return user;
    }

    function requireManager() {
      var user = requireUser();
      if (user.role !== 'manager') throw new ApiError(403, 'FORBIDDEN', 'Managers only.');
      return user;
    }

    function newCode(existing) {
      var code;
      do {
        code = 'TP-' + (Math.random().toString(36).slice(2, 8).toUpperCase() + '000000').slice(0, 6);
      } while (existing.some(function (r) { return r.code === code; }));
      return code;
    }

    function toReservation(s) {
      var table = TABLES.filter(function (t) { return t.id === s.tableId; })[0];
      if (!table) throw new ApiError(500, 'UNKNOWN', 'Reservation points to a missing table.');
      var out = angular.extend({}, s);
      delete out.userId;
      delete out.tableId;
      out.table = table;
      out.endTime = TpDate.fromMinutes(TpDate.toMinutes(s.time) + CONFIG.durationMinutes);
      return out;
    }

    function fail(message, fields) { return new ApiError(400, 'VALIDATION', message, fields); }

    return {
      getConfig: function () { return respond(function () { return CONFIG; }); },

      // ---- auth ----
      register: function (input) {
        return respond(function () {
          var fields = {};
          if (String(input.name || '').trim().length < 2) fields.name = 'Please enter your full name.';
          if (!TpValidation.EMAIL_RE.test(String(input.email || '').trim())) fields.email = 'Please enter a valid email address.';
          if (String(input.password || '').length < 8) fields.password = 'Password must be at least 8 characters.';
          if (Object.keys(fields).length) throw fail('Please fix the highlighted fields.', fields);

          var email = input.email.trim().toLowerCase();
          var list = users();
          if (list.some(function (u) { return u.email === email; })) {
            throw new ApiError(409, 'EMAIL_TAKEN', 'An account with this email already exists.');
          }
          var user = { id: uid(), name: input.name.trim(), email: email, password: input.password, role: 'customer' };
          TpStorage.write(KEYS.users, list.concat([user]));
          return session(user);
        });
      },

      login: function (input) {
        return respond(function () {
          var email = String(input.email || '').trim().toLowerCase();
          var user = users().filter(function (u) { return u.email === email && u.password === input.password; })[0];
          if (!user) throw new ApiError(401, 'INVALID_CREDENTIALS', 'Incorrect email or password.');
          return session(user);
        });
      },

      me: function () { return respond(function () { return publicUser(requireUser()); }); },

      // ---- customer ----
      recommend: function (q) {
        return respond(function () {
          requireUser();
          var errs = TpValidation.validateSearch(q, CONFIG);
          if (Object.keys(errs).length) throw fail('Please fix the highlighted fields.', errs);
          return TpEngine.recommend(TABLES, reservations(), manualStatus(), q, CONFIG);
        });
      },

      createReservation: function (input) {
        return respond(function () {
          var user = requireUser();
          var errs = TpValidation.validateBooking(input, CONFIG);
          if (Object.keys(errs).length) throw fail('Please fix the highlighted fields.', errs);

          var table = TABLES.filter(function (t) { return t.id === input.tableId; })[0];
          if (!table) throw new ApiError(404, 'NOT_FOUND', 'Table not found.');
          if (table.cap < input.guests) {
            throw new ApiError(422, 'TABLE_TOO_SMALL', 'Table ' + table.label + ' seats only ' + table.cap + '.');
          }

          var all = reservations();
          var blocked = TpEngine.liveBlocked(manualStatus()[table.id], input.date, input.time, CONFIG) ||
            TpEngine.findClash(all, table.id, input.date, input.time, CONFIG.durationMinutes);
          if (blocked) {
            throw new ApiError(409, 'SLOT_TAKEN', 'That table was just taken for this time. Here are fresh options.');
          }

          var stored = {
            id: uid(),
            code: newCode(all),
            tableId: table.id,
            userId: user.id,
            name: input.name.trim(),
            email: input.email.trim().toLowerCase(),
            phone: input.phone,
            date: input.date,
            time: input.time,
            guests: input.guests,
            pref: input.pref,
            requests: String(input.requests || '').trim(),
            status: 'confirmed',
            createdAt: new Date().toISOString()
          };
          TpStorage.write(KEYS.reservations, all.concat([stored]));
          return toReservation(stored);
        });
      },

      myReservations: function () {
        return respond(function () {
          var user = requireUser();
          return reservations()
            .filter(function (r) { return r.userId === user.id; })
            .sort(function (a, b) { return (b.date + b.time).localeCompare(a.date + a.time); })
            .map(toReservation);
        });
      },

      cancelReservation: function (id) {
        return respond(function () {
          var user = requireUser();
          var all = reservations();
          var found = all.filter(function (r) { return r.id === id; })[0];
          if (!found) throw new ApiError(404, 'NOT_FOUND', 'Reservation not found.');
          if (found.userId !== user.id && user.role !== 'manager') {
            throw new ApiError(403, 'FORBIDDEN', 'You can only cancel your own reservations.');
          }
          if (found.status === 'cancelled') throw new ApiError(409, 'ALREADY_CANCELLED', 'This reservation is already cancelled.');
          if (TpDate.isInPast(found.date, found.time)) {
            throw new ApiError(409, 'ALREADY_STARTED', 'This reservation has already started and cannot be cancelled.');
          }
          var updated = angular.extend({}, found, { status: 'cancelled', cancelledAt: new Date().toISOString() });
          TpStorage.write(KEYS.reservations, all.map(function (r) { return r.id === id ? updated : r; }));
          return toReservation(updated);
        });
      },

      // ---- manager ----
      reservationsOn: function (date) {
        return respond(function () {
          requireManager();
          return reservations()
            .filter(function (r) { return r.date === date; })
            .sort(function (a, b) { return a.time.localeCompare(b.time); })
            .map(toReservation);
        });
      },

      getFloor: function (date, time) {
        return respond(function () {
          requireManager();
          return TpEngine.floorStates(TABLES, reservations(), manualStatus(), date, time, CONFIG).map(function (s) {
            return { table: s.table, state: s.state, reservation: s.reservation ? toReservation(s.reservation) : null };
          });
        });
      },

      setTableStatus: function (tableId, status) {
        return respond(function () {
          requireManager();
          if (!TABLES.some(function (t) { return t.id === tableId; })) throw new ApiError(404, 'NOT_FOUND', 'Table not found.');
          var next = angular.extend({}, manualStatus());
          next[tableId] = status;
          TpStorage.write(KEYS.status, next);
        });
      }
    };
  }
})();

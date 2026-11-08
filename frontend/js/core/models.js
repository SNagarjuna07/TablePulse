(function () {
  'use strict';

  // Shapes (see API_CONTRACT.md):
  //   User        { id, name, email, role: 'customer'|'manager' }
  //   Table       { id, label, cap, zone: 'window'|'quiet'|'outdoor'|'centre' }
  //   Reservation { id, code, table, name, email, phone, date, time, endTime, guests, pref,
  //                 requests, status: 'confirmed'|'cancelled', createdAt, cancelledAt? }
  //   FloorSlot   { table, state: 'available'|'reserved'|'occupied'|'cleaning', reservation|null }

  angular
    .module('tablepulse')
    .constant('TP_ZONE_NAMES', {
      window: 'Window side',
      quiet: 'Quiet corner',
      outdoor: 'Outdoor seating',
      centre: 'Near the centre',
      any: 'Any available table'
    })
    .constant('TP_PREF_OPTIONS', [
      { value: 'window', label: 'Window side' },
      { value: 'quiet', label: 'Quiet corner' },
      { value: 'outdoor', label: 'Outdoor seating' },
      { value: 'centre', label: 'Near the centre' },
      { value: 'any', label: 'Any available table' }
    ])
    .constant('TpKeys', { TOKEN: 'tp_token', USER: 'tp_user' })
    .factory('TpStorage', function () {
      return {
        read: function (key, fallback) {
          try {
            var raw = localStorage.getItem(key);
            return raw === null ? fallback : JSON.parse(raw);
          } catch (e) {
            return fallback;
          }
        },
        write: function (key, value) {
          localStorage.setItem(key, JSON.stringify(value));
        }
      };
    });
})();

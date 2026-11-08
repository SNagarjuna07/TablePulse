(function () {
  'use strict';

  // Pure business logic. Does not touch Angular, the DOM or localStorage,
  // so it ports straight to Node/Express (replace TpDate with plain helpers).
  angular.module('tablepulse').factory('TpEngine', ['TpDate', 'TP_ZONE_NAMES', function (TpDate, ZONE_NAMES) {

    // Two time ranges overlap when each starts before the other ends. Back-to-back is allowed.
    function overlaps(aStart, aEnd, bStart, bEnd) { return aStart < bEnd && aEnd > bStart; }

    // Confirmed reservation on the same table and date whose window overlaps the requested one.
    function findClash(reservations, tableId, date, time, durationMinutes, ignoreId) {
      var start = TpDate.toMinutes(time);
      var end = start + durationMinutes;
      for (var i = 0; i < reservations.length; i++) {
        var r = reservations[i];
        if (r.status !== 'confirmed' || r.tableId !== tableId || r.date !== date || r.id === ignoreId) continue;
        var rStart = TpDate.toMinutes(r.time);
        if (overlaps(start, end, rStart, rStart + durationMinutes)) return r;
      }
      return undefined;
    }

    // A table marked occupied/cleaning is unavailable only for TODAY, and only for slots that start
    // before the table could be free again (now + reservation duration). Never blocks other dates.
    function liveBlocked(status, date, time, cfg, now) {
      var d = now || new Date();
      if (status !== 'occupied' && status !== 'cleaning') return false;
      if (date !== TpDate.todayString(d)) return false;
      return TpDate.slotDate(date, time).getTime() < d.getTime() + cfg.durationMinutes * 60000;
    }

    // FlowSense: transparent rule-based ranking. Returns the top 3 tables.
    function recommend(tables, reservations, manual, q, cfg, now) {
      var results = [];

      tables.forEach(function (table) {
        // Hard rules: never recommend these tables.
        if (table.cap < q.guests) return;
        if (liveBlocked(manual[table.id], q.date, q.time, cfg, now)) return;
        if (findClash(reservations, table.id, q.date, q.time, cfg.durationMinutes)) return;

        var reasons = [];
        var match = 0;

        // Rule A (max 40): capacity fit. An exact fit scores highest.
        var extra = table.cap - q.guests;
        match += extra === 0 ? 40 : extra === 1 ? 36 : extra === 2 ? 28 : 16;
        reasons.push(extra === 0
          ? 'Seats exactly ' + table.cap + ', a perfect fit for your party'
          : 'Seats ' + table.cap + ', room for your party of ' + q.guests);

        // Rule B (max 40): seating preference.
        if (q.pref === table.zone) {
          match += 40;
          reasons.push(ZONE_NAMES[table.zone] + ', as you preferred');
        } else if (q.pref === 'any') {
          match += 25;
          reasons.push('Open to any seating, so this is a flexible choice');
        } else {
          match += 10;
          reasons.push(ZONE_NAMES[table.zone] + ' is available if your first choice is full');
        }

        // Rule C (20): free for the whole stay.
        match += 20;
        reasons.push('No overlapping reservation during your stay');

        results.push({ table: table, match: match, reasons: reasons });
      });

      results.sort(function (a, b) {
        return b.match - a.match || a.table.cap - b.table.cap || a.table.id.localeCompare(b.table.id);
      });
      return results.slice(0, 3);
    }

    // State of every table at one date and time. Manual status only applies to today.
    function floorStates(tables, reservations, manual, date, time, cfg, now) {
      var d = now || new Date();
      var t = TpDate.toMinutes(time);
      var isToday = date === TpDate.todayString(d);

      return tables.map(function (table) {
        var reservation = null;
        for (var i = 0; i < reservations.length; i++) {
          var r = reservations[i];
          var rStart = TpDate.toMinutes(r.time);
          if (r.status === 'confirmed' && r.tableId === table.id && r.date === date &&
              rStart <= t && t < rStart + cfg.durationMinutes) {
            reservation = r;
            break;
          }
        }
        var status = manual[table.id];
        var state = 'available';
        if (isToday && (status === 'occupied' || status === 'cleaning')) state = status;
        else if (reservation) state = 'reserved';
        return { table: table, state: state, reservation: reservation };
      });
    }

    return { overlaps: overlaps, findClash: findClash, liveBlocked: liveBlocked, recommend: recommend, floorStates: floorStates };
  }]);
})();

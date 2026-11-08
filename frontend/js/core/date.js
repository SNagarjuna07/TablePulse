(function () {
  'use strict';

  // All dates are YYYY-MM-DD and all times are HH:MM in the restaurant's local time.
  angular.module('tablepulse').factory('TpDate', function () {
    function pad2(n) { return String(n).padStart(2, '0'); }

    function toDateString(d) {
      if (!(d instanceof Date) || isNaN(d.getTime())) return '';
      return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
    }

    function todayString(now) { return toDateString(now || new Date()); }

    function fromDateString(s) { return s ? new Date(s + 'T00:00:00') : null; }

    function toMinutes(time) {
      var p = time.split(':');
      return Number(p[0]) * 60 + Number(p[1]);
    }

    function fromMinutes(total) { return pad2(Math.floor(total / 60)) + ':' + pad2(total % 60); }

    function slotDate(date, time) { return new Date(date + 'T' + time + ':00'); }

    // True when the slot starts earlier than now + lead minutes.
    function isInPast(date, time, leadMinutes, nowMs) {
      var now = nowMs === undefined ? Date.now() : nowMs;
      return slotDate(date, time).getTime() < now + (leadMinutes || 0) * 60000;
    }

    // Every bookable start time. The last one still ends before closing.
    function buildSlots(cfg) {
      var slots = [];
      var last = toMinutes(cfg.closeTime) - cfg.durationMinutes;
      for (var m = toMinutes(cfg.openTime); m <= last; m += cfg.slotMinutes) slots.push(fromMinutes(m));
      return slots;
    }

    function lastSeating(cfg) {
      var slots = buildSlots(cfg);
      return slots.length ? slots[slots.length - 1] : cfg.openTime;
    }

    // First slot at or after now, otherwise the last slot of the day.
    function nextSlot(slots, now) {
      var d = now || new Date();
      var current = d.getHours() * 60 + d.getMinutes();
      for (var i = 0; i < slots.length; i++) if (toMinutes(slots[i]) >= current) return slots[i];
      return slots.length ? slots[slots.length - 1] : '';
    }

    function formatTime(time) {
      if (!time) return '';
      var p = time.split(':');
      var h = Number(p[0]);
      return (h % 12 || 12) + ':' + pad2(Number(p[1])) + ' ' + (h >= 12 ? 'PM' : 'AM');
    }

    function formatDate(date) {
      if (!date) return '';
      return new Date(date + 'T00:00:00').toLocaleDateString('en-IN', {
        weekday: 'short', day: 'numeric', month: 'short', year: 'numeric'
      });
    }

    return {
      pad2: pad2, toDateString: toDateString, todayString: todayString, fromDateString: fromDateString,
      toMinutes: toMinutes, fromMinutes: fromMinutes, slotDate: slotDate, isInPast: isInPast,
      buildSlots: buildSlots, lastSeating: lastSeating, nextSlot: nextSlot,
      formatTime: formatTime, formatDate: formatDate
    };
  });
})();

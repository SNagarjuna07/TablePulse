(function () {
  'use strict';

  // Business rules shared by the forms and the mock server.
  // The Express backend must enforce the same rules (see API_CONTRACT.md).
  angular.module('tablepulse').factory('TpValidation', ['TpDate', function (TpDate) {
    var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    var DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

    function normalizePhone(phone) { return String(phone || '').replace(/[\s-]/g, ''); }

    // Party size, date and time. Used before searching for tables.
    function validateSearch(v, cfg) {
      var errs = {};

      if (!Number.isInteger(v.guests) || v.guests < 1) {
        errs.guests = 'Please choose the number of guests.';
      } else if (v.guests > cfg.maxPartySize) {
        errs.guests = 'Our largest table seats ' + cfg.maxPartySize + '. For bigger groups, please call the restaurant.';
      }

      if (!v.date || !DATE_RE.test(v.date)) errs.date = 'Please choose a reservation date.';
      else if (v.date < TpDate.todayString()) errs.date = 'The reservation date cannot be in the past.';

      if (!v.time) {
        errs.time = 'Please choose a reservation time.';
      } else if (TpDate.buildSlots(cfg).indexOf(v.time) === -1) {
        errs.time = 'Choose a time between ' + TpDate.formatTime(cfg.openTime) + ' and ' + TpDate.formatTime(TpDate.lastSeating(cfg)) + '.';
      } else if (!errs.date && TpDate.isInPast(v.date, v.time, cfg.minLeadMinutes)) {
        errs.time = cfg.minLeadMinutes > 0
          ? 'Please book at least ' + cfg.minLeadMinutes + ' minutes ahead.'
          : 'That time has already passed.';
      }
      return errs;
    }

    // Contact details plus search fields. Used before creating a reservation.
    function validateBooking(v, cfg) {
      var errs = {};
      if (String(v.name || '').trim().length < 2) errs.name = 'Please enter your full name.';
      if (!EMAIL_RE.test(String(v.email || '').trim())) errs.email = 'Please enter a valid email address.';
      if (!/^\d{10}$/.test(normalizePhone(v.phone))) errs.phone = 'Phone number must be 10 digits.';
      return angular.extend(errs, validateSearch(v, cfg));
    }

    return {
      EMAIL_RE: EMAIL_RE, normalizePhone: normalizePhone,
      validateSearch: validateSearch, validateBooking: validateBooking
    };
  }]);
})();

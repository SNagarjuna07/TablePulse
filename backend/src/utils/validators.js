// Same rules as the frontend (js/core/validation.js). The server never trusts the browser.
const {
  toInstant,
  restaurantToday,
  buildSlots,
  formatClock,
} = require("./time");

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const PREFS = ["window", "quiet", "outdoor", "centre", "any"];
const OBJECT_ID_RE = /^[a-f\d]{24}$/i;

// "98765 43210" or "98765-43210" -> "9876543210"
function normalizePhone(phone) {
  return String(phone || "").replace(/[\s-]/g, "");
}

function validateRegister(input) {
  const errors = {};
  if (typeof input.name !== "string" || input.name.trim().length < 2)
    errors.name = "Please enter your full name.";
  if (typeof input.email !== "string" || !EMAIL_RE.test(input.email.trim()))
    errors.email = "Please enter a valid email address.";
  if (typeof input.password !== "string" || input.password.length < 8)
    errors.password = "Password must be at least 8 characters.";
  else if (input.password.length > 72)
    errors.password = "Password must be at most 72 characters."; // bcrypt limit
  return errors;
}

function validateLogin(input) {
  const errors = {};
  if (typeof input.email !== "string" || !input.email.trim())
    errors.email = "Please enter your email.";
  if (typeof input.password !== "string" || !input.password)
    errors.password = "Please enter your password.";
  return errors;
}

// Date and time of a booking: a real date, not in the past, on a bookable slot, with enough notice.
// "now" can be passed in so tests can fake the clock.
function validateSlot(date, time, cfg, now = new Date()) {
  const errors = {};

  if (
    typeof date !== "string" ||
    !DATE_RE.test(date) ||
    toInstant(date, "00:00") === null
  ) {
    errors.date = "Please choose a reservation date.";
  } else if (date < restaurantToday(now)) {
    errors.date = "The reservation date cannot be in the past.";
  }

  const slots = buildSlots(cfg);
  if (typeof time !== "string" || !time) {
    errors.time = "Please choose a reservation time.";
  } else if (!slots.includes(time)) {
    errors.time = `Choose a time between ${formatClock(slots[0])} and ${formatClock(slots[slots.length - 1])}.`;
  } else if (
    !errors.date &&
    toInstant(date, time).getTime() < now.getTime() + cfg.minLeadMinutes * 60000
  ) {
    errors.time =
      cfg.minLeadMinutes > 0
        ? `Please book at least ${cfg.minLeadMinutes} minutes ahead.`
        : "That time has already passed.";
  }
  return errors;
}

// Reads ?date=&time=&guests=&pref= (all arrive as text). Returns { errors, value }.
function parseSearch(query, cfg, now = new Date()) {
  const errors = {};
  const guests =
    typeof query.guests === "string" && /^\d+$/.test(query.guests)
      ? Number(query.guests)
      : NaN;

  if (!Number.isInteger(guests) || guests < 1)
    errors.guests = "Please choose the number of guests.";
  else if (guests > cfg.maxPartySize) {
    errors.guests = `Our largest table seats ${cfg.maxPartySize}. For bigger groups, please call the restaurant.`;
  }

  const pref = query.pref === undefined ? "any" : query.pref;
  if (!PREFS.includes(pref)) errors.pref = "Choose a valid seating preference.";

  Object.assign(errors, validateSlot(query.date, query.time, cfg, now));
  return {
    errors,
    value: { date: query.date, time: query.time, guests, pref },
  };
}

// Body of POST /api/reservations (JSON, so guests is a real number here).
// Same rules as the frontend booking form, plus table id and field types.
function validateBooking(input, cfg, now = new Date()) {
  const errors = {};

  if (typeof input.tableId !== "string" || !OBJECT_ID_RE.test(input.tableId))
    errors.tableId = "Please choose a table.";
  if (typeof input.name !== "string" || input.name.trim().length < 2)
    errors.name = "Please enter your full name.";
  if (typeof input.email !== "string" || !EMAIL_RE.test(input.email.trim()))
    errors.email = "Please enter a valid email address.";
  if (
    typeof input.phone !== "string" ||
    !/^\d{10}$/.test(normalizePhone(input.phone))
  )
    errors.phone = "Phone number must be 10 digits.";

  if (!Number.isInteger(input.guests) || input.guests < 1)
    errors.guests = "Please choose the number of guests.";
  else if (input.guests > cfg.maxPartySize) {
    errors.guests = `Our largest table seats ${cfg.maxPartySize}. For bigger groups, please call the restaurant.`;
  }

  if (input.pref !== undefined && !PREFS.includes(input.pref))
    errors.pref = "Choose a valid seating preference.";
  if (
    input.requests !== undefined &&
    (typeof input.requests !== "string" || input.requests.length > 200)
  ) {
    errors.requests = "Special requests must be at most 200 characters.";
  }

  Object.assign(errors, validateSlot(input.date, input.time, cfg, now));
  return errors;
}

module.exports = {
  EMAIL_RE,
  DATE_RE,
  OBJECT_ID_RE,
  PREFS,
  normalizePhone,
  validateRegister,
  validateLogin,
  validateSlot,
  parseSearch,
  validateBooking,
};
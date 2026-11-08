const { DateTime } = require("luxon");
const env = require("../config/env");

// The frontend sends date "2026-11-09" and time "19:00" in the RESTAURANT's local time.
// The database stores real instants (UTC Dates), so a server in any country gives the same answer.

// "2026-11-09" + "19:00"  ->  Date (or null if it is not a real date/time)
function toInstant(date, time) {
  const dt = DateTime.fromISO(`${date}T${time}`, { zone: env.timeZone });
  return dt.isValid ? dt.toJSDate() : null;
}

function addMinutes(instant, minutes) {
  return new Date(instant.getTime() + minutes * 60000);
}

// Date -> "21:00" in restaurant time
function timeOf(instant) {
  return DateTime.fromJSDate(instant, { zone: env.timeZone }).toFormat("HH:mm");
}

// Today's date in restaurant time, "YYYY-MM-DD" (pass "now" in tests to fake the clock)
function restaurantToday(now = new Date()) {
  return DateTime.fromJSDate(now).setZone(env.timeZone).toISODate();
}

function toMinutes(time) {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

function fromMinutes(total) {
  return (
    String(Math.floor(total / 60)).padStart(2, "0") +
    ":" +
    String(total % 60).padStart(2, "0")
  );
}

// Every bookable start time. The last one still ends before closing.
// [{openTime, closeTime, slotMinutes, durationMinutes}] -> ["11:00", "11:30", ... "21:00"]
function buildSlots(cfg) {
  const slots = [];
  const last = toMinutes(cfg.closeTime) - cfg.durationMinutes;
  for (let m = toMinutes(cfg.openTime); m <= last; m += cfg.slotMinutes)
    slots.push(fromMinutes(m));
  return slots;
}

// "19:00" -> "7:00 PM" (for messages)
function formatClock(time) {
  const [h, m] = time.split(":").map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
}

module.exports = {
  toInstant,
  addMinutes,
  timeOf,
  restaurantToday,
  toMinutes,
  fromMinutes,
  buildSlots,
  formatClock,
};

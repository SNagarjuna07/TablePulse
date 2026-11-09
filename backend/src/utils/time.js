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

// Today's date in restaurant time, "YYYY-MM-DD"
function restaurantToday() {
  return DateTime.now().setZone(env.timeZone).toISODate();
}

module.exports = { toInstant, addMinutes, timeOf, restaurantToday };
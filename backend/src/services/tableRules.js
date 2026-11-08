const { restaurantToday } = require("../utils/time");

// A table the manager marked "occupied" or "cleaning" is unavailable only for TODAY, and only for
// bookings that start before the table could be free again (now + one reservation length).
// It never blocks tomorrow or later. ("reserved" is not a stored status: it comes from slot locks.)
function isLiveBlocked(table, date, startAt, cfg, now = new Date()) {
  if (table.status !== "occupied" && table.status !== "cleaning") return false;
  if (date !== restaurantToday(now)) return false;
  return startAt.getTime() < now.getTime() + cfg.durationMinutes * 60000;
}

module.exports = { isLiveBlocked };
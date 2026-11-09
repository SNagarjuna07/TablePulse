const Table = require("../models/Table");
const Reservation = require("../models/Reservation");
const ApiError = require("../utils/ApiError");
const { validateFloorQuery } = require("../utils/validators");
const { toInstant, restaurantToday } = require("../utils/time");

// State of every table at one date and time, for the manager's floor plan.
//   reserved  = a confirmed booking covers that moment (start included, end NOT included)
//   occupied / cleaning = set by hand, and only counts when the chosen day is TODAY
//   available = none of the above
// "now" can be passed in tests to fake the clock.
async function getFloor(query, now = new Date()) {
  const errors = validateFloorQuery(query);
  if (Object.keys(errors).length) throw ApiError.validation(undefined, errors);

  const at = toInstant(query.date, query.time);
  const isToday = query.date === restaurantToday(now);

  const [tables, covering] = await Promise.all([
    Table.find().sort({ label: 1 }),
    Reservation.find({
      status: "confirmed",
      startAt: { $lte: at },
      endAt: { $gt: at },
    }).populate("table"),
  ]);
  const byTable = new Map(
    covering.filter((r) => r.table).map((r) => [String(r.table._id), r]),
  );

  return tables.map((table) => {
    const reservation = byTable.get(String(table._id)) || null;
    let state = "available";
    if (isToday && (table.status === "occupied" || table.status === "cleaning"))
      state = table.status;
    else if (reservation) state = "reserved";
    return { table, state, reservation };
  });
}

module.exports = { getFloor };
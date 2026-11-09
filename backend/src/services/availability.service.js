const Table = require("../models/Table");
const SlotLock = require("../models/SlotLock");
const ApiError = require("../utils/ApiError");
const { parseSearch } = require("../utils/validators");
const { toInstant, addMinutes } = require("../utils/time");
const configService = require("./config.service");
const { isLiveBlocked } = require("./tableRules");
const { rankTables } = require("./flowsense.service");

// Ids of tables that have ANY lock inside [startAt, endAt). Slot locks are the same data the
// booking step uses to refuse overlaps, so what we offer here is what can really be booked.
// A lock starting exactly at endAt (the next guest's booking) does not count: back-to-back is fine.
async function busyTableIds(tableIds, startAt, endAt) {
  const locks = await SlotLock.find({
    table: { $in: tableIds },
    cell: { $gte: startAt, $lt: endAt },
  })
    .select("table")
    .lean();
  return new Set(locks.map((lock) => String(lock.table)));
}

// Top 3 tables for a party at a date and time. "now" can be passed in tests.
async function recommend(query, now = new Date()) {
  const cfg = await configService.getConfig();
  const { errors, value } = parseSearch(query, cfg, now);
  if (Object.keys(errors).length) throw ApiError.validation(undefined, errors);

  const startAt = toInstant(value.date, value.time);
  const endAt = addMinutes(startAt, cfg.durationMinutes);

  // 1. big enough   2. not held back by the manager right now   3. no overlapping booking
  const tables = await Table.find({ cap: { $gte: value.guests } }).sort({
    label: 1,
  });
  const usable = tables.filter(
    (t) => !isLiveBlocked(t, value.date, startAt, cfg, now),
  );
  const busy = await busyTableIds(
    usable.map((t) => t._id),
    startAt,
    endAt,
  );
  const free = usable.filter((t) => !busy.has(String(t._id)));

  return rankTables(free, value);
}

module.exports = { recommend, busyTableIds };
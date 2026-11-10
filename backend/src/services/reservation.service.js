const mongoose = require("mongoose");
const Table = require("../models/Table");
const Reservation = require("../models/Reservation");
const ApiError = require("../utils/ApiError");
const codeUtil = require("../utils/code");
const {
  validateBooking,
  normalizePhone,
  OBJECT_ID_RE,
  validateDay,
} = require("../utils/validators");
const { toInstant, addMinutes } = require("../utils/time");
const configService = require("./config.service");
const slotLock = require("./slotLock.service");
const { isLiveBlocked } = require("./tableRules");

const slotTaken = () =>
  ApiError.conflict(
    "SLOT_TAKEN",
    "That table was just taken for this time. Here are fresh options.",
  );

// Save the reservation. A booking code is random, so in the (very rare) case it already exists
// the unique index says no, and we simply try a new code.
async function saveWithUniqueCode(fields) {
  for (let attempt = 1; ; attempt++) {
    try {
      return await Reservation.create({
        ...fields,
        code: codeUtil.generateCode(),
      });
    } catch (err) {
      if (!slotLock.isDuplicateKey(err) || attempt >= 5) throw err;
    }
  }
}

// Book a table for "user". "now" can be passed in tests to fake the clock.
//   1. check the input        2. check the table        3. take the slot locks (the database refuses overlaps)
//   4. save the reservation   5. if saving fails, give the locks back
async function createReservation(user, input, now = new Date()) {
  const cfg = await configService.getConfig();
  const errors = validateBooking(input, cfg, now);
  if (Object.keys(errors).length) throw ApiError.validation(undefined, errors);

  const table = await Table.findById(input.tableId);
  if (!table) throw ApiError.notFound("Table not found.");
  if (table.cap < input.guests) {
    throw new ApiError(
      422,
      "TABLE_TOO_SMALL",
      `Table ${table.label} seats only ${table.cap}.`,
    );
  }

  const startAt = toInstant(input.date, input.time);
  const endAt = addMinutes(startAt, cfg.durationMinutes);

  // The manager is holding this table (occupied/cleaning) and the booking starts soon.
  if (isLiveBlocked(table, input.date, startAt, cfg, now)) throw slotTaken();

  // The id is made first so the locks and the reservation point to each other.
  const _id = new mongoose.Types.ObjectId();
  const claimed = await slotLock.claim({
    tableId: table._id,
    reservationId: _id,
    startAt,
    endAt,
  });
  if (!claimed) throw slotTaken();

  try {
    // Only these fields are read from the request. "status", "user", "code" and "startAt" can never be sent in.
    const reservation = await saveWithUniqueCode({
      _id,
      table: table._id,
      user: user._id,
      name: input.name.trim(),
      email: input.email.trim().toLowerCase(),
      phone: normalizePhone(input.phone),
      date: input.date,
      time: input.time,
      startAt,
      endAt,
      guests: input.guests,
      pref: input.pref || "any",
      requests: input.requests || "",
    });
    return await reservation.populate("table");
  } catch (err) {
    await slotLock.release(_id);
    throw err;
  }
}

// The signed-in user's own reservations, newest first.
async function listMine(user) {
  return Reservation.find({ user: user._id })
    .sort({ startAt: -1 })
    .populate("table");
}

const alreadyCancelled = () =>
  ApiError.conflict(
    "ALREADY_CANCELLED",
    "This reservation is already cancelled.",
  );
const alreadyStarted = () =>
  ApiError.conflict(
    "ALREADY_STARTED",
    "This reservation has already started and cannot be cancelled.",
  );

// Cancel a reservation. Allowed for its owner or a manager. "now" can be passed in tests.
// The row is kept (status "cancelled") so there is history; only the slot locks are removed.
async function cancelReservation(user, id, now = new Date()) {
  const notFound = () => ApiError.notFound("Reservation not found.");
  if (!OBJECT_ID_RE.test(id)) throw notFound();

  const found = await Reservation.findById(id);
  if (!found) throw notFound();
  if (String(found.user) !== String(user._id) && user.role !== "manager") {
    throw ApiError.forbidden("You can only cancel your own reservations.");
  }
  if (found.status === "cancelled") throw alreadyCancelled();
  if (found.startAt.getTime() < now.getTime()) throw alreadyStarted();

  // One atomic step: "change it only if it is still confirmed and has not started".
  // If two cancels arrive together, only one finds a match; the other gets null.
  const updated = await Reservation.findOneAndUpdate(
    { _id: id, status: "confirmed", startAt: { $gte: now } },
    { $set: { status: "cancelled", cancelledAt: now } },
    { returnDocument: "after" },
  );
  if (!updated) {
    const latest = await Reservation.findById(id);
    throw latest && latest.status === "cancelled"
      ? alreadyCancelled()
      : alreadyStarted();
  }

  await slotLock.release(updated._id); // the table is free for someone else again
  return await updated.populate("table");
}

// Manager: every reservation on one day (cancelled ones too), earliest first.
async function listByDate(query) {
  const errors = validateDay(query.date);
  if (Object.keys(errors).length) throw ApiError.validation(undefined, errors);
  return Reservation.find({ date: query.date })
    .sort({ time: 1, createdAt: 1 })
    .populate("table");
}

module.exports = { createReservation, listMine, cancelReservation, listByDate };

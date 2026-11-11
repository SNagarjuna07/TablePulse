const SlotLock = require("../models/SlotLock");

// Size of one cell. Every booking is cut into cells of this size, so it must divide the slot step
// and the reservation duration evenly (30 and 120 are both multiples of 15).
const CELL_MINUTES = 15;
const CELL_MS = CELL_MINUTES * 60000;

// [19:00, 19:15, ... 20:45] for a booking from 19:00 to 21:00. Always oldest first.
function cellsFor(startAt, endAt) {
  const cells = [];
  for (let t = startAt.getTime(); t < endAt.getTime(); t += CELL_MS)
    cells.push(new Date(t));
  return cells;
}

function isDuplicateKey(err) {
  return (
    !!err &&
    (err.code === 11000 ||
      (Array.isArray(err.writeErrors) &&
        err.writeErrors.some((e) => e.code === 11000)))
  );
}

// Try to take every cell of a booking. Returns true if all are ours, false if any overlaps.
// Cells are inserted oldest first, so of two overlapping requests exactly one reaches the shared
// cell first and wins, and the other stops there. No transaction needed.
async function claim({ tableId, reservationId, startAt, endAt }) {
  if (startAt.getTime() % CELL_MS !== 0) {
    throw new Error(
      "startAt must fall on a 15-minute boundary, or overlaps could be missed.",
    );
  }
  const locks = cellsFor(startAt, endAt).map((cell) => ({
    table: tableId,
    cell,
    reservation: reservationId,
  }));

  try {
    await SlotLock.insertMany(locks, { ordered: true });
    return true;
  } catch (err) {
    await SlotLock.deleteMany({ reservation: reservationId }); // give back the cells we did get
    if (isDuplicateKey(err)) return false;
    throw err;
  }
}

// Free the table again (used when a reservation is cancelled or fails to save).
async function release(reservationId) {
  await SlotLock.deleteMany({ reservation: reservationId });
}

module.exports = { CELL_MINUTES, cellsFor, isDuplicateKey, claim, release };
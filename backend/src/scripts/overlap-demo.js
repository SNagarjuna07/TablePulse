// Run with: npm run demo:overlap
// Proves the double-booking protection against YOUR database. It cleans up after itself.
const mongoose = require("mongoose");
const env = require("../config/env");
const Table = require("../models/Table");
const User = require("../models/User");
const Reservation = require("../models/Reservation");
const SlotLock = require("../models/SlotLock");
const slotLock = require("../services/slotLock.service");
const restaurant = require("../config/restaurant");
const { toInstant, addMinutes } = require("../utils/time");
const { generateCode } = require("../utils/code");

const DATE = "2099-01-15"; // far in the future so it never mixes with real bookings

// A small draft of what step 6 will do: take the slot locks first, then save the reservation.
async function book(table, user, time) {
  const startAt = toInstant(DATE, time);
  const endAt = addMinutes(startAt, restaurant.durationMinutes);
  const _id = new mongoose.Types.ObjectId();

  const got = await slotLock.claim({
    tableId: table._id,
    reservationId: _id,
    startAt,
    endAt,
  });
  if (!got) return null;
  try {
    return await Reservation.create({
      _id,
      code: generateCode(),
      table: table._id,
      user: user._id,
      name: "Demo Guest",
      email: "demo@example.com",
      phone: "9876543210",
      date: DATE,
      time,
      startAt,
      endAt,
      guests: 2,
    });
  } catch (err) {
    await slotLock.release(_id);
    throw err;
  }
}

async function cancel(reservation) {
  await Reservation.updateOne(
    { _id: reservation._id },
    { status: "cancelled", cancelledAt: new Date() },
  );
  await slotLock.release(reservation._id);
}

const show = (label, result) =>
  console.log(`${label.padEnd(44)} ${result ? "BOOKED" : "blocked (overlap)"}`);

async function main() {
  await mongoose.connect(env.mongoUri);
  await Promise.all([Reservation.init(), SlotLock.init()]);

  const [t1, t2, user] = await Promise.all([
    Table.findOne({ label: "T01" }),
    Table.findOne({ label: "T02" }),
    User.findOne(),
  ]);
  if (!t1 || !t2 || !user) throw new Error('Run "npm run seed" first.');

  try {
    console.log(
      `Table ${t1.label}, date ${DATE}, each booking lasts ${restaurant.durationMinutes} minutes\n`,
    );
    const a = await book(t1, user, "19:00");
    show("A  19:00-21:00", a);
    show("B  20:00-22:00 (overlaps A)", await book(t1, user, "20:00"));
    show("C  18:00-20:00 (overlaps A)", await book(t1, user, "18:00"));
    show("D  21:00-23:00 (right after A)", await book(t1, user, "21:00"));

    await cancel(a);
    console.log("--- A cancelled ---");
    show("E  19:00-21:00 (A gave it back)", await book(t1, user, "19:00"));

    console.log(
      "\n10 guests try table",
      t2.label,
      "at 19:00 at the very same moment:",
    );
    const results = await Promise.all(
      Array.from({ length: 10 }, () => book(t2, user, "19:00")),
    );
    console.log(
      `  booked: ${results.filter(Boolean).length}, blocked: ${results.filter((r) => !r).length}`,
    );
  } finally {
    const ids = (await Reservation.find({ date: DATE }).select("_id")).map(
      (r) => r._id,
    );
    await SlotLock.deleteMany({ reservation: { $in: ids } });
    await Reservation.deleteMany({ date: DATE });
    console.log("\nDemo data removed.");
    await mongoose.disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
// Run with: npm run demo:cancel-race
// 20 "double clicks" cancel the same booking at the same moment. MongoDB must let exactly ONE win.
// Exit code 0 = exactly one winner, 1 = something is wrong (CI uses this).
const mongoose = require("mongoose");
const env = require("../config/env");
const Table = require("../models/Table");
const User = require("../models/User");
const Reservation = require("../models/Reservation");
const SlotLock = require("../models/SlotLock");
const reservationService = require("../services/reservation.service");

const DATE = "2099-03-01";

async function main() {
  await mongoose.connect(env.mongoUri);
  await Promise.all([Reservation.init(), SlotLock.init()]);
  const [table, user] = await Promise.all([
    Table.findOne({ label: "T05" }),
    User.findOne(),
  ]);
  if (!table || !user) throw new Error('Run "npm run seed" first.');

  let failed = false;
  try {
    const booking = await reservationService.createReservation(user, {
      tableId: String(table._id),
      name: "Demo Guest",
      email: "demo@example.com",
      phone: "9876543210",
      date: DATE,
      time: "19:00",
      guests: 2,
      pref: "any",
      requests: "",
    });
    console.log(
      `Booked ${booking.code} on ${table.label}. Now 20 cancels at the same moment...\n`,
    );

    const results = await Promise.allSettled(
      Array.from({ length: 20 }, () =>
        reservationService.cancelReservation(user, String(booking._id)),
      ),
    );
    const winners = results.filter((r) => r.status === "fulfilled").length;
    const already = results.filter(
      (r) => r.status === "rejected" && r.reason.code === "ALREADY_CANCELLED",
    ).length;
    const other = results.length - winners - already;
    const row = await Reservation.findById(booking._id);
    const locksLeft = await SlotLock.countDocuments({
      reservation: booking._id,
    });

    console.log(`  cancelled (winners):        ${winners}   <- expected 1`);
    console.log(`  ALREADY_CANCELLED replies:  ${already}   <- expected 19`);
    console.log(`  anything else:              ${other}   <- expected 0`);
    console.log(
      `\n  status in database: ${row.status}, slot locks left: ${locksLeft} (expected 0)`,
    );
    failed =
      winners !== 1 ||
      already !== 19 ||
      other !== 0 ||
      row.status !== "cancelled" ||
      locksLeft !== 0;
  } finally {
    const ids = (await Reservation.find({ date: DATE }).select("_id")).map(
      (r) => r._id,
    );
    await SlotLock.deleteMany({ reservation: { $in: ids } });
    await Reservation.deleteMany({ date: DATE });
    console.log("\nDemo data removed.");
    await mongoose.disconnect();
  }
  console.log(failed ? "\nSOME CHECKS FAILED" : "\nALL CHECKS PASSED");
  process.exitCode = failed ? 1 : 0;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
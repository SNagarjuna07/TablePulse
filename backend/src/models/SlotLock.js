const mongoose = require("mongoose");

// One document = one table is taken during one 15-minute "cell".
// A 2-hour booking holds 8 cells. The UNIQUE index below means the database itself refuses
// two bookings that overlap on the same table, even if both requests arrive at the same moment.
const slotLockSchema = new mongoose.Schema({
  table: { type: mongoose.Schema.Types.ObjectId, ref: "Table", required: true },
  cell: { type: Date, required: true }, // start of the 15-minute cell
  reservation: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Reservation",
    required: true,
    index: true,
  },
});

slotLockSchema.index({ table: 1, cell: 1 }, { unique: true });

module.exports = mongoose.model("SlotLock", slotLockSchema);
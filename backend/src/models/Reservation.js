const mongoose = require("mongoose");
const { timeOf } = require("../utils/time");

const reservationSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true }, // TP-8K2M4Q
    table: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Table",
      required: true,
    },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    phone: { type: String, required: true, trim: true },

    // What the guest chose, in restaurant local time (shown back to the frontend as is)
    date: {
      type: String,
      required: true,
      match: [/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD."],
    },
    time: {
      type: String,
      required: true,
      match: [/^\d{2}:\d{2}$/, "Time must be HH:MM."],
    },
    // The same moment as real instants. Used for "not in the past", sorting and slot locks.
    startAt: { type: Date, required: true },
    endAt: { type: Date, required: true },

    guests: { type: Number, required: true, min: 1 },
    pref: {
      type: String,
      enum: ["window", "quiet", "outdoor", "centre", "any"],
      default: "any",
    },
    requests: { type: String, default: "", trim: true, maxlength: 200 },

    status: {
      type: String,
      enum: ["confirmed", "cancelled"],
      default: "confirmed",
    },
    cancelledAt: { type: Date },
  },
  { timestamps: true },
);

// Indexes = fast lookups for the queries the API will run
reservationSchema.index({ user: 1, startAt: -1 }); // "my reservations"
reservationSchema.index({ date: 1, time: 1 }); // manager: one day, sorted by time
reservationSchema.index({ table: 1, startAt: 1 }); // floor plan and availability

// Shape the API sends (see API_CONTRACT.md). "table" is the full table when populated.
reservationSchema.set("toJSON", {
  transform: (doc, ret) => {
    const out = {
      id: String(ret._id),
      code: ret.code,
      table: ret.table && ret.table.label ? ret.table : String(ret.table),
      name: ret.name,
      email: ret.email,
      phone: ret.phone,
      date: ret.date,
      time: ret.time,
      endTime: timeOf(ret.endAt),
      guests: ret.guests,
      pref: ret.pref,
      requests: ret.requests,
      status: ret.status,
      createdAt: ret.createdAt,
    };
    if (ret.cancelledAt) out.cancelledAt = ret.cancelledAt;
    return out;
  },
});

module.exports = mongoose.model("Reservation", reservationSchema);
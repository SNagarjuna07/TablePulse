const mongoose = require("mongoose");

const tableSchema = new mongoose.Schema(
  {
    label: { type: String, required: true, unique: true, trim: true }, // shown to guests, e.g. "T04"
    cap: { type: Number, required: true, min: 1 }, // seats
    zone: {
      type: String,
      required: true,
      enum: ["window", "quiet", "outdoor", "centre"],
    },
    // Hand-set by the manager. "reserved" is NOT stored: it is worked out from reservations.
    status: {
      type: String,
      enum: ["available", "occupied", "cleaning"],
      default: "available",
    },
  },
  { timestamps: true },
);

// What the API sends: { id, label, cap, zone } (status is internal)
tableSchema.set("toJSON", {
  transform: (doc, ret) => ({
    id: String(ret._id),
    label: ret.label,
    cap: ret.cap,
    zone: ret.zone,
  }),
});

module.exports = mongoose.model("Table", tableSchema);

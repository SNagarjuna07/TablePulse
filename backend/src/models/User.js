const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, minlength: 2 },
    // unique + lowercase:
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    // select:false -> the hash is never returned unless a query asks for it
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ["customer", "manager"], default: "customer" },
  },
  { timestamps: true },
);

// What the API sends to the frontend: { id, name, email, role }. Never the hash.
userSchema.set("toJSON", {
  transform: (doc, ret) => ({
    id: String(ret._id),
    name: ret.name,
    email: ret.email,
    role: ret.role,
  }),
});

module.exports = mongoose.model("User", userSchema);

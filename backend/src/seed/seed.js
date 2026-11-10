// Run with: npm run seed   (safe to run many times)
const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");
const env = require("../config/env");
const User = require("../models/User");
const Table = require("../models/Table");

const MANAGER = {
  name: "Restaurant Manager",
  email: process.env.SEED_MANAGER_EMAIL || "manager@tablepulse.demo",
  password: process.env.SEED_MANAGER_PASSWORD || "manager123",
};

const TABLES = [
  { label: "T01", cap: 2, zone: "window" },
  { label: "T02", cap: 4, zone: "window" },
  { label: "T03", cap: 2, zone: "window" },
  { label: "T04", cap: 4, zone: "window" },
  { label: "T05", cap: 4, zone: "centre" },
  { label: "T06", cap: 6, zone: "centre" },
  { label: "T07", cap: 2, zone: "quiet" },
  { label: "T08", cap: 4, zone: "quiet" },
  { label: "T09", cap: 6, zone: "outdoor" },
  { label: "T10", cap: 4, zone: "outdoor" },
  { label: "T11", cap: 8, zone: "centre" },
  { label: "T12", cap: 2, zone: "outdoor" },
];

async function seedManager() {
  const exists = await User.findOne({ email: MANAGER.email });
  if (exists) return console.log(`Manager already exists: ${MANAGER.email}`);
  await User.create({
    name: MANAGER.name,
    email: MANAGER.email,
    role: "manager",
    passwordHash: await bcrypt.hash(MANAGER.password, 10),
  });
  console.log(`Manager created: ${MANAGER.email} / ${MANAGER.password}`);
}

// Upsert by label: running it again fixes cap/zone but never resets a status the manager set.
async function seedTables() {
  for (const t of TABLES) {
    await Table.updateOne(
      { label: t.label },
      {
        $set: { cap: t.cap, zone: t.zone },
        $setOnInsert: { status: "available" },
      },
      { upsert: true },
    );
  }
  console.log(`Tables ready: ${await Table.countDocuments()}`);
}

async function main() {
  await mongoose.connect(env.mongoUri);
  await Promise.all([User.init(), Table.init()]);
  await seedManager();
  await seedTables();
  await mongoose.disconnect();
}

// Tests import the functions above; "npm run seed" runs this file directly.
if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = { MANAGER, TABLES, seedManager, seedTables };
// Run with: npm run seed   (safe to run many times)
const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");
const env = require("../config/env");
const User = require("../models/User");

const MANAGER = {
  name: "Restaurant Manager",
  email: process.env.SEED_MANAGER_EMAIL || "manager@tablepulse.demo",
  password: process.env.SEED_MANAGER_PASSWORD || "manager123",
};

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

async function main() {
  await mongoose.connect(env.mongoUri);
  await User.init();
  await seedManager();
  // Step 3 adds: await seedTables();
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
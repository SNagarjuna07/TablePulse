// Shared test setup. Tests run against a SEPARATE test database and never touch your real data.
// Needs MONGODB_URI_TEST in .env, pointing at a database whose name contains "test".
process.env.RESTAURANT_TZ = "Asia/Kolkata"; // tests assume 19:00 restaurant time = 13:30 UTC
require("dotenv").config();

const testUri = process.env.MONGODB_URI_TEST;
const dbName =
  (/^mongodb(?:\+srv)?:\/\/[^/]+\/([^?]*)/.exec(testUri || "") || [])[1] || "";
if (!testUri || !/test/i.test(dbName)) {
  console.error(
    '\nSet MONGODB_URI_TEST in backend/.env to a database whose name contains "test",',
  );
  console.error(
    "for example: ...mongodb.net/tablepulse_test?retryWrites=true&w=majority\n",
  );
  process.exit(1);
}
if (testUri === process.env.MONGODB_URI) {
  console.error(
    "\nMONGODB_URI_TEST must not be the same as MONGODB_URI. Tests delete data.\n",
  );
  process.exit(1);
}
process.env.MONGODB_URI = testUri; // the app now talks to the test database
process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret-only-for-tests";

const mongoose = require("mongoose");
const app = require("../src/app");
const env = require("../src/config/env");
const User = require("../src/models/User");
const Table = require("../src/models/Table");
const Reservation = require("../src/models/Reservation");
const SlotLock = require("../src/models/SlotLock");
const { seedManager, seedTables } = require("../src/seed/seed");

// Connect, wipe the TEST database, seed manager + 12 tables, start the API on a free port.
async function startServer() {
  await mongoose.connect(env.mongoUri);
  if (!/test/i.test(mongoose.connection.name)) {
    throw new Error(
      `Refusing to run tests on database "${mongoose.connection.name}".`,
    );
  }
  await Promise.all([
    User.init(),
    Table.init(),
    Reservation.init(),
    SlotLock.init(),
  ]);
  await Promise.all([
    SlotLock.deleteMany({}),
    Reservation.deleteMany({}),
    User.deleteMany({}),
    Table.deleteMany({}),
  ]);
  await seedManager();
  await seedTables();

  const server = app.listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  return { server, base: `http://127.0.0.1:${server.address().port}/api` };
}

async function stopServer(ctx) {
  if (ctx.server.closeAllConnections) ctx.server.closeAllConnections();
  await new Promise((resolve) => ctx.server.close(resolve));
  await mongoose.disconnect();
}

// call('/path', { method, body, token, raw }) -> { status, body, text }
function client(base) {
  return async (path, { method = "GET", body, token, raw } = {}) => {
    const res = await fetch(base + path, {
      method,
      headers: {
        ...(body || raw ? { "Content-Type": "application/json" } : {}),
        ...(token ? { Authorization: "Bearer " + token } : {}),
      },
      body: raw || (body ? JSON.stringify(body) : undefined),
    });
    const text = await res.text();
    let json = null;
    try {
      json = JSON.parse(text);
    } catch (e) {
      /* empty body */
    }
    return { status: res.status, body: json, text };
  };
}

let counter = 0;
async function registerUser(call, name = "Test User") {
  const email = `user${++counter}_${Date.now()}@example.com`;
  const res = await call("/auth/register", {
    method: "POST",
    body: { name, email, password: "password1" },
  });
  return { ...res.body, email };
}

async function loginManager(call) {
  const res = await call("/auth/login", {
    method: "POST",
    body: { email: "manager@tablepulse.demo", password: "manager123" },
  });
  return res.body;
}

async function tablesByLabel() {
  return Object.fromEntries((await Table.find()).map((t) => [t.label, t]));
}

// A valid booking body. Far-future date so it never clashes with the real clock.
function bookingInput(table, overrides = {}) {
  return {
    tableId: String(table._id),
    name: "Rani Jain",
    email: "rani@example.com",
    phone: "9876543210",
    date: "2098-06-10",
    time: "19:00",
    guests: 2,
    pref: "any",
    requests: "",
    ...overrides,
  };
}

module.exports = {
  startServer,
  stopServer,
  client,
  registerUser,
  loginManager,
  tablesByLabel,
  bookingInput,
  User,
  Table,
  Reservation,
  SlotLock,
};

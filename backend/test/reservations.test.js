const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const {
  startServer,
  stopServer,
  client,
  registerUser,
  loginManager,
  tablesByLabel,
  bookingInput,
  User,
  Reservation,
  SlotLock,
} = require("./_helpers");
const reservationService = require("../src/services/reservation.service");
const slotLock = require("../src/services/slotLock.service");
const codeUtil = require("../src/utils/code");
const { toInstant, addMinutes } = require("../src/utils/time");

const CONTRACT_KEYS = [
  "id",
  "code",
  "table",
  "name",
  "email",
  "phone",
  "date",
  "time",
  "endTime",
  "guests",
  "pref",
  "requests",
  "status",
  "createdAt",
];

describe("reservations: book, list, cancel", () => {
  let ctx, call, T, u1, u2, manager;
  before(async () => {
    ctx = await startServer();
    call = client(ctx.base);
    T = await tablesByLabel();
    u1 = await registerUser(call, "One");
    u2 = await registerUser(call, "Two");
    manager = await loginManager(call);
  });
  after(() => stopServer(ctx));

  const post = (body, token = u1.token) =>
    call("/reservations", { method: "POST", body, token });
  const input = (label, o) => bookingInput(T[label], o);
  const locksOf = (id) => SlotLock.countDocuments({ reservation: id });
  const counts = async () => ({
    reservations: await Reservation.countDocuments(),
    locks: await SlotLock.countDocuments(),
  });

  describe("POST /reservations", () => {
    it("needs a signed-in user", async () => {
      assert.equal((await post(input("T01"), null)).status, 401);
    });

    it("rejects bad input with a message per field and saves nothing", async () => {
      const before = await counts();
      assert.deepEqual(
        Object.keys((await post({})).body.fields).sort(),
        ["date", "guests", "email", "name", "phone", "tableId", "time"].sort(),
      );
      const bad = [
        { tableId: "abc" },
        { name: "R" },
        { email: "nope" },
        { phone: "123" },
        { phone: 9876543210 },
        { guests: "2" },
        { guests: 0 },
        { guests: 9 },
        { date: "2020-01-01" },
        { date: "2098-02-31" },
        { time: "03:00" },
        { time: "19:15" },
        { time: "22:00" },
        { pref: "rooftop" },
        { requests: "x".repeat(201) },
      ];
      for (const override of bad) {
        const res = await post(input("T01", override));
        assert.equal(res.status, 400, JSON.stringify(override));
        assert.ok(
          res.body.fields[Object.keys(override)[0]],
          JSON.stringify(override),
        );
      }
      assert.equal(
        (
          await call("/reservations", {
            method: "POST",
            token: u1.token,
            raw: "{oops",
          })
        ).status,
        400,
      );
      assert.deepEqual(await counts(), before);
    });

    it("unknown table gives 404, a table that is too small gives 422", async () => {
      assert.equal(
        (await post(input("T01", { tableId: "64b0f0f0f0f0f0f0f0f0f0f0" })))
          .status,
        404,
      );
      const small = await post(input("T01", { guests: 4 }));
      assert.equal(small.status, 422);
      assert.equal(small.body.code, "TABLE_TOO_SMALL");
    });

    it("books a table: 201, contract shape, cleaned input, 8 slot locks", async () => {
      const res = await post(
        input("T01", {
          email: " Rani@Example.COM ",
          phone: "98765 43210",
          requests: "Window please",
        }),
      );
      assert.equal(res.status, 201);
      assert.deepEqual(Object.keys(res.body).sort(), [...CONTRACT_KEYS].sort());
      assert.match(res.body.code, /^TP-[A-HJ-NP-Z2-9]{6}$/);
      assert.equal(res.body.status, "confirmed");
      assert.equal(res.body.endTime, "21:00");
      assert.equal(res.body.email, "rani@example.com");
      assert.equal(res.body.phone, "9876543210");
      assert.deepEqual(Object.keys(res.body.table).sort(), [
        "cap",
        "id",
        "label",
        "zone",
      ]);

      const stored = await Reservation.findById(res.body.id);
      assert.equal(String(stored.user), u1.user.id);
      assert.equal(stored.startAt.toISOString(), "2098-06-10T13:30:00.000Z");
      assert.equal(await locksOf(stored._id), 8);
    });

    it("refuses overlapping bookings, allows back-to-back and other tables or days", async () => {
      const before = await counts();
      for (const time of ["19:00", "20:00", "18:00", "19:30"]) {
        const res = await post(input("T01", { time }), u2.token);
        assert.equal(res.status, 409, time);
        assert.equal(res.body.code, "SLOT_TAKEN", time);
      }
      assert.deepEqual(
        await counts(),
        before,
        "refused bookings leave nothing behind",
      );

      assert.equal(
        (await post(input("T01", { time: "21:00" }), u2.token)).status,
        201,
      ); // right after
      assert.equal(
        (await post(input("T01", { time: "17:00" }), u2.token)).status,
        201,
      ); // ends exactly at 19:00
      assert.equal((await post(input("T03"), u2.token)).status, 201); // other table
      assert.equal(
        (await post(input("T01", { date: "2098-06-11" }), u2.token)).status,
        201,
      ); // other day
    });

    it("30 simultaneous requests for one table and time: exactly one wins", async () => {
      const before = await counts();
      const users = [u1, u2, manager];
      const results = await Promise.all(
        Array.from({ length: 30 }, (_, i) =>
          post(input("T02", { time: "12:00", guests: 3 }), users[i % 3].token),
        ),
      );
      assert.equal(results.filter((r) => r.status === 201).length, 1);
      assert.equal(
        results.filter((r) => r.status === 409 && r.body.code === "SLOT_TAKEN")
          .length,
        29,
      );
      const after = await counts();
      assert.equal(after.reservations, before.reservations + 1);
      assert.equal(after.locks, before.locks + 8, "no leaked locks");
    });

    it("overlapping start times fired together never produce overlapping winners", async () => {
      const times = ["14:00", "14:30", "15:00", "15:30", "16:00", "16:30"];
      const calls = [];
      for (let i = 0; i < 4; i++)
        for (const time of times)
          calls.push(
            post(input("T04", { time }), [u1, u2, manager][i % 3].token),
          );
      const results = await Promise.all(calls);
      assert.ok(results.every((r) => r.status === 201 || r.status === 409));
      const minutes = results
        .filter((r) => r.status === 201)
        .map(
          (r) =>
            Number(r.body.time.slice(0, 2)) * 60 + Number(r.body.time.slice(3)),
        )
        .sort((a, b) => a - b);
      assert.ok(minutes.length >= 1);
      assert.ok(
        minutes.every((m, i) => i === 0 || m - minutes[i - 1] >= 120),
        `winners overlap: ${minutes}`,
      );
    });

    it("ignores fields a client must never set (status, user, code, startAt)", async () => {
      const res = await post({
        ...input("T05"),
        status: "cancelled",
        user: u2.user.id,
        code: "HACKED",
        startAt: "2000-01-01T00:00:00Z",
        cancelledAt: "2000-01-01",
      });
      assert.equal(res.status, 201);
      assert.equal(res.body.status, "confirmed");
      assert.notEqual(res.body.code, "HACKED");
      const stored = await Reservation.findById(res.body.id);
      assert.equal(String(stored.user), u1.user.id);
      assert.equal(stored.startAt.getUTCFullYear(), 2098);
    });

    it("gives the locks back when saving fails", async () => {
      const user = await User.findById(u1.user.id);
      const before = await counts();
      const original = Reservation.create;
      Reservation.create = async () => {
        throw new Error("disk full");
      };
      try {
        await assert.rejects(
          reservationService.createReservation(
            user,
            input("T08", { time: "19:00" }),
          ),
          /disk full/,
        );
      } finally {
        Reservation.create = original;
      }
      assert.deepEqual(await counts(), before);
      await assert.doesNotReject(
        reservationService.createReservation(
          user,
          input("T08", { time: "19:00" }),
        ),
      ); // table is free again
    });

    it("tries a new booking code when one is already used", async () => {
      const user = await User.findById(u1.user.id);
      const existing = (await Reservation.findOne()).code;
      const real = codeUtil.generateCode;
      let calls = 0;
      codeUtil.generateCode = () => (++calls <= 2 ? existing : real());
      try {
        const booked = await reservationService.createReservation(
          user,
          input("T09", { time: "12:00" }),
        );
        assert.equal(calls, 3);
        assert.notEqual(booked.code, existing);
      } finally {
        codeUtil.generateCode = real;
      }
    });

    it("manager can book too; optional fields get defaults", async () => {
      const res = await post(
        { ...input("T07"), pref: undefined, requests: undefined },
        manager.token,
      );
      assert.equal(res.status, 201);
      assert.equal(res.body.pref, "any");
      assert.equal(res.body.requests, "");
    });
  });

  describe("GET /reservations/mine", () => {
    it("needs a signed-in user", async () => {
      assert.equal((await call("/reservations/mine")).status, 401);
    });

    it("lists only my reservations, newest first, in contract shape", async () => {
      const user = await registerUser(call, "Lister");
      const other = await registerUser(call, "Other");
      assert.deepEqual(
        (await call("/reservations/mine", { token: user.token })).body,
        [],
      );

      await post(input("T10", { date: "2098-08-10" }), user.token);
      await post(input("T10", { date: "2098-08-12" }), user.token);
      await post(input("T10", { date: "2098-08-11" }), user.token);
      await post(input("T11", { date: "2098-08-10", guests: 5 }), other.token);

      const res = await call("/reservations/mine", { token: user.token });
      assert.deepEqual(
        res.body.map((r) => r.date),
        ["2098-08-12", "2098-08-11", "2098-08-10"],
      );
      assert.deepEqual(
        Object.keys(res.body[0]).sort(),
        [...CONTRACT_KEYS].sort(),
      );
      assert.equal(res.body[0].table.label, "T10");
    });
  });

  describe("PATCH /reservations/:id/cancel", () => {
    const cancel = (id, token = u1.token, body) =>
      call(`/reservations/${id}/cancel`, { method: "PATCH", token, body });
    const makeBooking = async (label, o, token = u1.token) =>
      (await post(input(label, o), token)).body;

    it("needs a signed-in user", async () => {
      assert.equal((await cancel("abc", null)).status, 401);
    });

    it("owner cancels: row kept as cancelled, slot locks removed, body fields ignored", async () => {
      const booking = await makeBooking("T01", { date: "2098-09-01" });
      assert.equal(await locksOf(booking.id), 8);
      const res = await cancel(booking.id, u1.token, {
        status: "confirmed",
        user: u2.user.id,
      });
      assert.equal(res.status, 200);
      assert.equal(res.body.status, "cancelled");
      assert.match(res.body.cancelledAt, /^\d{4}-/);
      assert.equal(res.body.table.label, "T01");
      assert.equal(await locksOf(booking.id), 0);
      const stored = await Reservation.findById(booking.id);
      assert.equal(stored.status, "cancelled");
      assert.equal(String(stored.user), u1.user.id);
    });

    it("the freed slot can be booked by someone else, and the old booking cannot touch the new one", async () => {
      const first = await makeBooking("T12", { date: "2098-09-02" });
      await cancel(first.id);
      const second = await makeBooking("T12", { date: "2098-09-02" }, u2.token);
      assert.equal(second.status, "confirmed");
      const again = await cancel(first.id);
      assert.equal(again.status, 409);
      assert.equal(again.body.code, "ALREADY_CANCELLED");
      assert.equal(await locksOf(second.id), 8);
    });

    it("other customers get 403, managers can cancel anyone, bad ids give 404", async () => {
      const booking = await makeBooking("T02", {
        date: "2098-09-03",
        guests: 3,
      });
      const forbidden = await cancel(booking.id, u2.token);
      assert.equal(forbidden.status, 403);
      assert.equal(forbidden.body.code, "FORBIDDEN");
      assert.equal(
        (await Reservation.findById(booking.id)).status,
        "confirmed",
      );
      assert.equal(await locksOf(booking.id), 8);

      const byManager = await cancel(booking.id, manager.token);
      assert.equal(byManager.status, 200);
      assert.equal(byManager.body.status, "cancelled");

      assert.equal((await cancel("64b0f0f0f0f0f0f0f0f0f0f0")).status, 404);
      for (const bad of ["abc", "123", "zzzzzzzzzzzzzzzzzzzzzzzz"])
        assert.equal((await cancel(bad)).status, 404, bad);
    });

    it("20 cancels fired together: never an error, every reply is 200 or ALREADY_CANCELLED, data stays consistent", async () => {
      // Real MongoDB lets exactly one of them win (run "npm run demo:cancel-race" to see it).
      // This test only asserts what must hold on any database.
      const booking = await makeBooking("T03", { date: "2098-09-04" });
      const results = await Promise.all(
        Array.from({ length: 20 }, (_, i) =>
          cancel(booking.id, [u1, manager][i % 2].token),
        ),
      );
      assert.ok(results.some((r) => r.status === 200));
      assert.ok(
        results.every(
          (r) =>
            r.status === 200 ||
            (r.status === 409 && r.body.code === "ALREADY_CANCELLED"),
        ),
      );
      assert.equal(await locksOf(booking.id), 0);
      assert.equal(
        (await Reservation.findById(booking.id)).status,
        "cancelled",
      );
    });

    it("a booking that already started cannot be cancelled (not even by a manager)", async () => {
      const startAt = toInstant("2020-01-01", "12:00");
      const _id = new mongoose.Types.ObjectId();
      await slotLock.claim({
        tableId: T.T05._id,
        reservationId: _id,
        startAt,
        endAt: addMinutes(startAt, 120),
      });
      await Reservation.create({
        _id,
        code: codeUtil.generateCode(),
        table: T.T05._id,
        user: u1.user.id,
        name: "Old",
        email: "o@x.com",
        phone: "9876543210",
        date: "2020-01-01",
        time: "12:00",
        startAt,
        endAt: addMinutes(startAt, 120),
        guests: 2,
      });
      for (const token of [u1.token, manager.token]) {
        const res = await cancel(String(_id), token);
        assert.equal(res.status, 409);
        assert.equal(res.body.code, "ALREADY_STARTED");
      }
      assert.equal(await locksOf(_id), 8);
    });

    it("cancelling around the start moment, with a faked clock", async () => {
      const user = await User.findById(u1.user.id);
      const booking = await makeBooking("T06", {
        date: "2098-07-01",
        guests: 3,
      });
      const start = toInstant("2098-07-01", "19:00");
      await assert.rejects(
        reservationService.cancelReservation(
          user,
          booking.id,
          new Date(start.getTime() + 60000),
        ),
        (e) => e.code === "ALREADY_STARTED",
      );
      assert.equal(await locksOf(booking.id), 8);
      const done = await reservationService.cancelReservation(
        user,
        booking.id,
        new Date(start.getTime() - 60000),
      );
      assert.equal(done.status, "cancelled");
    });

    it("invariant: slot locks are exactly 8 per confirmed reservation", async () => {
      const confirmed = await Reservation.countDocuments({
        status: "confirmed",
      });
      assert.equal(await SlotLock.countDocuments(), confirmed * 8);
    });
  });
});
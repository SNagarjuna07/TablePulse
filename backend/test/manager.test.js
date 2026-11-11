const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const {
  startServer,
  stopServer,
  client,
  registerUser,
  loginManager,
  tablesByLabel,
  bookingInput,
  Table,
} = require("./_helpers");
const floorService = require("../src/services/floor.service");
const { toInstant, restaurantToday } = require("../src/utils/time");

const D = "2098-06-10",
  D2 = "2098-06-11";

describe("manager: day list, floor plan, table status", () => {
  let ctx, call, T, u1, u2, mgr, b;
  before(async () => {
    ctx = await startServer();
    call = client(ctx.base);
    T = await tablesByLabel();
    u1 = await registerUser(call, "One");
    u2 = await registerUser(call, "Two");
    mgr = await loginManager(call);

    const book = async (label, o, who) =>
      (
        await call("/reservations", {
          method: "POST",
          token: who.token,
          body: bookingInput(T[label], o),
        })
      ).body;
    b = {
      t01: await book("T01", { time: "19:00" }, u1),
      t02: await book("T02", { time: "12:00", name: "Sam Roy", guests: 3 }, u2),
      t03: await book("T03", { time: "21:00", name: "Late Guest" }, u1),
      t05: await book("T05", { time: "15:00" }, u2),
      other: await book("T06", { date: D2, time: "19:00", guests: 3 }, u1),
      t04: await book("T04", { time: "12:00", name: "Same Time" }, u1),
    };
    await call(`/reservations/${b.t05.id}/cancel`, {
      method: "PATCH",
      token: u2.token,
    });
  });
  after(() => stopServer(ctx));

  const asManager = (path) => call(path, { token: mgr.token });
  const stateOf = (res, label) => res.body.find((s) => s.table.label === label);

  describe("GET /reservations?date=", () => {
    it("is for managers only", async () => {
      assert.equal((await call(`/reservations?date=${D}`)).status, 401);
      const res = await call(`/reservations?date=${D}`, { token: u1.token });
      assert.equal(res.status, 403);
      assert.equal(res.body.code, "FORBIDDEN");
    });

    it("needs a real date", async () => {
      assert.ok((await asManager("/reservations")).body.fields.date);
      for (const bad of ["2098-02-31", "10-06-2098", "today"])
        assert.equal(
          (await asManager(`/reservations?date=${bad}`)).status,
          400,
          bad,
        );
      assert.equal(
        (await asManager(`/reservations?date=${D}&date=${D2}`)).status,
        400,
      );
    });

    it("lists everyone's bookings of that day (cancelled too), earliest first", async () => {
      const res = await asManager(`/reservations?date=${D}`);
      assert.equal(res.status, 200);
      assert.deepEqual(
        res.body.map((r) => r.time),
        ["12:00", "12:00", "15:00", "19:00", "21:00"],
      );
      assert.equal(res.body[0].id, b.t02.id); // same time: booked first comes first
      assert.equal(res.body[1].id, b.t04.id);
      assert.ok(!res.body.some((r) => r.id === b.other.id)); // other day not included
      assert.equal(res.body.find((r) => r.id === b.t05.id).status, "cancelled");
      assert.equal(res.body[0].name, "Sam Roy"); // contact details are included for the manager
      assert.equal(res.body[0].phone, "9876543210");
      assert.equal(res.body[3].table.label, "T01");
    });

    it("past dates are allowed; a day with no bookings is an empty list", async () => {
      const res = await asManager("/reservations?date=2020-01-01");
      assert.equal(res.status, 200);
      assert.deepEqual(res.body, []);
    });

    it("does not break the customer route /mine", async () => {
      const res = await call("/reservations/mine", { token: u1.token });
      assert.equal(res.status, 200);
    });
  });

  describe("GET /floor?date=&time=", () => {
    it("is for managers only, and needs a real date and time", async () => {
      assert.equal((await call(`/floor?date=${D}&time=19:30`)).status, 401);
      assert.equal(
        (await call(`/floor?date=${D}&time=19:30`, { token: u1.token })).status,
        403,
      );
      const empty = await asManager("/floor");
      assert.ok(empty.body.fields.date && empty.body.fields.time);
      for (const time of ["25:00", "7pm", "19:60", "9:00"])
        assert.equal(
          (await asManager(`/floor?date=${D}&time=${time}`)).status,
          400,
          time,
        );
    });

    it("returns all 12 tables sorted by label, in contract shape", async () => {
      const res = await asManager(`/floor?date=${D}&time=19:30`);
      assert.equal(res.status, 200);
      assert.deepEqual(
        res.body.map((s) => s.table.label),
        [
          "T01",
          "T02",
          "T03",
          "T04",
          "T05",
          "T06",
          "T07",
          "T08",
          "T09",
          "T10",
          "T11",
          "T12",
        ],
      );
      assert.deepEqual(Object.keys(res.body[0]).sort(), [
        "reservation",
        "state",
        "table",
      ]);
      assert.deepEqual(Object.keys(res.body[0].table).sort(), [
        "cap",
        "id",
        "label",
        "zone",
      ]);
    });

    it("marks a table reserved while a booking covers that moment (start in, end out)", async () => {
      const at = async (time) => asManager(`/floor?date=${D}&time=${time}`);
      let res = await at("19:30");
      assert.equal(stateOf(res, "T01").state, "reserved");
      assert.equal(stateOf(res, "T01").reservation.code, b.t01.code);
      assert.equal(stateOf(res, "T02").state, "available");
      assert.equal(stateOf(res, "T02").reservation, null);

      assert.equal(stateOf(await at("18:59"), "T01").state, "available"); // not yet
      assert.equal(stateOf(await at("19:00"), "T01").state, "reserved"); // start included
      assert.equal(stateOf(await at("20:59"), "T01").state, "reserved");
      res = await at("21:00");
      assert.equal(stateOf(res, "T01").state, "available"); // end NOT included
      assert.equal(stateOf(res, "T03").state, "reserved"); // next booking starts here
      assert.equal(stateOf(await at("19:15"), "T01").state, "reserved"); // any clock time works, not only booking slots
    });

    it("ignores cancelled bookings, and shows other days correctly", async () => {
      assert.equal(
        stateOf(await asManager(`/floor?date=${D}&time=15:30`), "T05").state,
        "available",
      );
      const nextDay = await asManager(`/floor?date=${D2}&time=19:30`);
      assert.equal(stateOf(nextDay, "T06").state, "reserved");
      assert.equal(stateOf(nextDay, "T01").state, "available");
      assert.ok(
        (await asManager("/floor?date=2020-01-01&time=12:00")).body.every(
          (s) => s.state === "available",
        ),
      );
    });
  });

  describe("PATCH /tables/:id/status", () => {
    const patch = (id, body, token = mgr.token, raw) =>
      call(`/tables/${id}/status`, { method: "PATCH", body, token, raw });
    const id = () => String(T.T04._id);

    it("is for managers only, and changes nothing for a customer", async () => {
      assert.equal(
        (await patch(id(), { status: "occupied" }, null)).status,
        401,
      );
      const res = await patch(id(), { status: "occupied" }, u1.token);
      assert.equal(res.status, 403);
      assert.equal((await Table.findById(id())).status, "available");
    });

    it("accepts only available, occupied or cleaning", async () => {
      for (const bad of [
        { status: "reserved" },
        { status: "broken" },
        {},
        { status: 5 },
        { status: null },
      ]) {
        const res = await patch(id(), bad);
        assert.equal(res.status, 400, JSON.stringify(bad));
        assert.ok(res.body.fields.status);
      }
      assert.equal(
        (await patch(id(), undefined, mgr.token, "{oops")).status,
        400,
      );
    });

    it("unknown or malformed ids give 404", async () => {
      assert.equal(
        (await patch("64b0f0f0f0f0f0f0f0f0f0f0", { status: "occupied" }))
          .status,
        404,
      );
      for (const bad of ["abc", "123"])
        assert.equal(
          (await patch(bad, { status: "occupied" })).status,
          404,
          bad,
        );
    });

    it('204 with an empty body, and only "status" can change', async () => {
      const res = await patch(id(), {
        status: "occupied",
        cap: 99,
        label: "HACK",
        zone: "outdoor",
      });
      assert.equal(res.status, 204);
      assert.equal(res.text, "");
      const table = await Table.findById(id());
      assert.equal(table.status, "occupied");
      assert.equal(table.cap, 4);
      assert.equal(table.label, "T04");
      assert.equal(table.zone, "window");
      await patch(String(T.T06._id), { status: "cleaning" });
    });

    it("occupied/cleaning show on today's floor, are ignored on future days", async () => {
      const today = await asManager(
        `/floor?date=${restaurantToday()}&time=12:00`,
      );
      assert.equal(stateOf(today, "T04").state, "occupied");
      assert.equal(stateOf(today, "T06").state, "cleaning");

      const future = await asManager(`/floor?date=${D}&time=12:30`);
      assert.equal(stateOf(future, "T04").state, "reserved"); // shows its booking instead
      assert.equal(stateOf(future, "T06").state, "available");
    });

    it("with a faked clock: occupied beats reserved (booking still attached); tomorrow shows reserved", async () => {
      const sameDay = await floorService.getFloor(
        { date: D, time: "12:30" },
        new Date(toInstant(D, "10:00")),
      );
      const t04 = sameDay.find((s) => s.table.label === "T04");
      assert.equal(t04.state, "occupied");
      assert.equal(t04.reservation.name, "Same Time");
      assert.equal(
        sameDay.find((s) => s.table.label === "T06").state,
        "cleaning",
      );

      const dayBefore = await floorService.getFloor(
        { date: D, time: "12:30" },
        new Date(toInstant("2098-06-09", "10:00")),
      );
      assert.equal(
        dayBefore.find((s) => s.table.label === "T04").state,
        "reserved",
      );
    });

    it("setting a table back to available clears it, and a manager cancel frees the floor", async () => {
      assert.equal((await patch(id(), { status: "available" })).status, 204);
      await patch(String(T.T06._id), { status: "available" });
      assert.equal(
        await Table.countDocuments({ status: { $ne: "available" } }),
        0,
      );

      await call(`/reservations/${b.t01.id}/cancel`, {
        method: "PATCH",
        token: mgr.token,
      });
      const floor = await asManager(`/floor?date=${D}&time=19:30`);
      assert.equal(stateOf(floor, "T01").state, "available");
      assert.equal(stateOf(floor, "T01").reservation, null);
      const list = await asManager(`/reservations?date=${D}`);
      assert.equal(
        list.body.find((r) => r.id === b.t01.id).status,
        "cancelled",
      ); // history is kept
    });
  });
});
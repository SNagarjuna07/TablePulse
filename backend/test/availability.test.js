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
const availability = require("../src/services/availability.service");
const { toInstant } = require("../src/utils/time");

describe("GET /availability", () => {
  let ctx, call, T, user, manager;
  before(async () => {
    ctx = await startServer();
    call = client(ctx.base);
    T = await tablesByLabel();
    user = await registerUser(call, "Guest");
    manager = await loginManager(call);
  });
  after(() => stopServer(ctx));

  const search = (o = {}, token = user.token) => {
    const params = new URLSearchParams({
      date: "2098-06-10",
      time: "19:00",
      guests: "2",
      pref: "window",
      ...o,
    });
    return call("/availability?" + params, { token });
  };
  const labels = (res) => res.body.map((x) => x.table.label);
  const scores = (res) => res.body.map((x) => x.match);
  const book = (o = {}) =>
    call("/reservations", {
      method: "POST",
      token: user.token,
      body: bookingInput(T.T01, o),
    });

  it("needs a signed-in user (customer or manager)", async () => {
    assert.equal((await search({}, null)).status, 401);
    assert.equal((await search({}, manager.token)).status, 200);
  });

  it("rejects bad input with a message per field", async () => {
    const empty = await call("/availability", { token: user.token });
    assert.equal(empty.status, 400);
    assert.ok(
      empty.body.fields.guests &&
        empty.body.fields.date &&
        empty.body.fields.time,
    );

    assert.match(
      (await search({ guests: "9" })).body.fields.guests,
      /largest table seats 8/,
    );
    for (const guests of ["0", "abc", "2.5", "-1"])
      assert.ok((await search({ guests })).body.fields.guests, guests);
    assert.match(
      (await search({ date: "2020-01-01" })).body.fields.date,
      /past/,
    );
    for (const time of ["03:00", "22:00", "19:15", "7pm"])
      assert.ok((await search({ time })).body.fields.time, time);
    assert.ok((await search({ pref: "rooftop" })).body.fields.pref);
  });

  it("ranks tables with FlowSense (2 guests, window: T01, T03, T02)", async () => {
    const res = await search();
    assert.equal(res.status, 200);
    assert.deepEqual(labels(res), ["T01", "T03", "T02"]);
    assert.deepEqual(scores(res), [100, 100, 88]);
    assert.deepEqual(Object.keys(res.body[0]).sort(), [
      "match",
      "reasons",
      "table",
    ]);
    assert.deepEqual(Object.keys(res.body[0].table).sort(), [
      "cap",
      "id",
      "label",
      "zone",
    ]);
    assert.equal(res.body[0].reasons.length, 3);
  });

  it('only offers tables big enough, and treats a missing preference as "any"', async () => {
    assert.deepEqual(labels(await search({ guests: "8", pref: "any" })), [
      "T11",
    ]);
    assert.deepEqual(labels(await search({ guests: "5", pref: "any" })), [
      "T06",
      "T09",
      "T11",
    ]);
    const noPref = await call(
      "/availability?date=2098-06-10&time=19:00&guests=2",
      { token: user.token },
    );
    assert.equal(noPref.body[0].match, 85);
  });

  it("hides a booked table for overlapping times, offers it back-to-back, and again after cancel", async () => {
    const booked = await book({ time: "19:00" }); // T01 19:00-21:00
    assert.equal(booked.status, 201);
    for (const time of ["19:00", "20:00", "17:30"])
      assert.ok(
        !labels(await search({ time })).includes("T01"),
        `overlap ${time}`,
      );
    for (const time of ["21:00", "17:00"])
      assert.equal(labels(await search({ time }))[0], "T01", `free ${time}`);
    assert.equal(labels(await search({ date: "2098-06-11" }))[0], "T01");

    await call(`/reservations/${booked.body.id}/cancel`, {
      method: "PATCH",
      token: user.token,
    });
    assert.equal(labels(await search())[0], "T01");
  });

  it("returns an empty list (not an error) when every table is taken", async () => {
    const day = { date: "2098-07-20", time: "19:00" };
    for (const label of Object.keys(T)) {
      const res = await call("/reservations", {
        method: "POST",
        token: user.token,
        body: bookingInput(T[label], day),
      });
      assert.equal(res.status, 201, label);
    }
    const res = await search(day);
    assert.equal(res.status, 200);
    assert.deepEqual(res.body, []);
  });

  it("manager holds (occupied/cleaning) only block TODAY and only for the next 2 hours", async () => {
    const now = new Date(toInstant("2098-06-10", "10:45"));
    const q = (o = {}) => ({
      date: "2098-06-10",
      time: "12:00",
      guests: "2",
      pref: "window",
      ...o,
    });
    const names = async (o, at = now) =>
      (await availability.recommend(q(o), at)).map((x) => x.table.label);

    await Table.updateOne({ label: "T01" }, { status: "occupied" });
    await Table.updateOne({ label: "T03" }, { status: "cleaning" });
    try {
      const soon = await names({ time: "12:00" });
      assert.ok(
        !soon.includes("T01") && !soon.includes("T03"),
        "held tables hidden for a booking within 2 hours",
      );
      assert.deepEqual((await names({ time: "13:00" })).slice(0, 2), [
        "T01",
        "T03",
      ]); // after the hold
      assert.deepEqual(
        (await names({ date: "2098-06-11", time: "11:30" })).slice(0, 2),
        ["T01", "T03"],
      ); // tomorrow
    } finally {
      await Table.updateMany({}, { status: "available" });
    }
  });

  it("applies the 30-minute notice rule and rejects yesterday, using a faked clock", async () => {
    const now = new Date(toInstant("2098-06-10", "10:45"));
    const q = { date: "2098-06-10", time: "11:00", guests: "2", pref: "any" };
    await assert.rejects(
      availability.recommend(q, now),
      (e) => e.fields.time === "Please book at least 30 minutes ahead.",
    );
    await assert.doesNotReject(
      availability.recommend({ ...q, time: "11:30" }, now),
    );
    await assert.rejects(
      availability.recommend({ ...q, date: "2098-06-09" }, now),
      (e) => /past/.test(e.fields.date),
    );
  });
});
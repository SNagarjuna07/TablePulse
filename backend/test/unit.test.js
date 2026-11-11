// Pure logic: no database, no server. Fast.
const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
process.env.RESTAURANT_TZ = "Asia/Kolkata";
process.env.MONGODB_URI =
  process.env.MONGODB_URI || "mongodb://unused.invalid/unit"; // never connected in this file
process.env.JWT_SECRET = process.env.JWT_SECRET || "unit-test-secret";

const {
  toInstant,
  timeOf,
  addMinutes,
  buildSlots,
  restaurantToday,
} = require("../src/utils/time");
const { scoreTable, rankTables } = require("../src/services/flowsense.service");
const { cellsFor } = require("../src/services/slotLock.service");
const {
  parseSearch,
  validateSlot,
  validateBooking,
} = require("../src/utils/validators");
const { generateCode } = require("../src/utils/code");
const restaurant = require("../src/config/restaurant");

const cfg = { ...restaurant, maxPartySize: 8 };
const clock = (date, time) => new Date(toInstant(date, time));

describe("time helpers", () => {
  it("converts restaurant time to a real instant and back", () => {
    const start = toInstant("2098-06-10", "19:00");
    assert.equal(start.toISOString(), "2098-06-10T13:30:00.000Z"); // 19:00 in India = 13:30 UTC
    assert.equal(timeOf(start), "19:00");
    assert.equal(timeOf(addMinutes(start, 120)), "21:00");
  });
  it("returns null for impossible dates and times", () => {
    assert.equal(toInstant("2098-02-31", "19:00"), null);
    assert.equal(toInstant("2098-06-10", "25:99"), null);
    assert.equal(toInstant("tomorrow", "19:00"), null);
  });
  it("builds 21 bookable slots, 11:00 to 21:00", () => {
    const slots = buildSlots(cfg);
    assert.equal(slots.length, 21);
    assert.equal(slots[0], "11:00");
    assert.equal(slots[20], "21:00");
  });
  it('works out "today" in restaurant time, not server time', () => {
    assert.equal(
      restaurantToday(new Date("2098-06-10T20:00:00Z")),
      "2098-06-11",
    ); // 01:30 next day in India
  });
});

describe("FlowSense scoring", () => {
  const tbl = (cap, zone) => ({ label: `X${cap}${zone}`, cap, zone });
  it("scores capacity fit + preference + free", () => {
    assert.equal(scoreTable(tbl(4, "window"), 4, "window").match, 100); // exact + preferred
    assert.equal(scoreTable(tbl(5, "window"), 4, "window").match, 96); // +1 seat
    assert.equal(scoreTable(tbl(6, "window"), 4, "window").match, 88); // +2 seats
    assert.equal(scoreTable(tbl(8, "window"), 3, "window").match, 76); // far too big
    assert.equal(scoreTable(tbl(2, "quiet"), 2, "window").match, 70); // wrong zone
    assert.equal(scoreTable(tbl(2, "quiet"), 2, "any").match, 85); // no preference
  });
  it("explains itself with 3 reasons", () => {
    const { reasons } = scoreTable(tbl(2, "window"), 2, "window");
    assert.deepEqual(reasons, [
      "Seats exactly 2, a perfect fit for your party",
      "Window side, as you preferred",
      "No overlapping reservation during your stay",
    ]);
  });
  it("ranks best first, returns 3, smaller table wins ties", () => {
    const ranked = rankTables(
      [
        tbl(6, "window"),
        tbl(2, "window"),
        tbl(4, "window"),
        tbl(8, "window"),
        tbl(3, "window"),
      ],
      { guests: 2, pref: "window" },
    );
    assert.equal(ranked.length, 3);
    assert.equal(ranked[0].table.cap, 2);
    const tie = rankTables(
      [
        { label: "B", cap: 4, zone: "window" },
        { label: "A", cap: 4, zone: "window" },
        { label: "C", cap: 2, zone: "window" },
      ],
      { guests: 2, pref: "window" },
    );
    assert.deepEqual(
      tie.map((x) => x.table.label),
      ["C", "A", "B"],
    );
  });
});

describe("slot cells (the double-booking lock grid)", () => {
  it("cuts a 2-hour booking into 8 cells of 15 minutes, oldest first", () => {
    const start = toInstant("2098-06-10", "19:00");
    const cells = cellsFor(start, addMinutes(start, 120));
    assert.equal(cells.length, 8);
    assert.equal(cells[0].getTime(), start.getTime());
    assert.ok(
      cells.every(
        (c, i) =>
          i === 0 || c.getTime() - cells[i - 1].getTime() === 15 * 60000,
      ),
    );
  });
});

describe("validation", () => {
  it("search: reports every bad field", () => {
    const { errors } = parseSearch({}, cfg, clock("2098-06-10", "10:00"));
    assert.ok(errors.guests && errors.date && errors.time);
  });
  it("search: party above the biggest table", () => {
    const { errors } = parseSearch(
      { guests: "9", date: "2098-06-11", time: "19:00" },
      cfg,
      clock("2098-06-10", "10:00"),
    );
    assert.match(errors.guests, /largest table seats 8/);
  });
  it("search: repeated or odd query values are rejected, not crashed on", () => {
    const now = clock("2098-06-10", "10:00");
    for (const guests of ["0", "abc", "2.5", "-1", ["2", "3"]]) {
      assert.ok(
        parseSearch({ guests, date: "2098-06-11", time: "19:00" }, cfg, now)
          .errors.guests,
        `guests=${guests}`,
      );
    }
    assert.ok(
      parseSearch(
        { guests: "2", date: ["2098-06-11", "2098-06-12"], time: "19:00" },
        cfg,
        now,
      ).errors.date,
    );
  });
  it("slot: past date, off-grid time, closing time, short notice", () => {
    const now = clock("2098-06-10", "10:45");
    assert.match(validateSlot("2098-06-09", "19:00", cfg, now).date, /past/);
    assert.ok(validateSlot("2098-06-11", "19:15", cfg, now).time); // not a 30-minute slot
    assert.ok(validateSlot("2098-06-11", "22:00", cfg, now).time); // ends after closing
    assert.equal(
      validateSlot("2098-06-10", "11:00", cfg, now).time,
      "Please book at least 30 minutes ahead.",
    );
    assert.deepEqual(validateSlot("2098-06-10", "11:30", cfg, now), {});
  });
  it("booking: clean input passes, bad input lists every field", () => {
    const good = {
      tableId: "a".repeat(24),
      name: "Rani Jain",
      email: "r@x.com",
      phone: "98765 43210",
      guests: 2,
      date: "2098-06-11",
      time: "19:00",
    };
    const now = clock("2098-06-10", "10:00");
    assert.deepEqual(validateBooking(good, cfg, now), {});
    const bad = validateBooking(
      { tableId: "abc", name: "R", email: "no", phone: "1", guests: "2" },
      cfg,
      now,
    );
    for (const field of [
      "tableId",
      "name",
      "email",
      "phone",
      "guests",
      "date",
      "time",
    ])
      assert.ok(bad[field], field);
  });
});

describe("booking codes", () => {
  it("look like TP-8K2M4Q and do not repeat", () => {
    assert.match(generateCode(), /^TP-[A-HJ-NP-Z2-9]{6}$/);
    assert.equal(new Set(Array.from({ length: 500 }, generateCode)).size, 500);
  });
});
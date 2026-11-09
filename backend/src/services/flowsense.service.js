// FlowSense: transparent, rule-based table ranking. No AI model, so every point can be explained.
// Pure functions (no database), so they are easy to test.

const ZONE_NAMES = {
  window: "Window side",
  quiet: "Quiet corner",
  outdoor: "Outdoor seating",
  centre: "Near the centre",
  any: "Any available table",
};

// Score one table that is ALREADY known to be free and big enough. Max 100.
function scoreTable(table, guests, pref) {
  const reasons = [];
  let match = 0;

  // Rule A (max 40): capacity fit. An exact fit scores highest.
  const extra = table.cap - guests;
  match += extra === 0 ? 40 : extra === 1 ? 36 : extra === 2 ? 28 : 16;
  reasons.push(
    extra === 0
      ? `Seats exactly ${table.cap}, a perfect fit for your party`
      : `Seats ${table.cap}, room for your party of ${guests}`,
  );

  // Rule B (max 40): seating preference.
  if (pref === table.zone) {
    match += 40;
    reasons.push(`${ZONE_NAMES[table.zone]}, as you preferred`);
  } else if (pref === "any") {
    match += 25;
    reasons.push("Open to any seating, so this is a flexible choice");
  } else {
    match += 10;
    reasons.push(
      `${ZONE_NAMES[table.zone]} is available if your first choice is full`,
    );
  }

  // Rule C (20): free for the whole stay (the caller already filtered out busy tables).
  match += 20;
  reasons.push("No overlapping reservation during your stay");

  return { match, reasons };
}

// Best first. Ties: smaller table first (do not waste a big table), then label.
function rankTables(tables, { guests, pref }, limit = 3) {
  return tables
    .map((table) => ({ table, ...scoreTable(table, guests, pref) }))
    .sort(
      (a, b) =>
        b.match - a.match ||
        a.table.cap - b.table.cap ||
        a.table.label.localeCompare(b.table.label),
    )
    .slice(0, limit);
}

module.exports = { ZONE_NAMES, scoreTable, rankTables };
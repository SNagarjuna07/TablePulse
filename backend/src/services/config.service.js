const restaurant = require("../config/restaurant");
const Table = require("../models/Table");

// maxPartySize is not typed in by hand: it is the seats of the biggest table.
async function getConfig() {
  const biggest = await Table.findOne().sort({ cap: -1 }).select("cap");
  return { ...restaurant, maxPartySize: biggest ? biggest.cap : 0 };
}

module.exports = { getConfig };
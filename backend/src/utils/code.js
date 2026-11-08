const crypto = require("crypto");

// No 0/O/1/I so codes are easy to read out loud.
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

// "TP-8K2M4Q". The unique index on Reservation.code protects against the rare repeat.
function generateCode() {
  const bytes = crypto.randomBytes(6);
  let code = "TP-";
  for (const byte of bytes) code += ALPHABET[byte % ALPHABET.length];
  return code;
}

module.exports = { generateCode };
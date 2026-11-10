const Table = require("../models/Table");
const ApiError = require("../utils/ApiError");
const { validateTableStatus, OBJECT_ID_RE } = require("../utils/validators");

// Manager marks a table available / occupied / cleaning. Only "status" is read from the body,
// so label, seats and zone can never be changed through this route.
async function setStatus(id, input) {
  const notFound = () => ApiError.notFound("Table not found.");
  if (!OBJECT_ID_RE.test(id)) throw notFound();

  const errors = validateTableStatus(input);
  if (Object.keys(errors).length) throw ApiError.validation(undefined, errors);

  const result = await Table.updateOne(
    { _id: id },
    { $set: { status: input.status } },
  );
  if (result.matchedCount === 0) throw notFound();
}

module.exports = { setStatus };
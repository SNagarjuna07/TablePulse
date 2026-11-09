const tableService = require("../services/table.service");

exports.setStatus = async (req, res) => {
  await tableService.setStatus(req.params.id, req.body || {});
  res.status(204).end(); // success, nothing to send back
};
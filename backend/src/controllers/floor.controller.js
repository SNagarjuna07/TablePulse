const floorService = require("../services/floor.service");

exports.getFloor = async (req, res) => {
  res.json(await floorService.getFloor(req.query));
};
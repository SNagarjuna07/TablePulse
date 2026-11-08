const availabilityService = require("../services/availability.service");

exports.recommend = async (req, res) => {
  res.json(await availabilityService.recommend(req.query));
};
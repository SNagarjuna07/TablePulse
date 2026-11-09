const configService = require("../services/config.service");

exports.getConfig = async (req, res) => {
  res.json(await configService.getConfig());
};
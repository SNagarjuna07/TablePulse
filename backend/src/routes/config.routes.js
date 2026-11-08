const router = require("express").Router();
const controller = require("../controllers/config.controller");

router.get("/", controller.getConfig); // public: the frontend loads it before anything else

module.exports = router;
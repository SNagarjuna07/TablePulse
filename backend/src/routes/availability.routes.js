const router = require("express").Router();
const controller = require("../controllers/availability.controller");
const { requireAuth } = require("../middleware/auth");

router.get("/", requireAuth, controller.recommend); // any signed-in user

module.exports = router;
const router = require("express").Router();
const controller = require("../controllers/reservation.controller");
const { requireAuth } = require("../middleware/auth");

router.post("/", requireAuth, controller.create); // any signed-in user can book

module.exports = router;
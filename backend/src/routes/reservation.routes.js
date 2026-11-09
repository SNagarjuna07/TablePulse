const router = require("express").Router();
const controller = require("../controllers/reservation.controller");
const { requireAuth } = require("../middleware/auth");

router.post("/", requireAuth, controller.create); // any signed-in user can book
router.get("/mine", requireAuth, controller.mine); // my own reservations
router.patch("/:id/cancel", requireAuth, controller.cancel); // owner or manager

module.exports = router;
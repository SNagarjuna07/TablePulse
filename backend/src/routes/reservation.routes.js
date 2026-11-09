const router = require("express").Router();
const controller = require("../controllers/reservation.controller");
const { requireAuth, requireRole } = require("../middleware/auth");

router.post("/", requireAuth, controller.create); // any signed-in user can book
router.get("/mine", requireAuth, controller.mine); // my own reservations
router.patch("/:id/cancel", requireAuth, controller.cancel); // owner or manager
router.get("/", requireAuth, requireRole("manager"), controller.listByDate); // manager: one day, everyone's

module.exports = router;
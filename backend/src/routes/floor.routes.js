const router = require("express").Router();
const controller = require("../controllers/floor.controller");
const { requireAuth, requireRole } = require("../middleware/auth");

router.get("/", requireAuth, requireRole("manager"), controller.getFloor);

module.exports = router;
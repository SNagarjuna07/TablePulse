const router = require("express").Router();
const controller = require("../controllers/table.controller");
const { requireAuth, requireRole } = require("../middleware/auth");

router.patch(
  "/:id/status",
  requireAuth,
  requireRole("manager"),
  controller.setStatus,
);

module.exports = router;
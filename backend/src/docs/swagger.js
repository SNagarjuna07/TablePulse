
const router = require("express").Router();
const swaggerUi = require("swagger-ui-express");
const { buildSpec } = require("./openapi");

// GET /api/docs               -> the interactive page (Swagger UI)
// GET /api/docs/openapi.json  -> the raw spec (Postman and other tools can import it)
router.get("/openapi.json", (req, res) => res.json(buildSpec()));

router.use(
  "/",
  swaggerUi.serve,
  swaggerUi.setup(null, {
    customSiteTitle: "TablePulse API",
    swaggerOptions: {
      url: "/api/docs/openapi.json", // loaded fresh each time, so example dates are never stale
      persistAuthorization: true, // the pasted token survives a page reload
      displayRequestDuration: true,
      docExpansion: "list",
    },
  }),
);

module.exports = router;
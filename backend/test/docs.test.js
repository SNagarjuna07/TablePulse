const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const SwaggerParser = require("@apidevtools/swagger-parser");
const { startServer, stopServer, client } = require("./_helpers");

// Keeps the Swagger docs honest: valid spec, every documented route is real, every example works.
describe("API docs (Swagger)", () => {
  let ctx, call, spec;
  before(async () => {
    ctx = await startServer();
    call = client(ctx.base);
    spec = (await call("/docs/openapi.json")).body;
  });
  after(() => stopServer(ctx));

  const operations = () =>
    Object.entries(spec.paths)
      .flatMap(([path, methods]) =>
        Object.keys(methods).map((method) => `${method.toUpperCase()} ${path}`),
      )
      .sort();
  const example = (path, method, where) => {
    const op = spec.paths[path][method];
    return where === "body"
      ? op.requestBody.content["application/json"].example
      : Object.fromEntries(
          op.parameters
            .filter((p) => p.in === where)
            .map((p) => [p.name, p.example]),
        );
  };

  it("serves the Swagger page and the raw spec", async () => {
    const page = await call("/docs/");
    assert.equal(page.status, 200);
    assert.match(page.text, /swagger-ui/i);
    assert.equal(spec.openapi, "3.0.3");
    assert.equal(spec.servers[0].url, "/api");
  });

  it("the spec is valid OpenAPI 3", async () => {
    await SwaggerParser.validate(structuredClone(spec));
  });

  it("documents exactly the 12 operations the API has", () => {
    assert.deepEqual(
      operations(),
      [
        "GET /auth/me",
        "GET /availability",
        "GET /config",
        "GET /floor",
        "GET /health",
        "GET /reservations",
        "GET /reservations/mine",
        "PATCH /reservations/{id}/cancel",
        "PATCH /tables/{id}/status",
        "POST /auth/login",
        "POST /auth/register",
        "POST /reservations",
      ].sort(),
    );
  });

  it("every documented operation is a real route, and protected ones say 401 without a token", async () => {
    for (const [path, methods] of Object.entries(spec.paths)) {
      for (const [method, op] of Object.entries(methods)) {
        const url = path.replace("{id}", "64b0f0f0f0f0f0f0f0f0f0f0");
        const res = await call(url, {
          method: method.toUpperCase(),
          body: ["post", "patch"].includes(method) ? {} : undefined,
        });
        assert.ok(
          !(res.status === 404 && /^Route /.test(res.body && res.body.message)),
          `${method.toUpperCase()} ${path} is documented but does not exist`,
        );
        if (op.security)
          assert.equal(
            res.status,
            401,
            `${method.toUpperCase()} ${path} should need a token`,
          );
        else
          assert.notEqual(
            res.status,
            401,
            `${method.toUpperCase()} ${path} should be public`,
          );
      }
    }
  });

  it("the example requests in the docs actually work", async () => {
    const login = await call("/auth/login", {
      method: "POST",
      body: example("/auth/login", "post", "body"),
    });
    assert.equal(login.status, 200);
    assert.equal(login.body.user.role, "manager");
    const token = login.body.token;
    const qs = (params) => "?" + new URLSearchParams(params);

    const availability = await call(
      "/availability" + qs(example("/availability", "get", "query")),
      { token },
    );
    assert.equal(availability.status, 200);
    assert.equal(availability.body.length, 3);

    assert.equal(
      (await call("/floor" + qs(example("/floor", "get", "query")), { token }))
        .status,
      200,
    );
    assert.equal(
      (
        await call(
          "/reservations" + qs(example("/reservations", "get", "query")),
          { token },
        )
      ).status,
      200,
    );
    assert.equal((await call("/auth/me", { token })).status, 200);
    assert.equal((await call("/config")).status, 200);

    const register = await call("/auth/register", {
      method: "POST",
      body: example("/auth/register", "post", "body"),
    });
    assert.equal(register.status, 201);
    const booking = example("/reservations", "post", "body");
    assert.equal(
      (
        await call("/reservations", {
          method: "POST",
          body: booking,
          token: register.body.token,
        })
      ).status,
      400,
      "the placeholder table id is rejected, not crashed on",
    );
  });

  it("example dates are tomorrow, so they never go stale", () => {
    const date = example("/availability", "get", "query").date;
    const tomorrow = new Date(Date.now() + 24 * 3600 * 1000)
      .toISOString()
      .slice(0, 10);
    const dayAfter = new Date(Date.now() + 48 * 3600 * 1000)
      .toISOString()
      .slice(0, 10);
    assert.ok(
      [tomorrow, dayAfter, new Date().toISOString().slice(0, 10)].includes(
        date,
      ),
      date,
    ); // restaurant zone may differ from UTC by a day
  });
});
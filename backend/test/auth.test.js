const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const jwt = require("jsonwebtoken");
const {
  startServer,
  stopServer,
  client,
  registerUser,
  loginManager,
} = require("./_helpers");

describe("auth", () => {
  let ctx, call;
  before(async () => {
    ctx = await startServer();
    call = client(ctx.base);
  });
  after(() => stopServer(ctx));

  const register = (body) => call("/auth/register", { method: "POST", body });
  const login = (body) => call("/auth/login", { method: "POST", body });

  it("register: 201 with user and token; role is always customer; no password in the reply", async () => {
    const res = await register({
      name: "Rani Jain",
      email: "Rani@Example.com",
      password: "password1",
      role: "manager",
    });
    assert.equal(res.status, 201);
    assert.equal(res.body.user.role, "customer");
    assert.equal(res.body.user.email, "rani@example.com");
    assert.ok(res.body.user.id && res.body.token);
    assert.ok(!/\$2[aby]\$|passwordHash|password1/.test(res.text));
    assert.equal(jwt.decode(res.body.token).sub, res.body.user.id);
  });

  it("register: bad input gives 400 with a message per field", async () => {
    const res = await register({ name: "R", email: "bad", password: "123" });
    assert.equal(res.status, 400);
    assert.equal(res.body.code, "VALIDATION");
    assert.ok(
      res.body.fields.name && res.body.fields.email && res.body.fields.password,
    );
  });

  it("register: same email twice gives 409 EMAIL_TAKEN", async () => {
    await register({
      name: "Sam Roy",
      email: "sam@example.com",
      password: "password1",
    });
    const res = await register({
      name: "Sam Again",
      email: "SAM@example.com",
      password: "password1",
    });
    assert.equal(res.status, 409);
    assert.equal(res.body.code, "EMAIL_TAKEN");
  });

  it("register: four sign-ups at the same moment, exactly one wins", async () => {
    const results = await Promise.all(
      Array.from({ length: 4 }, () =>
        register({
          name: "Racer",
          email: "racer@example.com",
          password: "password1",
        }),
      ),
    );
    assert.equal(results.filter((r) => r.status === 201).length, 1);
    assert.equal(
      results.filter((r) => r.body.code === "EMAIL_TAKEN").length,
      3,
    );
  });

  it("login: works with spaces and capitals in the email", async () => {
    const user = await registerUser(call, "Login User");
    const res = await login({
      email: `  ${user.email.toUpperCase()} `,
      password: "password1",
    });
    assert.equal(res.status, 200);
    assert.ok(res.body.token);
  });

  it("login: wrong password and unknown email give the same 401", async () => {
    const user = await registerUser(call);
    const wrong = await login({
      email: user.email,
      password: "not-the-password",
    });
    const unknown = await login({
      email: "nobody@example.com",
      password: "password1",
    });
    for (const res of [wrong, unknown]) {
      assert.equal(res.status, 401);
      assert.equal(res.body.code, "INVALID_CREDENTIALS");
      assert.equal(res.body.message, "Incorrect email or password.");
    }
  });

  it("login: missing fields give 400", async () => {
    const res = await login({});
    assert.equal(res.status, 400);
    assert.ok(res.body.fields.email && res.body.fields.password);
  });

  it("manager: the seeded account has role manager", async () => {
    const mgr = await loginManager(call);
    assert.equal(mgr.user.role, "manager");
  });

  it("me: returns the user for a good token", async () => {
    const user = await registerUser(call, "Me User");
    const res = await call("/auth/me", { token: user.token });
    assert.equal(res.status, 200);
    assert.equal(res.body.email, user.email);
  });

  it("me: refuses no token, garbage, expired, wrong secret, and a deleted user", async () => {
    const user = await registerUser(call);
    const checks = {
      none: undefined,
      garbage: "garbage",
      expired: jwt.sign({ sub: user.user.id }, process.env.JWT_SECRET, {
        expiresIn: -10,
      }),
      wrongSecret: jwt.sign({ sub: user.user.id }, "some-other-secret"),
      deletedUser: jwt.sign(
        { sub: "64b0f0f0f0f0f0f0f0f0f0f0" },
        process.env.JWT_SECRET,
      ),
    };
    for (const [name, token] of Object.entries(checks)) {
      const res = await call("/auth/me", { token });
      assert.equal(res.status, 401, name);
      assert.equal(res.body.code, "UNAUTHORIZED", name);
    }
  });

  it("errors: bad JSON gives 400, unknown route gives 404", async () => {
    assert.equal(
      (await call("/auth/login", { method: "POST", raw: "{oops" })).status,
      400,
    );
    const res = await call("/nope");
    assert.equal(res.status, 404);
    assert.equal(res.body.code, "NOT_FOUND");
  });
});
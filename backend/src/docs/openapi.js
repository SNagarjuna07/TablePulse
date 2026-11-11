const { DateTime } = require("luxon");
const env = require("../config/env");

// The API described in OpenAPI 3 so Swagger UI can show it and let you try it.
// Built by a function (not a fixed file) so the example dates are always "tomorrow" and never go stale.

const day = (offset) =>
  DateTime.now().setZone(env.timeZone).plus({ days: offset }).toISODate();

const ref = (name) => ({ $ref: `#/components/schemas/${name}` });
const resp = (name) => ({ $ref: `#/components/responses/${name}` });
const body = (schema, example) => ({
  required: true,
  content: { "application/json": { schema, example } },
});
const ok = (description, schema) => ({
  description,
  content: { "application/json": { schema } },
});
const err = (description, code, message, fields) => ({
  description,
  content: {
    "application/json": {
      schema: ref("Error"),
      example: { code, message, ...(fields ? { fields } : {}) },
    },
  },
});
const bearer = [{ bearerAuth: [] }];
const idParam = (description) => ({
  name: "id",
  in: "path",
  required: true,
  description,
  schema: { type: "string", pattern: "^[a-f0-9]{24}$" },
  example: "64b0f0f0f0f0f0f0f0f0f0f0",
});
const dateParam = (description) => ({
  name: "date",
  in: "query",
  required: true,
  description,
  schema: { type: "string", format: "date" },
  example: day(1),
});

function buildSpec() {
  const tomorrow = day(1);
  return {
    openapi: "3.0.3",
    info: {
      title: "TablePulse API",
      version: "1.0.0",
      description: [
        "Restaurant reservation API: matches tables to party size, prevents overlapping reservations, manages availability, handles cancellations.",
        "",
        "**How to try it (1 minute)**",
        "1. Open **POST /auth/login** and click **Try it out**, then **Execute**. The example is the demo manager.",
        "2. Copy the `token` value from the response.",
        "3. Click the green **Authorize** button at the top, paste the token, click **Authorize**.",
        "4. Now every lock icon works. Customers: use **POST /auth/register** and authorize with that token instead.",
        "",
        "**To book a table:** call **GET /availability**, copy a `table.id` from the result, paste it into **POST /reservations**.",
        "",
        `Dates and times are in the restaurant time zone (${env.timeZone}). Errors always look like \`{ "code", "message", "fields" }\`.`,
      ].join("\n"),
    },
    servers: [{ url: "/api", description: "This server" }],
    tags: [
      { name: "Health" },
      { name: "Config" },
      { name: "Auth" },
      { name: "Availability" },
      { name: "Reservations", description: "Book, list and cancel" },
      { name: "Manager", description: "Manager role only" },
    ],
    paths: {
      "/health": {
        get: {
          tags: ["Health"],
          summary: "Is the server alive?",
          responses: {
            200: ok("Alive", {
              type: "object",
              properties: {
                status: { type: "string", example: "ok" },
                time: { type: "string", format: "date-time" },
              },
            }),
          },
        },
      },
      "/config": {
        get: {
          tags: ["Config"],
          summary: "Restaurant rules",
          description:
            "Opening hours, booking step, reservation length, notice, and the biggest table. Public.",
          responses: { 200: ok("Restaurant rules", ref("RestaurantConfig")) },
        },
      },
      "/auth/register": {
        post: {
          tags: ["Auth"],
          summary: "Create a customer account",
          description:
            "Everyone who registers is a **customer**. A `role` sent in the body is ignored.",
          requestBody: body(ref("RegisterInput"), {
            name: "Rani Jain",
            email: "rani@example.com",
            password: "password1",
          }),
          responses: {
            201: ok("Account created", ref("AuthResult")),
            400: resp("ValidationError"),
            409: err(
              "Email already used",
              "EMAIL_TAKEN",
              "An account with this email already exists.",
            ),
          },
        },
      },
      "/auth/login": {
        post: {
          tags: ["Auth"],
          summary: "Sign in",
          description:
            "Returns a JWT. Paste it into **Authorize**. The example below is the demo manager (run `npm run seed` first).",
          requestBody: body(ref("LoginInput"), {
            email: "manager@tablepulse.demo",
            password: "manager123",
          }),
          responses: {
            200: ok("Signed in", ref("AuthResult")),
            400: resp("ValidationError"),
            401: err(
              "Wrong email or password",
              "INVALID_CREDENTIALS",
              "Incorrect email or password.",
            ),
          },
        },
      },
      "/auth/me": {
        get: {
          tags: ["Auth"],
          summary: "Who am I?",
          security: bearer,
          responses: {
            200: ok("The signed-in user", ref("User")),
            401: resp("Unauthorized"),
          },
        },
      },
      "/availability": {
        get: {
          tags: ["Availability"],
          summary: "Best 3 tables for a party (FlowSense)",
          security: bearer,
          description: [
            "Only tables that are big enough, not held by the manager, and free for the whole stay are considered.",
            "Score: capacity fit (max 40) + seating preference (max 40) + free for the stay (20).",
            "Manager holds (occupied/cleaning) only count for **today**, for bookings starting within 2 hours.",
          ].join("\n"),
          parameters: [
            dateParam("Reservation date, today or later."),
            {
              name: "time",
              in: "query",
              required: true,
              description:
                "A bookable slot (every 30 minutes, 11:00 to 21:00).",
              schema: { type: "string", pattern: "^\\d{2}:\\d{2}$" },
              example: "19:00",
            },
            {
              name: "guests",
              in: "query",
              required: true,
              description: "Party size, 1 to the biggest table.",
              schema: { type: "integer", minimum: 1 },
              example: 2,
            },
            {
              name: "pref",
              in: "query",
              required: false,
              description: "Seating preference. Default `any`.",
              schema: {
                type: "string",
                enum: ["window", "quiet", "outdoor", "centre", "any"],
                default: "any",
              },
              example: "window",
            },
          ],
          responses: {
            200: ok(
              "Up to 3 tables, best first. Empty list if everything is taken.",
              { type: "array", items: ref("Recommendation") },
            ),
            400: resp("ValidationError"),
            401: resp("Unauthorized"),
          },
        },
      },
      "/reservations": {
        post: {
          tags: ["Reservations"],
          summary: "Book a table",
          security: bearer,
          description:
            "Get a `table.id` from **GET /availability** first. The database refuses overlapping bookings, so two people can never get the same table and time. Only the fields below are read; `status`, `user`, `code` are ignored.",
          requestBody: body(ref("CreateReservationInput"), {
            tableId: "PASTE a table.id from GET /availability",
            name: "Rani Jain",
            email: "rani@example.com",
            phone: "9876543210",
            date: tomorrow,
            time: "19:00",
            guests: 2,
            pref: "window",
            requests: "Window please",
          }),
          responses: {
            201: ok("Booked", ref("Reservation")),
            400: resp("ValidationError"),
            401: resp("Unauthorized"),
            404: err("Table not found", "NOT_FOUND", "Table not found."),
            409: err(
              "Overlaps another booking (or the manager is holding the table)",
              "SLOT_TAKEN",
              "That table was just taken for this time. Here are fresh options.",
            ),
            422: err(
              "Table has fewer seats than guests",
              "TABLE_TOO_SMALL",
              "Table T01 seats only 2.",
            ),
          },
        },
        get: {
          tags: ["Manager"],
          summary: "All reservations of one day",
          security: bearer,
          description:
            "Everyone's bookings for the day, cancelled ones included, earliest first. Past dates are allowed.",
          parameters: [dateParam("The day to list.")],
          responses: {
            200: ok("Reservations of that day", {
              type: "array",
              items: ref("Reservation"),
            }),
            400: resp("ValidationError"),
            401: resp("Unauthorized"),
            403: resp("Forbidden"),
          },
        },
      },
      "/reservations/mine": {
        get: {
          tags: ["Reservations"],
          summary: "My reservations",
          security: bearer,
          description: "Only your own, newest first, cancelled ones included.",
          responses: {
            200: ok("My reservations", {
              type: "array",
              items: ref("Reservation"),
            }),
            401: resp("Unauthorized"),
          },
        },
      },
      "/reservations/{id}/cancel": {
        patch: {
          tags: ["Reservations"],
          summary: "Cancel a reservation",
          security: bearer,
          description:
            "Owner or manager. The row stays (status `cancelled`); the table is free again. A started booking cannot be cancelled.",
          parameters: [
            idParam("Reservation id (the `id` field, not the TP- code)."),
          ],
          responses: {
            200: ok("Cancelled", ref("Reservation")),
            401: resp("Unauthorized"),
            403: resp("Forbidden"),
            404: err("Not found", "NOT_FOUND", "Reservation not found."),
            409: err(
              "Already cancelled (`ALREADY_CANCELLED`) or already started (`ALREADY_STARTED`)",
              "ALREADY_CANCELLED",
              "This reservation is already cancelled.",
            ),
          },
        },
      },
      "/floor": {
        get: {
          tags: ["Manager"],
          summary: "State of every table at a date and time",
          security: bearer,
          description:
            "`reserved` = a booking covers that moment (start included, end not). `occupied`/`cleaning` are set by hand and only show for **today**.",
          parameters: [
            dateParam("Day to look at."),
            {
              name: "time",
              in: "query",
              required: true,
              description: "Any clock time, HH:MM.",
              schema: { type: "string", pattern: "^\\d{2}:\\d{2}$" },
              example: "19:30",
            },
          ],
          responses: {
            200: ok("All tables, sorted by label", {
              type: "array",
              items: ref("FloorSlot"),
            }),
            400: resp("ValidationError"),
            401: resp("Unauthorized"),
            403: resp("Forbidden"),
          },
        },
      },
      "/tables/{id}/status": {
        patch: {
          tags: ["Manager"],
          summary: "Mark a table available / occupied / cleaning",
          security: bearer,
          description:
            "Only `status` can change. An occupied or cleaning table is not offered for bookings that start within 2 hours, today only.",
          parameters: [idParam("Table id (the `table.id` field).")],
          requestBody: body(ref("TableStatusInput"), { status: "cleaning" }),
          responses: {
            204: { description: "Saved (no body)" },
            400: resp("ValidationError"),
            401: resp("Unauthorized"),
            403: resp("Forbidden"),
            404: err("Table not found", "NOT_FOUND", "Table not found."),
          },
        },
      },
    },
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
          description: "Paste the `token` from /auth/login or /auth/register.",
        },
      },
      responses: {
        ValidationError: err(
          "Bad input. `fields` says which field and why.",
          "VALIDATION",
          "Please fix the highlighted fields.",
          { date: "Please choose a reservation date." },
        ),
        Unauthorized: err(
          "Missing, invalid or expired token",
          "UNAUTHORIZED",
          "Please sign in again.",
        ),
        Forbidden: err(
          "Your role is not allowed",
          "FORBIDDEN",
          "Managers only.",
        ),
      },
      schemas: {
        Error: {
          type: "object",
          required: ["code", "message"],
          properties: {
            code: {
              type: "string",
              enum: [
                "VALIDATION",
                "UNAUTHORIZED",
                "INVALID_CREDENTIALS",
                "FORBIDDEN",
                "NOT_FOUND",
                "EMAIL_TAKEN",
                "SLOT_TAKEN",
                "ALREADY_CANCELLED",
                "ALREADY_STARTED",
                "TABLE_TOO_SMALL",
                "UNKNOWN",
              ],
            },
            message: { type: "string" },
            fields: {
              type: "object",
              additionalProperties: { type: "string" },
              description: "Field name to message",
            },
          },
        },
        User: {
          type: "object",
          properties: {
            id: { type: "string", example: "64b0f0f0f0f0f0f0f0f0f0f0" },
            name: { type: "string", example: "Rani Jain" },
            email: { type: "string", example: "rani@example.com" },
            role: { type: "string", enum: ["customer", "manager"] },
          },
        },
        AuthResult: {
          type: "object",
          properties: {
            user: ref("User"),
            token: { type: "string", description: "JWT" },
          },
        },
        RegisterInput: {
          type: "object",
          required: ["name", "email", "password"],
          properties: {
            name: { type: "string", minLength: 2 },
            email: { type: "string" },
            password: { type: "string", minLength: 8, maxLength: 72 },
          },
        },
        LoginInput: {
          type: "object",
          required: ["email", "password"],
          properties: {
            email: { type: "string" },
            password: { type: "string" },
          },
        },
        RestaurantConfig: {
          type: "object",
          properties: {
            openTime: { type: "string", example: "11:00" },
            closeTime: { type: "string", example: "23:00" },
            slotMinutes: { type: "integer", example: 30 },
            durationMinutes: { type: "integer", example: 120 },
            minLeadMinutes: { type: "integer", example: 30 },
            maxPartySize: { type: "integer", example: 8 },
          },
        },
        Table: {
          type: "object",
          properties: {
            id: { type: "string" },
            label: { type: "string", example: "T04" },
            cap: { type: "integer", example: 4 },
            zone: {
              type: "string",
              enum: ["window", "quiet", "outdoor", "centre"],
            },
          },
        },
        Recommendation: {
          type: "object",
          properties: {
            table: ref("Table"),
            match: { type: "integer", minimum: 0, maximum: 100, example: 96 },
            reasons: {
              type: "array",
              items: { type: "string" },
              example: [
                "Seats exactly 4, a perfect fit for your party",
                "Window side, as you preferred",
                "No overlapping reservation during your stay",
              ],
            },
          },
        },
        CreateReservationInput: {
          type: "object",
          required: [
            "tableId",
            "name",
            "email",
            "phone",
            "date",
            "time",
            "guests",
          ],
          properties: {
            tableId: {
              type: "string",
              description: "`table.id` from /availability",
            },
            name: { type: "string", minLength: 2 },
            email: { type: "string" },
            phone: {
              type: "string",
              description: "10 digits (spaces and dashes allowed)",
            },
            date: { type: "string", format: "date" },
            time: { type: "string", example: "19:00" },
            guests: { type: "integer", minimum: 1 },
            pref: {
              type: "string",
              enum: ["window", "quiet", "outdoor", "centre", "any"],
              default: "any",
            },
            requests: { type: "string", maxLength: 200 },
          },
        },
        Reservation: {
          type: "object",
          properties: {
            id: { type: "string" },
            code: { type: "string", example: "TP-8K2M4Q" },
            table: ref("Table"),
            name: { type: "string" },
            email: { type: "string" },
            phone: { type: "string" },
            date: { type: "string", format: "date" },
            time: { type: "string", example: "19:00" },
            endTime: { type: "string", example: "21:00" },
            guests: { type: "integer" },
            pref: { type: "string" },
            requests: { type: "string" },
            status: { type: "string", enum: ["confirmed", "cancelled"] },
            createdAt: { type: "string", format: "date-time" },
            cancelledAt: { type: "string", format: "date-time" },
          },
        },
        FloorSlot: {
          type: "object",
          properties: {
            table: ref("Table"),
            state: {
              type: "string",
              enum: ["available", "reserved", "occupied", "cleaning"],
            },
            reservation: {
              nullable: true,
              allOf: [ref("Reservation")],
              description: "The booking covering that moment, or null",
            },
          },
        },
        TableStatusInput: {
          type: "object",
          required: ["status"],
          properties: {
            status: {
              type: "string",
              enum: ["available", "occupied", "cleaning"],
            },
          },
        },
      },
    },
  };
}

module.exports = { buildSpec };
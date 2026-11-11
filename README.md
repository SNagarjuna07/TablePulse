# TablePulse

![CI](https://github.com/SNagarjuna07/TablePulse/actions/workflows/ci.yml/badge.svg)

Restaurant reservation system. It matches tables to party size, prevents overlapping reservations,
manages availability and handles cancellations.

**Stack:** MongoDB (Atlas) · Express 5 · AngularJS 1.8.2 (plain JavaScript) · Node.js

## Features

**Guests**
- Sign up and sign in (JWT)
- Search by date, time, party size and seating preference
- **FlowSense** ranks the best 3 tables and explains every point of the score
- Book, see "My reservations", cancel

**Managers**
- Day dashboard with every booking and guest contact details
- Live floor plan: reserved / occupied / cleaning / available at any date and time
- Mark tables occupied or cleaning

## How double booking is prevented

"Check for overlap, then save" fails when two guests click at the same moment. TablePulse instead
cuts every booking into 15-minute cells and stores one `SlotLock` document per table per cell,
with a **unique index** on `(table, cell)`. MongoDB itself refuses an overlapping booking, so
30 simultaneous requests for one table produce exactly one winner. Cancelling deletes the locks.
Proven by `npm test` and `npm run demo:overlap`.

## Run locally

Needs Node 20.10+ (22 recommended) and a free MongoDB Atlas cluster (or a local MongoDB).

```bash
# 1. backend
cd backend
npm install
cp .env.example .env          # Windows: copy .env.example .env, then fill in MONGODB_URI and JWT_SECRET
npm run seed                  # creates the manager account and 12 tables
npm run dev                   # http://localhost:3000

# 2. frontend (second terminal)
cd frontend
npm install
npm start                     # http://localhost:4200
```

Demo manager login: `manager@tablepulse.demo` / `manager123`

The frontend can also run alone with a fake in-browser server: set `useMockApi: true` in `frontend/js/env.js`.

## Environment variables (`backend/.env`)

| Name | Meaning |
|---|---|
| `MONGODB_URI` | MongoDB connection string (database name at the end) |
| `JWT_SECRET` | long random string that signs login tokens |
| `JWT_EXPIRES_IN` | token lifetime, default `7d` |
| `PORT` | default `3000` |
| `CLIENT_ORIGIN` | allowed browser origin, default `http://localhost:4200` |
| `RESTAURANT_TZ` | restaurant time zone, default `Asia/Kolkata` |
| `MONGODB_URI_TEST` | separate database for tests (name must contain `test`) |
| `DNS_SERVERS` | optional, e.g. `8.8.8.8,1.1.1.1`, for networks that block `mongodb+srv` lookups |

## API

All errors look like `{ "code": "SLOT_TAKEN", "message": "...", "fields": { } }`. Full contract: `frontend/API_CONTRACT.md`.

| Method | Path | Who | Purpose |
|---|---|---|---|
| GET | `/api/config` | public | opening hours, slot size, biggest table |
| POST | `/api/auth/register`, `/api/auth/login` | public | sign up, sign in |
| GET | `/api/auth/me` | signed in | current user |
| GET | `/api/availability` | signed in | top 3 tables for a date, time, party |
| POST | `/api/reservations` | signed in | book a table |
| GET | `/api/reservations/mine` | signed in | my reservations |
| PATCH | `/api/reservations/:id/cancel` | owner or manager | cancel |
| GET | `/api/reservations?date=` | manager | everyone's bookings for a day |
| GET | `/api/floor?date=&time=` | manager | state of every table |
| PATCH | `/api/tables/:id/status` | manager | available / occupied / cleaning |

## Tests

```bash
cd backend
npm test                      # 71 tests on a separate test database
npm run demo:overlap          # 10 guests, 1 table: exactly 1 booked
npm run demo:cancel-race      # 20 simultaneous cancels: exactly 1 winner
```
GitHub Actions runs all of these against a real MongoDB on every push.

## Structure

```
backend/src
  config/        env, database, restaurant rules
  models/        User, Table, Reservation, SlotLock
  services/      business rules (booking, cancel, availability, FlowSense, floor)
  controllers/   read the request, send the response
  routes/        URL -> controller, with auth and role guards
  middleware/    JWT auth, errors, 404
  utils/         validation, time zones, booking codes
backend/test     unit and integration tests
frontend/js      AngularJS app: core (api, auth, rules), pages, components
```

## Decisions worth knowing
- **Restaurant time:** guests send `19:00`; the server converts it with the restaurant time zone and stores real instants.
- **Roles come from the server:** everyone who registers is a customer; the client can never set a role.
- **Status vs. reserved:** only `available / occupied / cleaning` are stored. "Reserved" is worked out from bookings.
- **Manager holds apply to today only:** a table marked occupied blocks bookings that start within 2 hours, never other days.

## Limitations
- AngularJS 1.x reached end of life in 2021; this is a academic project.
- One restaurant, no payments, no email or SMS confirmation, no rate limiting.
- A server crash between taking slot locks and saving a booking can leave a table blocked until cleaned up.
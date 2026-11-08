# TablePulse

Restaurant reservation system (MEAN stack): matches tables to party size, prevents overlapping
reservations, manages availability, handles cancellations.

- `frontend/`  AngularJS 1.8.2, plain JavaScript, no build step (done). Runs alone in mock mode.
- `backend/`   Express + MongoDB + Node API (built step by step).

## Run frontend
```bash
cd frontend
npm install          # installs only the tiny dev server (http-server)
npm start            # http://localhost:4200  (mock mode, no backend needed)
```
Demo manager login: `manager@tablepulse.demo` / `manager123`

## Switch to the real backend
1. Build the backend on port 3000 following `frontend/API_CONTRACT.md`.
2. In `frontend/js/env.js` set `useMockApi: false`.
3. `npm start` again. `/api` calls are proxied to `http://localhost:3000`.

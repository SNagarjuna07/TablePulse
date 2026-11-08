# TablePulse frontend (AngularJS 1.8.2, plain JavaScript)

```bash
npm install     # dev server only (http-server). AngularJS is already in vendor/
npm start       # http://localhost:4200, proxies /api to http://localhost:3000
```
Do not open `index.html` by double-click: templates load over HTTP, so use `npm start`
(or any static server, e.g. `python3 -m http.server 4200`).

## Structure
- `index.html`             shell (nav, footer, `ng-view`) and script tags (order matters)
- `js/env.js`              the switch: `useMockApi` and `apiUrl`
- `js/app.js`              module, routes, route guards, shell controller
- `js/core/api.js`         picks `MockApi` or `HttpApi`. Pages only use `Api`
- `js/core/api.mock.js`    in-browser fake server, same rules as the real one
- `js/core/api.http.js`    real REST calls
- `js/core/interceptor.js` JWT header, error normalising, 401 sign-out
- `js/core/engine.js`, `validation.js`, `date.js`  business rules (port these to the backend)
- `js/pages/*`, `templates/*`  one component and one HTML file per page
- `vendor/`                angular.min.js and angular-route.min.js (v1.8.2, MIT)

Backend contract: `API_CONTRACT.md`.

Note: AngularJS reached end of life on 31 Dec 2021 (no more security fixes). Fine for a learning project.

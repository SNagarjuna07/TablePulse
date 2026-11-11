// Environment switch. Edit this file only.
//   useMockApi: true  -> fake server inside the browser (localStorage), no backend needed
//   useMockApi: false -> real REST API (Express on port 3000)
window.TP_ENV = {
  apiUrl: '/api',      // "npm start" proxies /api to http://localhost:3000
  useMockApi: false
};

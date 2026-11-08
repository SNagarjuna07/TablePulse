// connects to the database, then starts listening.
const app = require('./app');
const env = require('./config/env');
const connectDb = require('./config/db');

async function start() {
  await connectDb();
  app.listen(env.port, () => console.log(`API running on http://localhost:${env.port}`));
}

start().catch(err => {
  console.error('Failed to start:', err.message);
  process.exit(1);
});
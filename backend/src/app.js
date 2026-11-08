const express = require('express');
const cors = require('cors');
const env = require('./config/env');
const notFound = require('./middleware/notFound');
const errorHandler = require('./middleware/errorHandler');

const app = express();

app.use(cors({ origin: env.clientOrigin }));
app.use(express.json());

// Health check: quick way to see the server is alive.
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// Later steps mount their routes here, for example:
// app.use('/api/auth', require('./routes/auth.routes'));

app.use(notFound);
app.use(errorHandler);

module.exports = app;
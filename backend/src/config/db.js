const mongoose = require('mongoose');
const env = require('./env');

async function connectDb() {
  await mongoose.connect(env.mongoUri);
  // Build indexes (for example the unique email index) before we accept requests.
  await Promise.all(Object.values(mongoose.models).map(model => model.init()));
  console.log('MongoDB connected');
}

module.exports = connectDb;
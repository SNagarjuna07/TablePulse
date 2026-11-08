require('dotenv').config();

function required(name) {
  const value = process.env[name];
  if (!value) {
    console.error(`Missing environment variable: ${name}. Copy .env.example to .env and fill it in.`);
    process.exit(1);
  }
  return value;
}

module.exports = {
  port: Number(process.env.PORT) || 3000,
  mongoUri: required('MONGODB_URI'),
  clientOrigin: process.env.CLIENT_ORIGIN || 'http://localhost:4200'
};
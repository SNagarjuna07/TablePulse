require("dotenv").config();

if (process.env.DNS_SERVERS) {
  require("dns").setServers(
    process.env.DNS_SERVERS.split(",").map((s) => s.trim()),
  );
}

function required(name) {
  const value = process.env[name];
  if (!value) {
    console.error(
      `Missing environment variable: ${name}. Copy .env.example to .env and fill it in.`,
    );
    process.exit(1);
  }
  return value;
}

module.exports = {
  port: Number(process.env.PORT) || 3000,
  mongoUri: required("MONGODB_URI"),
  clientOrigin: process.env.CLIENT_ORIGIN || "http://localhost:4200",
  jwtSecret: required("JWT_SECRET"),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "7d",
  timeZone: process.env.RESTAURANT_TZ || "Asia/Kolkata", //  The restaurant's local time zone. Booking times like 19:00 are converted using it.
};
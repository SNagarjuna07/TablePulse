// Restaurant rules. The frontend reads these from GET /api/config, so they live in ONE place.
module.exports = {
  openTime: "11:00", // first seating
  closeTime: "23:00", // restaurant closes
  slotMinutes: 30, // booking time step
  durationMinutes: 120, // how long a reservation holds a table
  minLeadMinutes: 30, // minimum notice before a booking
};
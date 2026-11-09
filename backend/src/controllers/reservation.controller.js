const reservationService = require("../services/reservation.service");

exports.create = async (req, res) => {
  const reservation = await reservationService.createReservation(
    req.user,
    req.body || {},
  );
  res.status(201).json(reservation);
};
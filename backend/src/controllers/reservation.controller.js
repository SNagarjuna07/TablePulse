const reservationService = require("../services/reservation.service");

exports.create = async (req, res) => {
  const reservation = await reservationService.createReservation(
    req.user,
    req.body || {},
  );
  res.status(201).json(reservation);
};

exports.mine = async (req, res) => {
  res.json(await reservationService.listMine(req.user));
};

exports.cancel = async (req, res) => {
  res.json(await reservationService.cancelReservation(req.user, req.params.id));
};

exports.listByDate = async (req, res) => {
  res.json(await reservationService.listByDate(req.query));
};
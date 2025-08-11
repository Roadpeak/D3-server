const Booking = require('../../models/index').sequelize.models.Booking;
const bookingService = require('../../services/admin/bookingService');
const { sendErrorResponse, sendSuccessResponse } = require('../../utils/responses');

const getAllBookings = async (req, res) => {
  try {
    const bookings = await bookingService.getAllBookings();
    return sendSuccessResponse(res, 200, bookings);
  } catch (error) {
    return sendErrorResponse(res, 500, 'Server error', error.message);
  }
};

const getBookingById = async (req, res) => {
  try {
    const booking = await bookingService.getBookingById(req.params.id);
    if (!booking) return sendErrorResponse(res, 404, 'Booking not found');
    return sendSuccessResponse(res, 200, booking);
  } catch (error) {
    return sendErrorResponse(res, 500, 'Server error', error.message);
  }
};

const createBooking = async (req, res) => {
  try {
    const isValid = await bookingService.validateBookingData(req.body);
    if (!isValid) return sendErrorResponse(res, 400, 'Invalid booking data');

    const booking = await bookingService.createBooking(req.body);
    return sendSuccessResponse(res, 201, booking);
  } catch (error) {
    return sendErrorResponse(res, 500, 'Server error', error.message);
  }
};

const updateBooking = async (req, res) => {
  try {
    const isValid = await bookingService.validateBookingData(req.body);
    if (!isValid) return sendErrorResponse(res, 400, 'Invalid booking data');

    const booking = await bookingService.updateBooking(req.params.id, req.body);
    if (!booking) return sendErrorResponse(res, 404, 'Booking not found');
    return sendSuccessResponse(res, 200, booking);
  } catch (error) {
    return sendErrorResponse(res, 500, 'Server error', error.message);
  }
};

const deleteBooking = async (req, res) => {
  try {
    const booking = await bookingService.deleteBooking(req.params.id);
    if (!booking) return sendErrorResponse(res, 404, 'Booking not found');
    return sendSuccessResponse(res, 200, { message: 'Booking deleted successfully' });
  } catch (error) {
    return sendErrorResponse(res, 500, 'Server error', error.message);
  }
};

const searchBookings = async (req, res) => {
  try {
    const bookings = await bookingService.searchBookings(req.query);
    return sendSuccessResponse(res, 200, bookings);
  } catch (error) {
    return sendErrorResponse(res, 500, 'Server error', error.message);
  }
};

const confirmBooking = async (req, res) => {
  try {
    const booking = await bookingService.confirmBooking(req.params.id);
    if (!booking) return sendErrorResponse(res, 404, 'Booking not found');
    return sendSuccessResponse(res, 200, { message: 'Booking confirmed successfully', booking });
  } catch (error) {
    return sendErrorResponse(res, 500, 'Server error', error.message);
  }
};

const cancelBooking = async (req, res) => {
  try {
    const booking = await bookingService.cancelBooking(req.params.id);
    if (!booking) return sendErrorResponse(res, 404, 'Booking not found');
    return sendSuccessResponse(res, 200, { message: 'Booking canceled successfully', booking });
  } catch (error) {
    return sendErrorResponse(res, 500, 'Server error', error.message);
  }
};

module.exports = {
  getAllBookings,
  getBookingById,
  createBooking,
  updateBooking,
  deleteBooking,
  searchBookings,
  confirmBooking,
  cancelBooking,
};
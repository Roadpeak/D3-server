const Offer = require('../../models/index').sequelize.models.Offer;
const offerService = require('../../services/admin/offerService');
const { sendErrorResponse, sendSuccessResponse } = require('../../utils/responses');

const getAllOffers = async (req, res) => {
  try {
    const offers = await offerService.getAllOffers();
    return sendSuccessResponse(res, 200, offers);
  } catch (error) {
    return sendErrorResponse(res, 500, 'Server error', error.message);
  }
};

const getOfferById = async (req, res) => {
  try {
    const offer = await offerService.getOfferById(req.params.id);
    if (!offer) return sendErrorResponse(res, 404, 'Offer not found');
    return sendSuccessResponse(res, 200, offer);
  } catch (error) {
    return sendErrorResponse(res, 500, 'Server error', error.message);
  }
};

const createOffer = async (req, res) => {
  try {
    const isValid = await offerService.validateOfferData(req.body);
    if (!isValid) return sendErrorResponse(res, 400, 'Invalid offer data');

    const offer = await offerService.createOffer(req.body);
    return sendSuccessResponse(res, 201, offer);
  } catch (error) {
    return sendErrorResponse(res, 500, 'Server error', error.message);
  }
};

const updateOffer = async (req, res) => {
  try {
    const isValid = await offerService.validateOfferData(req.body);
    if (!isValid) return sendErrorResponse(res, 400, 'Invalid offer data');

    const offer = await offerService.updateOffer(req.params.id, req.body);
    if (!offer) return sendErrorResponse(res, 404, 'Offer not found');
    return sendSuccessResponse(res, 200, offer);
  } catch (error) {
    return sendErrorResponse(res, 500, 'Server error', error.message);
  }
};

const deleteOffer = async (req, res) => {
  try {
    const offer = await offerService.deleteOffer(req.params.id);
    if (!offer) return sendErrorResponse(res, 404, 'Offer not found');
    return sendSuccessResponse(res, 200, { message: 'Offer deleted successfully' });
  } catch (error) {
    return sendErrorResponse(res, 500, 'Server error', error.message);
  }
};

const searchOffers = async (req, res) => {
  try {
    const offers = await offerService.searchOffers(req.query);
    return sendSuccessResponse(res, 200, offers);
  } catch (error) {
    return sendErrorResponse(res, 500, 'Server error', error.message);
  }
};

const activateOffer = async (req, res) => {
  try {
    const offer = await offerService.activateOffer(req.params.id);
    if (!offer) return sendErrorResponse(res, 404, 'Offer not found');
    return sendSuccessResponse(res, 200, { message: 'Offer activated successfully', offer });
  } catch (error) {
    return sendErrorResponse(res, 500, 'Server error', error.message);
  }
};

const deactivateOffer = async (req, res) => {
  try {
    const offer = await offerService.deactivateOffer(req.params.id);
    if (!offer) return sendErrorResponse(res, 404, 'Offer not found');
    return sendSuccessResponse(res, 200, { message: 'Offer deactivated successfully', offer });
  } catch (error) {
    return sendErrorResponse(res, 500, 'Server error', error.message);
  }
};

module.exports = {
  getAllOffers,
  getOfferById,
  createOffer,
  updateOffer,
  deleteOffer,
  searchOffers,
  activateOffer,
  deactivateOffer,
};
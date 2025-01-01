const likeService = require('../services/likeService');

const likeServiceHandler = async (req, res) => {
    try {
        const { userId, serviceId } = req.body;
        const result = await likeService.likeService(userId, serviceId);
        res.status(201).json(result);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

const unlikeServiceHandler = async (req, res) => {
    try {
        const { userId, serviceId } = req.body;
        await likeService.unlikeService(userId, serviceId);
        res.status(200).json({ message: 'Service unliked successfully' });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

const getLikedServicesHandler = async (req, res) => {
    try {
        const { userId } = req.params;
        const services = await likeService.getLikedServices(userId);
        res.status(200).json(services);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

const likeOfferHandler = async (req, res) => {
    try {
        const { userId, offerId } = req.body;
        const result = await likeService.likeOffer(userId, offerId);
        res.status(201).json(result);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

const unlikeOfferHandler = async (req, res) => {
    try {
        const { userId, offerId } = req.body;
        await likeService.unlikeOffer(userId, offerId);
        res.status(200).json({ message: 'Offer unliked successfully' });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

const getLikedOffersHandler = async (req, res) => {
    try {
        const { userId } = req.params;
        const offers = await likeService.getLikedOffers(userId);
        res.status(200).json(offers);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

module.exports = {
    likeServiceHandler,
    unlikeServiceHandler,
    getLikedServicesHandler,
    likeOfferHandler,
    unlikeOfferHandler,
    getLikedOffersHandler,
};
// like controller
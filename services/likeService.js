const { ServiceLike, OfferLike, Service, Offer } = require('../models');

const likeService = async (userId, serviceId) => {
    const existingLike = await ServiceLike.findOne({ where: { user_id: userId, service_id: serviceId } });
    if (existingLike) {
        throw new Error('Service already liked');
    }
    return await ServiceLike.create({ user_id: userId, service_id: serviceId });
};

const unlikeService = async (userId, serviceId) => {
    const like = await ServiceLike.findOne({ where: { user_id: userId, service_id: serviceId } });
    if (!like) {
        throw new Error('Service not liked');
    }
    return await like.destroy();
};

const likeOffer = async (userId, offerId) => {
    const existingLike = await OfferLike.findOne({ where: { user_id: userId, offer_id: offerId } });
    if (existingLike) {
        throw new Error('Offer already liked');
    }
    return await OfferLike.create({ user_id: userId, offer_id: offerId });
};

const unlikeOffer = async (userId, offerId) => {
    const like = await OfferLike.findOne({ where: { user_id: userId, offer_id: offerId } });
    if (!like) {
        throw new Error('Offer not liked');
    }
    return await like.destroy();
};

const getLikedServices = async (userId) => {
    return await ServiceLike.findAll({
        where: { user_id: userId },
        include: [{ model: Service, as: 'service' }],
    });
};

const getLikedOffers = async (userId) => {
    return await OfferLike.findAll({
        where: { user_id: userId },
        include: [{ model: Offer, as: 'offer' }],
    });
};

module.exports = {
    likeService,
    unlikeService,
    likeOffer,
    unlikeOffer,
    getLikedServices,
    getLikedOffers,
};

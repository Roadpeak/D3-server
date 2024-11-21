const { Offer } = require('../models');

// Create a new offer
exports.createOffer = async (req, res) => {
  try {
    const { discount, expiration_date, service_id, description, status } = req.body;

    const newOffer = await Offer.create({
      discount,
      expiration_date,
      service_id,
      description,
      status,
    });

    return res.status(201).json({ newOffer });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Error creating offer' });
  }
};

// Get all offers
exports.getOffers = async (req, res) => {
  try {
    const offers = await Offer.findAll();
    return res.status(200).json({ offers });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Error fetching offers' });
  }
};

// Get an offer by ID
exports.getOfferById = async (req, res) => {
  try {
    const { id } = req.params;
    const offer = await Offer.findByPk(id);

    if (!offer) {
      return res.status(404).json({ message: 'Offer not found' });
    }

    return res.status(200).json({ offer });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Error fetching offer' });
  }
};

// Update an offer
exports.updateOffer = async (req, res) => {
  try {
    const { id } = req.params;
    const offer = await Offer.findByPk(id);

    if (!offer) {
      return res.status(404).json({ message: 'Offer not found' });
    }

    const updatedOffer = await offer.update(req.body);
    return res.status(200).json({ message: 'Offer updated successfully', offer: updatedOffer });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Error updating offer' });
  }
};

// Delete an offer
exports.deleteOffer = async (req, res) => {
  try {
    const { id } = req.params;
    const offer = await Offer.findByPk(id);

    if (!offer) {
      return res.status(404).json({ message: 'Offer not found' });
    }

    await offer.destroy();
    return res.status(200).json({ message: 'Offer deleted successfully' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Error deleting offer' });
  }
};

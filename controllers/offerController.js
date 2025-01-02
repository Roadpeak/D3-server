const { Offer, Store, Service } = require('../models');

// Create a new offer
exports.createOffer = async (req, res) => {
  try {
    const { discount, expiration_date, service_id, description, status } = req.body;

    const fee = (discount * 0.05).toFixed(2);

    const newOffer = await Offer.create({
      discount,
      expiration_date,
      service_id,
      description,
      status,
      fee,
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

exports.getOffersByStore = async (req, res) => {
  try {
    const { storeId } = req.params;

    // Fetch the store to ensure it exists
    const store = await Store.findByPk(storeId, {
      include: {
        model: Service,
        include: [Offer],
      },
    });

    if (!store) {
      return res.status(404).json({ message: 'Store not found' });
    }

    // Extract all offers from the related services
    const offers = store.Services.flatMap(service => service.Offers);

    return res.status(200).json({ offers });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Error fetching offers by store' });
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

exports.updateOffer = async (req, res) => {
  try {
    const { id } = req.params;
    const offer = await Offer.findByPk(id);

    if (!offer) {
      return res.status(404).json({ message: 'Offer not found' });
    }

    const { discount, expiration_date, service_id, description, status } = req.body;

    // Calculate fee as 5% of the discount
    const fee = (discount * 0.05).toFixed(2);  // 5% of discount, formatted to 2 decimal places

    const updatedOffer = await offer.update({
      discount,
      expiration_date,
      service_id,
      description,
      status,
      fee,  // Update the fee with the newly calculated value
    });

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

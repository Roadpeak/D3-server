const { Offer, Store, Service } = require('../models');

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

    const store = await Store.findByPk(storeId, {
      include: {
        model: Service,
        include: {
          model: Offer,
          attributes: ['id', 'discount', 'expiration_date', 'description', 'status', 'fee'],
        },
        attributes: ['id', 'name', 'image_url', 'price', 'duration', 'category', 'type'], 
      },
    });

    if (!store) {
      return res.status(404).json({ message: 'Store not found' });
    }

    const offers = store.Services.flatMap(service =>
      service.Offers.map(offer => ({
        ...offer.toJSON(),
        service: {
          id: service.id,
          name: service.name,
          image_url: service.image_url,
          price: service.price,
          duration: service.duration,
          category: service.category,
          type: service.type,
        },
      }))
    );

    return res.status(200).json({ offers });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Error fetching offers by store' });
  }
};


exports.getOfferById = async (req, res) => {
  try {
    const { id } = req.params;

    const offer = await Offer.findByPk(id, {
      include: {
        model: Service,
        attributes: ['id', 'name', 'price', 'duration', 'image_url', 'category', 'description', 'type'],
      },
    });

    if (!offer) {
      return res.status(404).json({ message: 'Offer not found' });
    }

    return res.status(200).json({ offer });
  } catch (err) {
    console.error('Error fetching offer:', err);
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

    const fee = (discount * 0.05).toFixed(2); 

    const updatedOffer = await offer.update({
      discount,
      expiration_date,
      service_id,
      description,
      status,
      fee,
    });

    return res.status(200).json({ message: 'Offer updated successfully', offer: updatedOffer });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Error updating offer' });
  }
};

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

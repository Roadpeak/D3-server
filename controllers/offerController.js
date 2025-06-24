const { Offer, Store, Service, sequelize } = require('../models');

exports.createOffer = async (req, res) => {
  try {
    const { discount, expiration_date, service_id, description, status, title, featured } = req.body;

    const fee = (discount * 0.05).toFixed(2);

    const newOffer = await Offer.create({
      discount,
      expiration_date,
      service_id,
      description,
      status,
      fee,
      title,
      featured: featured || false,
    });

    return res.status(201).json({ newOffer });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Error creating offer' });
  }
};

exports.getOffers = async (req, res) => {
  try {
    const { page = 1, limit = 12, category, sortBy = 'latest', viewMode = 'grid' } = req.query;
    const offset = (page - 1) * limit;

    let orderClause = [['createdAt', 'DESC']]; // Default: Latest

    switch (sortBy) {
      case 'price_low_high':
        orderClause = [[{ model: Service }, 'price', 'ASC']];
        break;
      case 'price_high_low':
        orderClause = [[{ model: Service }, 'price', 'DESC']];
        break;
      case 'discount':
        orderClause = [['discount', 'DESC']];
        break;
      case 'latest':
      default:
        orderClause = [['createdAt', 'DESC']];
        break;
    }

    const whereClause = {};
    if (category) {
      whereClause['$Service.category$'] = category;
    }

    const { count, rows: offers } = await Offer.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: Service,
          attributes: ['id', 'name', 'image_url', 'price', 'duration', 'category', 'type', 'description'],
          include: [
            {
              model: Store,
              attributes: ['id', 'name', 'logo_url', 'google_logo'],
            }
          ]
        }
      ],
      order: orderClause,
      limit: parseInt(limit),
      offset: parseInt(offset),
    });

    // Format offers for frontend
    const formattedOffers = offers.map(offer => ({
      id: offer.id,
      title: offer.title || offer.Service?.name || 'Special Offer',
      description: offer.description || 'Get exclusive offers with these amazing deals',
      discount: `${offer.discount}% Off`,
      category: offer.Service?.category || 'General',
      image: offer.Service?.image_url || 'https://via.placeholder.com/300x200',
      featured: offer.featured || false,
      expiration_date: offer.expiration_date,
      status: offer.status,
      fee: offer.fee,
      service: {
        id: offer.Service?.id,
        name: offer.Service?.name,
        price: offer.Service?.price,
        duration: offer.Service?.duration,
        type: offer.Service?.type,
        description: offer.Service?.description,
      },
      store: {
        id: offer.Service?.Store?.id,
        name: offer.Service?.Store?.name || 'Store Name',
        logo_url: offer.Service?.Store?.logo_url,
        googleLogo: offer.Service?.Store?.google_logo || '/api/placeholder/20/20',
      }
    }));

    const totalPages = Math.ceil(count / limit);

    return res.status(200).json({
      offers: formattedOffers,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalItems: count,
        itemsPerPage: parseInt(limit),
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1
      }
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Error fetching offers' });
  }
};

exports.getRandomOffers = async (req, res) => {
  try {
    const { limit = 12 } = req.query;

    const offers = await Offer.findAll({
      order: sequelize.fn('RAND'),
      limit: parseInt(limit),
      include: [
        {
          model: Service,
          attributes: ['id', 'name', 'image_url', 'price', 'duration', 'category', 'type', 'description'],
          include: [
            {
              model: Store,
              attributes: ['id', 'name', 'logo_url', 'google_logo'],
            }
          ]
        }
      ],
    });

    if (!offers || offers.length === 0) {
      return res.status(404).json({ message: 'No offers found' });
    }

    // Format offers for frontend
    const formattedOffers = offers.map(offer => ({
      id: offer.id,
      title: offer.title || offer.Service?.name || 'Special Offer',
      description: offer.description || 'Get exclusive offers with these amazing deals',
      discount: `${offer.discount}% Off`,
      category: offer.Service?.category || 'General',
      image: offer.Service?.image_url || 'https://via.placeholder.com/300x200',
      featured: offer.featured || false,
      service: {
        id: offer.Service?.id,
        name: offer.Service?.name,
        price: offer.Service?.price,
        duration: offer.Service?.duration,
      },
      store: {
        id: offer.Service?.Store?.id,
        name: offer.Service?.Store?.name || 'Store Name',
        logo_url: offer.Service?.Store?.logo_url,
        googleLogo: offer.Service?.Store?.google_logo || '/api/placeholder/20/20',
      }
    }));

    res.status(200).json({ offers: formattedOffers });
  } catch (error) {
    console.error('Error fetching random offers:', error);
    res.status(500).json({ message: 'Error fetching random offers' });
  }
};

exports.getOffersByStore = async (req, res) => {
  try {
    const { storeId } = req.params;
    const { page = 1, limit = 12 } = req.query;
    const offset = (page - 1) * limit;

    const store = await Store.findByPk(storeId, {
      include: {
        model: Service,
        include: {
          model: Offer,
          attributes: ['id', 'discount', 'expiration_date', 'description', 'status', 'fee', 'title', 'featured'],
        },
        attributes: ['id', 'name', 'image_url', 'price', 'duration', 'category', 'type', 'description'],
      },
    });

    if (!store) {
      return res.status(404).json({ message: 'Store not found' });
    }

    const allOffers = store.Services.flatMap(service =>
      service.Offers.map(offer => ({
        id: offer.id,
        title: offer.title || service.name || 'Special Offer',
        description: offer.description || 'Get exclusive offers with these amazing deals',
        discount: `${offer.discount}% Off`,
        category: service.category || 'General',
        image: service.image_url || 'https://via.placeholder.com/300x200',
        featured: offer.featured || false,
        expiration_date: offer.expiration_date,
        status: offer.status,
        fee: offer.fee,
        service: {
          id: service.id,
          name: service.name,
          price: service.price,
          duration: service.duration,
          type: service.type,
          description: service.description,
        },
        store: {
          id: store.id,
          name: store.name,
          logo_url: store.logo_url,
          googleLogo: store.google_logo || '/api/placeholder/20/20',
        }
      }))
    );

    const totalOffers = allOffers.length;
    const paginatedOffers = allOffers.slice(offset, offset + parseInt(limit));
    const totalPages = Math.ceil(totalOffers / limit);

    return res.status(200).json({
      offers: paginatedOffers,
      store: {
        id: store.id,
        name: store.name,
        logo_url: store.logo_url,
      },
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalItems: totalOffers,
        itemsPerPage: parseInt(limit),
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1
      }
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Error fetching offers by store' });
  }
};

exports.getOfferById = async (req, res) => {
  try {
    const { id } = req.params;

    const offer = await Offer.findByPk(id, {
      include: [
        {
          model: Service,
          attributes: ['id', 'name', 'price', 'duration', 'image_url', 'category', 'description', 'type'],
          include: [
            {
              model: Store,
              attributes: ['id', 'name', 'logo_url', 'google_logo', 'address'],
            }
          ]
        }
      ],
    });

    if (!offer) {
      return res.status(404).json({ message: 'Offer not found' });
    }

    // Format offer for frontend
    const formattedOffer = {
      id: offer.id,
      title: offer.title || offer.Service?.name || 'Special Offer',
      description: offer.description || 'Get exclusive offers with these amazing deals',
      discount: `${offer.discount}% Off`,
      category: offer.Service?.category || 'General',
      image: offer.Service?.image_url || 'https://via.placeholder.com/300x200',
      featured: offer.featured || false,
      expiration_date: offer.expiration_date,
      status: offer.status,
      fee: offer.fee,
      service: {
        id: offer.Service?.id,
        name: offer.Service?.name,
        price: offer.Service?.price,
        duration: offer.Service?.duration,
        type: offer.Service?.type,
        description: offer.Service?.description,
      },
      store: {
        id: offer.Service?.Store?.id,
        name: offer.Service?.Store?.name || 'Store Name',
        logo_url: offer.Service?.Store?.logo_url,
        googleLogo: offer.Service?.Store?.google_logo || '/api/placeholder/20/20',
        address: offer.Service?.Store?.address,
      }
    };

    return res.status(200).json({ offer: formattedOffer });
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

    const { discount, expiration_date, service_id, description, status, title, featured } = req.body;

    const fee = discount ? (discount * 0.05).toFixed(2) : offer.fee;

    const updatedOffer = await offer.update({
      discount: discount || offer.discount,
      expiration_date: expiration_date || offer.expiration_date,
      service_id: service_id || offer.service_id,
      description: description || offer.description,
      status: status || offer.status,
      title: title || offer.title,
      featured: featured !== undefined ? featured : offer.featured,
      fee,
    });

    return res.status(200).json({
      message: 'Offer updated successfully',
      offer: updatedOffer
    });
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

// New endpoint for categories with counts
exports.getCategories = async (req, res) => {
  try {
    const categories = await Service.findAll({
      attributes: [
        'category',
        [sequelize.fn('COUNT', sequelize.col('Offers.id')), 'count']
      ],
      include: [
        {
          model: Offer,
          attributes: [],
          required: true
        }
      ],
      group: ['category'],
      order: [[sequelize.fn('COUNT', sequelize.col('Offers.id')), 'DESC']]
    });

    const formattedCategories = categories.map(cat => ({
      name: cat.category,
      count: parseInt(cat.dataValues.count)
    }));

    return res.status(200).json({ categories: formattedCategories });
  } catch (err) {
    console.error('Error fetching categories:', err);
    return res.status(500).json({ message: 'Error fetching categories' });
  }
};

// New endpoint for top deals
exports.getTopDeals = async (req, res) => {
  try {
    const { limit = 3 } = req.query;

    const topDeals = await Offer.findAll({
      order: [['discount', 'DESC']],
      limit: parseInt(limit),
      include: [
        {
          model: Service,
          attributes: ['name', 'price', 'category'],
        }
      ],
    });

    const formattedDeals = topDeals.map(deal => ({
      title: deal.title || deal.Service?.name || 'Special Deal',
      price: `$${deal.Service?.price || '0'}`,
      category: deal.Service?.category || 'General'
    }));

    return res.status(200).json({ topDeals: formattedDeals });
  } catch (err) {
    console.error('Error fetching top deals:', err);
    return res.status(500).json({ message: 'Error fetching top deals' });
  }
};

// New endpoint for featured offers
exports.getFeaturedOffers = async (req, res) => {
  try {
    const { limit = 6 } = req.query;

    const featuredOffers = await Offer.findAll({
      where: { featured: true },
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      include: [
        {
          model: Service,
          attributes: ['id', 'name', 'image_url', 'price', 'duration', 'category', 'type'],
          include: [
            {
              model: Store,
              attributes: ['id', 'name', 'logo_url', 'google_logo'],
            }
          ]
        }
      ],
    });

    const formattedOffers = featuredOffers.map(offer => ({
      id: offer.id,
      title: offer.title || offer.Service?.name || 'Special Offer',
      description: offer.description || 'Get exclusive offers with these amazing deals',
      discount: `${offer.discount}% Off`,
      category: offer.Service?.category || 'General',
      image: offer.Service?.image_url || 'https://via.placeholder.com/300x200',
      featured: true,
      store: {
        id: offer.Service?.Store?.id,
        name: offer.Service?.Store?.name || 'Store Name',
        logo_url: offer.Service?.Store?.logo_url,
        googleLogo: offer.Service?.Store?.google_logo || '/api/placeholder/20/20',
      }
    }));

    return res.status(200).json({ offers: formattedOffers });
  } catch (err) {
    console.error('Error fetching featured offers:', err);
    return res.status(500).json({ message: 'Error fetching featured offers' });
  }
};
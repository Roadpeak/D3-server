// controllers/discountsController.js - Compatibility layer for existing frontend

const { Offer, Store, Service } = require('../models');

// Get all offers formatted as discounts for backward compatibility
exports.getDiscounts = async (req, res) => {
  try {
    const { limit = 20, category, status = 'active' } = req.query;

    const whereClause = { status };
    const serviceWhere = {};
    
    if (category) {
      serviceWhere.category = category;
    }

    const offers = await Offer.findAll({
      where: whereClause,
      include: [
        {
          model: Service,
          as: 'service', // Use the correct alias
          where: serviceWhere,
          attributes: ['id', 'name', 'image_url', 'price', 'duration', 'category', 'type', 'description'],
          include: [
            {
              model: Store,
              as: 'store',
              attributes: ['id', 'name', 'logo_url', 'location'],
            }
          ]
        }
      ],
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
    });

    // Format offers to match the old discount structure
    const formattedDiscounts = offers.map(offer => {
      const originalPrice = offer.service?.price || 0;
      const discountAmount = (originalPrice * offer.discount) / 100;
      const priceAfterDiscount = originalPrice - discountAmount;

      return {
        id: offer.id,
        name: offer.title || offer.service?.name || 'Special Offer',
        description: offer.description || 'Amazing discount on this service',
        image_url: offer.service?.image_url,
        initial_price: originalPrice,
        price_after_discount: priceAfterDiscount,
        discount_percentage: offer.discount,
        promo_code: `SAVE${offer.discount}`, // Generate a promo code
        expiry_date: offer.expiration_date,
        slug: offer.service?.name?.toLowerCase().replace(/\s+/g, '-') || 'offer',
        store: {
          id: offer.service?.store?.id,
          name: offer.service?.store?.name,
          location: offer.service?.store?.location,
        },
        service: {
          id: offer.service?.id,
          name: offer.service?.name,
          category: offer.service?.category,
          duration: offer.service?.duration,
        },
        status: offer.status,
        featured: offer.featured,
      };
    });

    return res.status(200).json(formattedDiscounts);
  } catch (err) {
    console.error('Error fetching discounts:', err);
    return res.status(500).json({ 
      message: 'Error fetching discounts',
      error: err.message 
    });
  }
};

// Get discount by ID (compatibility)
exports.getDiscountById = async (req, res) => {
  try {
    const { id } = req.params;

    const offer = await Offer.findByPk(id, {
      include: [
        {
          model: Service,
          as: 'service',
          attributes: ['id', 'name', 'image_url', 'price', 'duration', 'category', 'type', 'description'],
          include: [
            {
              model: Store,
              as: 'store',
              attributes: ['id', 'name', 'logo_url', 'location'],
            }
          ]
        }
      ],
    });

    if (!offer) {
      return res.status(404).json({ message: 'Discount not found' });
    }

    const originalPrice = offer.service?.price || 0;
    const discountAmount = (originalPrice * offer.discount) / 100;
    const priceAfterDiscount = originalPrice - discountAmount;

    const formattedDiscount = {
      id: offer.id,
      name: offer.title || offer.service?.name || 'Special Offer',
      description: offer.description || 'Amazing discount on this service',
      image_url: offer.service?.image_url,
      initial_price: originalPrice,
      price_after_discount: priceAfterDiscount,
      discount_percentage: offer.discount,
      promo_code: `SAVE${offer.discount}`,
      expiry_date: offer.expiration_date,
      slug: offer.service?.name?.toLowerCase().replace(/\s+/g, '-') || 'offer',
      store: {
        id: offer.service?.store?.id,
        name: offer.service?.store?.name,
        location: offer.service?.store?.location,
      },
      service: {
        id: offer.service?.id,
        name: offer.service?.name,
        category: offer.service?.category,
        duration: offer.service?.duration,
        description: offer.service?.description,
      },
      status: offer.status,
      featured: offer.featured,
      terms_conditions: offer.terms_conditions,
    };

    return res.status(200).json(formattedDiscount);
  } catch (err) {
    console.error('Error fetching discount:', err);
    return res.status(500).json({ 
      message: 'Error fetching discount',
      error: err.message 
    });
  }
};

module.exports = {
  getDiscounts,
  getDiscountById
};
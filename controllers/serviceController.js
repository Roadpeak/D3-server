const { Service, Offer, Store, Follow } = require('../models');
const { Op } = require('sequelize');
const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET;

exports.createService = async (req, res) => {
  try {
    const { name, price, duration, image_url, store_id, category, description, type } = req.body;

    if (!['fixed', 'dynamic'].includes(type)) {
      return res.status(400).json({ message: 'Invalid service type. Must be "fixed" or "dynamic".' });
    }

    const newService = await Service.create({
      name,
      price: type === 'fixed' ? price : null,
      duration: type === 'fixed' ? duration : null,
      image_url,
      store_id,
      category,
      description,
      type,
    });

    return res.status(201).json({ newService });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Error creating service' });
  }
};

exports.getServices = async (req, res) => {
  try {
    const services = await Service.findAll();
    return res.status(200).json({ services });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Error fetching services' });
  }
};

exports.getServiceById = async (req, res) => {
  try {
    const { id } = req.params;
    const service = await Service.findByPk(id);

    if (!service) {
      return res.status(404).json({ message: 'Service not found' });
    }

    return res.status(200).json({ service });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Error fetching service' });
  }
};

exports.searchServices = async (req, res) => {
  try {
    const { term, minPrice, maxPrice } = req.query;

    const whereClause = {};
    const storeWhereClause = {};

    // Searching for services based on the term
    if (term) {
      whereClause[Op.or] = [
        { name: { [Op.like]: `%${term}%` } },
        { category: { [Op.like]: `%${term}%` } },
        { description: { [Op.like]: `%${term}%` } }
      ];
      if (term.toLowerCase().includes('sale') || term.toLowerCase().includes('offer')) {
        whereClause[Op.or] = [
          ...(whereClause[Op.or] || []),
          { name: { [Op.like]: '%sale%' } },
          { description: { [Op.like]: '%offer%' } }
        ];
      }
    }

    // Searching stores based on the term
    if (term) {
      storeWhereClause[Op.or] = [
        { name: { [Op.like]: `%${term}%` } },
        { location: { [Op.like]: `%${term}%` } },
        { description: { [Op.like]: `%${term}%` } }
      ];
    }

    // Price range filtering for services
    if (minPrice || maxPrice) {
      whereClause.price = {};
      if (minPrice) whereClause.price[Op.gte] = parseFloat(minPrice);
      if (maxPrice) whereClause.price[Op.lte] = parseFloat(maxPrice);
    }

    // Fetch services based on the constructed whereClause and include associated Offers
    const services = await Service.findAll({
      where: whereClause,
      include: [{
        model: Offer,
        required: false // Include services even without offers
      }]
    });

    // Fetch stores based on the storeWhereClause
    const stores = await Store.findAll({
      where: storeWhereClause
    });

    // Get userId from the token
    let userId = null;
    const token = req.headers['authorization']?.split(' ')[1];
    if (token) {
      try {
        const decoded = jwt.verify(token, JWT_SECRET);
        userId = decoded?.userId;
      } catch (err) {
        console.error('Error verifying token:', err);
        userId = null;
      }
    }

    // If the user is logged in, fetch followed stores
    let followedStoreIds = new Set();
    if (userId) {
      const followedStores = await Follow.findAll({
        where: { user_id: userId },
        attributes: ['store_id'],
      });

      followedStoreIds = new Set(followedStores.map(follow => follow.store_id));
    }

    // Now map stores with the follow status
    const storesWithFollowStatus = stores.map(store => {
      const isFollowing = followedStoreIds.has(store.id);
      return {
        ...store.toJSON(),
        following: isFollowing
      };
    });

    // If no stores or services match, send a 200 response with a message
    if (services.length === 0 && storesWithFollowStatus.length === 0) {
      return res.status(200).json({ message: 'No services or stores found matching your criteria' });
    }

    // Return both services and stores with follow status
    return res.status(200).json({ services, stores: storesWithFollowStatus });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Error searching services and stores' });
  }
};

exports.updateService = async (req, res) => {
  try {
    const { id } = req.params;
    const { type } = req.body;

    if (type && !['fixed', 'dynamic'].includes(type)) {
      return res.status(400).json({ message: 'Invalid service type. Must be "fixed" or "dynamic".' });
    }

    const service = await Service.findByPk(id);

    if (!service) {
      return res.status(404).json({ message: 'Service not found' });
    }

    const updatedService = await service.update({
      ...req.body,
      price: type === 'dynamic' ? null : req.body.price || service.price,
      duration: type === 'dynamic' ? null : req.body.duration || service.duration,
    });

    return res.status(200).json({ message: 'Service updated successfully', service: updatedService });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Error updating service' });
  }
};

// Delete a service
exports.deleteService = async (req, res) => {
  try {
    const { id } = req.params;
    const service = await Service.findByPk(id);

    if (!service) {
      return res.status(404).json({ message: 'Service not found' });
    }

    await service.destroy();
    return res.status(200).json({ message: 'Service deleted successfully' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Error deleting service' });
  }
};

exports.getServicesByStoreId = async (req, res) => {
  try {
    const { storeId } = req.params;
    const services = await Service.findAll({
      where: {
        store_id: storeId,
      },
    });

    if (services.length === 0) {
      return res.status(404).json({ message: 'No services found for this store' });
    }

    return res.status(200).json({ services });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Error fetching services for this store' });
  }
};


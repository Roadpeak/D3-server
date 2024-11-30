const { Service, Sequelize } = require('../models');

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

exports.searchServices = async (req, res) => {
  try {
    const { name, category, minPrice, maxPrice } = req.query;

    // Build the where clause based on provided query parameters
    const whereClause = {};

    if (name) {
      whereClause.name = {
        [Sequelize.Op.iLike]: `%${name}%`  // Case-insensitive search for name
      };
    }

    if (category) {
      whereClause.category = {
        [Sequelize.Op.iLike]: `%${category}%`  // Case-insensitive search for category
      };
    }

    if (minPrice || maxPrice) {
      whereClause.price = {};
      
      if (minPrice) {
        whereClause.price[Sequelize.Op.gte] = parseFloat(minPrice);  // Greater than or equal to minPrice
      }
      
      if (maxPrice) {
        whereClause.price[Sequelize.Op.lte] = parseFloat(maxPrice);  // Less than or equal to maxPrice
      }
    }

    // Find services based on filters
    const services = await Service.findAll({
      where: whereClause
    });

    if (services.length === 0) {
      return res.status(404).json({ message: 'No services found matching your criteria' });
    }

    return res.status(200).json({ services });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Error searching services' });
  }
};

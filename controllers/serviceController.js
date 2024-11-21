const { Service } = require('../models');

// Create a new service
exports.createService = async (req, res) => {
  try {
    const { name, price, duration, image_url, store_id, category, description } = req.body;

    const newService = await Service.create({
      name,
      price,
      duration,
      image_url,
      store_id,
      category,
      description,
    });

    return res.status(201).json({ newService });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Error creating service' });
  }
};

// Get all services
exports.getServices = async (req, res) => {
  try {
    const services = await Service.findAll();
    return res.status(200).json({ services });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Error fetching services' });
  }
};

// Get a single service
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

// Update a service
exports.updateService = async (req, res) => {
  try {
    const { id } = req.params;
    const service = await Service.findByPk(id);

    if (!service) {
      return res.status(404).json({ message: 'Service not found' });
    }

    const updatedService = await service.update({
      ...req.body,
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
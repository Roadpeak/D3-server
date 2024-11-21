const { Store } = require('../models');

// Create a new store
exports.createStore = async (req, res) => {
  try {
    const { name, location, primary_email, phone_number, description, website_url, logo_url, opening_time, closing_time, working_days, status, merchant_id } = req.body;

    if (!merchant_id) {
      return res.status(400).json({ message: 'Merchant ID is required' });
    }

    const newStore = await Store.create({
      name,
      location,
      primary_email,
      phone_number,
      description,
      website_url,
      logo_url,
      opening_time,
      closing_time,
      working_days,
      status,
      merchant_id,
      created_by: req.user.id,
    });

    return res.status(201).json({ newStore });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Error creating store' });
  }
};


// Get all stores
exports.getStores = async (req, res) => {
  try {
    const stores = await Store.findAll();
    return res.status(200).json({ stores });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Error fetching stores' });
  }
};

// Get a single store
exports.getStoreById = async (req, res) => {
  try {
    const { id } = req.params;
    const store = await Store.findByPk(id);

    if (!store) {
      return res.status(404).json({ message: 'Store not found' });
    }

    return res.status(200).json({ store });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Error fetching store' });
  }
};

// Update a store
exports.updateStore = async (req, res) => {
  try {
    const { id } = req.params;
    const store = await Store.findByPk(id);

    if (!store) {
      return res.status(404).json({ message: 'Store not found' });
    }

    const updatedStore = await store.update({
      ...req.body,
      updated_by: req.user.id,
    });

    return res.status(200).json({ message: 'Store updated successfully', store: updatedStore });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Error updating store' });
  }
};

// Delete a store
exports.deleteStore = async (req, res) => {
  try {
    const { id } = req.params;
    const store = await Store.findByPk(id);

    if (!store) {
      return res.status(404).json({ message: 'Store not found' });
    }

    await store.destroy();
    return res.status(200).json({ message: 'Store deleted successfully' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Error deleting store' });
  }
};

const { Follow, Store, sequelize } = require('../models');
const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET;
const { Sequelize } = require('sequelize');

exports.createStore = async (req, res) => {
  try {
    const { name, location, primary_email, phone_number, description, website_url, logo_url, opening_time, closing_time, working_days, status, merchant_id } = req.body;

    if (!merchant_id) {
      return res.status(400).json({ message: 'Merchant ID is required' });
    }

    const existingStore = await Store.findOne({ where: { primary_email } });
    if (existingStore) {
      return res.status(400).json({ message: 'A store with this primary email already exists' });
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

exports.getStores = async (req, res) => {
  try {
    const stores = await Store.findAll();

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

    if (userId) {
      const followedStores = await Follow.findAll({
        where: { user_id: userId },
        attributes: ['store_id'],
      });

      const followedStoreIds = new Set(followedStores.map(follow => follow.store_id));

      const storesWithFollowStatus = stores.map(store => {
        return {
          ...store.toJSON(),
          following: followedStoreIds.has(store.id)
        };
      });

      return res.status(200).json({ stores: storesWithFollowStatus });
    }

    const storesWithNoFollow = stores.map(store => ({
      ...store.toJSON(),
      following: false
    }));

    return res.status(200).json({ stores: storesWithNoFollow });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Error fetching stores' });
  }
};

exports.getStoreById = async (req, res) => {
  try {
    const { id } = req.params;
    const store = await Store.findByPk(id);

    if (!store) {
      return res.status(404).json({ message: 'Store not found' });
    }

    let userId = null;
    const token = req.headers['authorization']?.split(' ')[1];

    if (token) {
      try {
        const decoded = jwt.verify(token, JWT_SECRET);
        userId = decoded?.userId;
      } catch (err) {
        console.error('Error verifying token:', err);
        return res.status(401).json({ message: 'Unauthorized: Invalid token' });
      }
    }

    let following = false;

    if (userId) {
      const followedStore = await Follow.findOne({
        where: { user_id: userId, store_id: id },
      });

      if (followedStore) {
        following = true;
      }
    }

    return res.status(200).json({
      store: {
        ...store.toJSON(),
        following,
      },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Error fetching store' });
  }
};

exports.getRandomStores = async (req, res) => {
  try {
    const stores = await Store.findAll({
      order: sequelize.random(),
      limit: 21,
    });

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

    if (userId) {
      // Fetch the stores followed by the user
      const followedStores = await Follow.findAll({
        where: { user_id: userId },
        attributes: ['store_id'],
      });

      const followedStoreIds = new Set(followedStores.map(follow => follow.store_id));

      // Attach `following` status to each store
      const storesWithFollowStatus = stores.map(store => ({
        ...store.toJSON(),
        following: followedStoreIds.has(store.id),
      }));

      return res.status(200).json({ stores: storesWithFollowStatus });
    }

    // If user is not authenticated, set `following` to false for all stores
    const storesWithNoFollow = stores.map(store => ({
      ...store.toJSON(),
      following: false,
    }));

    return res.status(200).json({ stores: storesWithNoFollow });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Error fetching random stores' });
  }
};

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

const { Follow, Store, Deal, Service, Outlet, Review, User, sequelize } = require('../models');
const jwt = require('jsonwebtoken');
const { Op } = require('sequelize');
const JWT_SECRET = process.env.JWT_SECRET;

exports.createStore = async (req, res) => {
  try {
    const {
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
      cashback,
      category,
      rating,
      was_rate
    } = req.body;

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
      cashback,
      category,
      rating: rating || 0,
      was_rate,
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
    const {
      category,
      location,
      sortBy,
      page = 1,
      limit = 20
    } = req.query;

    // Build where clause for filtering
    const whereClause = {};

    if (category && category !== 'All') {
      whereClause.category = category;
    }

    if (location && location !== 'All Locations') {
      whereClause[Op.or] = [
        { location: location },
        { location: 'All Locations' }
      ];
    }

    // Build order clause for sorting
    let orderClause = [['created_at', 'DESC']]; // default sort

    switch (sortBy) {
      case 'Popular':
        orderClause = [['rating', 'DESC']];
        break;
      case 'Highest Cashback':
        orderClause = [
          [sequelize.literal(`CAST(REPLACE(REPLACE(cashback, '%', ''), '$', '') AS DECIMAL(10,2))`), 'DESC']
        ];
        break;
      case 'Lowest Cashback':
        orderClause = [
          [sequelize.literal(`CAST(REPLACE(REPLACE(cashback, '%', ''), '$', '') AS DECIMAL(10,2))`), 'ASC']
        ];
        break;
      case 'A-Z':
        orderClause = [['name', 'ASC']];
        break;
      case 'Z-A':
        orderClause = [['name', 'DESC']];
        break;
      default:
        orderClause = [['rating', 'DESC']];
    }

    // Calculate pagination
    const offset = (page - 1) * limit;

    const { count, rows: stores } = await Store.findAndCountAll({
      where: whereClause,
      order: orderClause,
      limit: parseInt(limit),
      offset: parseInt(offset),
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
      const followedStores = await Follow.findAll({
        where: { user_id: userId },
        attributes: ['store_id'],
      });

      const followedStoreIds = new Set(followedStores.map(follow => follow.store_id));

      const storesWithFollowStatus = stores.map(store => {
        const storeData = store.toJSON();
        return {
          ...storeData,
          following: followedStoreIds.has(store.id),
          // Ensure frontend-compatible field names
          logo: storeData.logo_url,
          wasRate: storeData.was_rate
        };
      });

      return res.status(200).json({
        stores: storesWithFollowStatus,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(count / limit),
          totalItems: count,
          hasNextPage: offset + stores.length < count,
          hasPrevPage: page > 1
        }
      });
    }

    const storesWithNoFollow = stores.map(store => {
      const storeData = store.toJSON();
      return {
        ...storeData,
        following: false,
        logo: storeData.logo_url,
        wasRate: storeData.was_rate
      };
    });

    return res.status(200).json({
      stores: storesWithNoFollow,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(count / limit),
        totalItems: count,
        hasNextPage: offset + stores.length < count,
        hasPrevPage: page > 1
      }
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Error fetching stores' });
  }
};

exports.getStoreById = async (req, res) => {
  try {
    const { id } = req.params;

    // Get store with all related data
    const store = await Store.findByPk(id, {
      include: [
        {
          model: Deal,
          as: 'deals',
          where: {
            status: 'active',
            [Op.or]: [
              { expires_at: { [Op.gt]: new Date() } },
              { expires_at: null }
            ]
          },
          required: false
        },
        {
          model: Service,
          as: 'services',
          where: { status: 'active' },
          required: false
        },
        {
          model: Outlet,
          as: 'outlets',
          where: { status: 'active' },
          required: false
        },
        {
          model: Review,
          as: 'reviews',
          include: [
            {
              model: User,
              as: 'user',
              attributes: ['first_name', 'last_name']
            }
          ],
          order: [['created_at', 'DESC']],
          limit: 10
        }
      ]
    });

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
        // Don't return error here, just set userId to null
        userId = null;
      }
    }

    let following = false;
    let followersCount = 0;

    // Get followers count
    followersCount = await Follow.count({
      where: { store_id: id }
    });

    // Check if current user is following this store
    if (userId) {
      const followedStore = await Follow.findOne({
        where: { user_id: userId, store_id: id },
      });
      following = !!followedStore;
    }

    // Calculate average rating and total reviews
    const reviewStats = await Review.findOne({
      where: { store_id: id },
      attributes: [
        [sequelize.fn('AVG', sequelize.col('rating')), 'avgRating'],
        [sequelize.fn('COUNT', sequelize.col('id')), 'totalReviews']
      ],
      raw: true
    });

    const avgRating = reviewStats?.avgRating ? parseFloat(reviewStats.avgRating).toFixed(1) : store.rating || 0;
    const totalReviews = reviewStats?.totalReviews || 0;

    const storeData = store.toJSON();

    // Format the response data
    const responseData = {
      ...storeData,
      following,
      followers: followersCount,
      totalReviews: parseInt(totalReviews),
      rating: parseFloat(avgRating),
      logo: storeData.logo_url,
      wasRate: storeData.was_rate,

      // Format social links
      socialLinks: {
        facebook: storeData.facebook_url || `https://facebook.com/${storeData.name?.toLowerCase().replace(/\s+/g, '')}`,
        twitter: storeData.twitter_url || `https://twitter.com/${storeData.name?.toLowerCase().replace(/\s+/g, '')}`,
        instagram: storeData.instagram_url || `https://instagram.com/${storeData.name?.toLowerCase().replace(/\s+/g, '')}`,
        website: storeData.website_url || `https://${storeData.name?.toLowerCase().replace(/\s+/g, '')}.com`
      },

      // Format deals
      deals: storeData.deals?.map(deal => ({
        id: deal.id,
        type: deal.deal_type || 'cashback',
        title: deal.title || `${storeData.cashback} Cashback for Purchases at ${storeData.name}`,
        description: deal.description || `${storeData.cashback} Base Cashback\nValid on all purchases\nNo minimum order value required`,
        discount: deal.discount_amount || storeData.cashback,
        label: deal.discount_type?.toUpperCase() || 'BACK',
        buttonText: deal.cta_text || 'Get Reward',
        expiryDate: deal.expires_at ? new Date(deal.expires_at).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric'
        }) : null,
        code: deal.promo_code || null,
        terms: deal.terms_conditions || 'Cashback is not available if you fail to clean your shopping bag before clicking through to the retailer.'
      })) || [
          // Default cashback deal if no deals exist
          {
            id: 1,
            type: 'cashback',
            title: `${storeData.cashback || '5%'} Cashback for Purchases at ${storeData.name}`,
            description: `${storeData.cashback || '5%'} Base Cashback\nValid on all purchases\nNo minimum order value required`,
            discount: storeData.cashback || '5%',
            label: 'BACK',
            buttonText: 'Get Reward',
            expiryDate: null,
            terms: 'Cashback is not available if you fail to clean your shopping bag before clicking through to the retailer.'
          }
        ],

      // Format services
      services: storeData.services?.map(service => ({
        id: service.id,
        title: service.name || service.title,
        description: service.description,
        duration: service.duration || '60 minutes',
        price: service.price || '$50',
        available: service.status === 'active'
      })) || [
          // Default services if none exist
          {
            id: 1,
            title: 'Personal Shopping Consultation',
            description: 'Get personalized style advice from our expert consultants',
            duration: '60 minutes',
            price: '$50',
            available: true
          },
          {
            id: 2,
            title: 'Product Fitting Service',
            description: 'Professional fitting service to ensure perfect comfort and performance',
            duration: '30 minutes',
            price: 'Free',
            available: true
          }
        ],

      // Format outlets
      outlets: storeData.outlets?.map(outlet => ({
        id: outlet.id,
        name: outlet.name || `${storeData.name} ${outlet.location}`,
        address: outlet.address,
        phone: outlet.phone_number || storeData.phone_number,
        hours: outlet.operating_hours || 'Mon-Sat: 9AM-9PM, Sun: 11AM-7PM',
        distance: outlet.distance || Math.random() * 5 + 0.5 + ' miles', // Random for demo
        image: outlet.image_url || storeData.logo_url,
        latitude: outlet.latitude,
        longitude: outlet.longitude
      })) || [
          // Default outlets if none exist
          {
            id: 1,
            name: `${storeData.name} Downtown`,
            address: '123 Main Street, Downtown, City 10001',
            phone: storeData.phone_number || '+1 (555) 123-4567',
            hours: 'Mon-Sat: 9AM-9PM, Sun: 11AM-7PM',
            distance: '0.5 miles',
            image: storeData.logo_url
          }
        ],

      // Format reviews
      reviews: storeData.reviews?.map(review => ({
        id: review.id,
        name: review.user ? `${review.user.first_name} ${review.user.last_name.charAt(0)}.` : 'Anonymous',
        rating: review.rating,
        date: new Date(review.created_at).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric'
        }),
        comment: review.comment
      })) || []
    };

    return res.status(200).json({
      store: responseData,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Error fetching store' });
  }
};

exports.getRandomStores = async (req, res) => {
  try {
    const { limit = 21 } = req.query;

    const stores = await Store.findAll({
      order: sequelize.random(),
      limit: parseInt(limit),
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
      const storesWithFollowStatus = stores.map(store => {
        const storeData = store.toJSON();
        return {
          ...storeData,
          following: followedStoreIds.has(store.id),
          logo: storeData.logo_url,
          wasRate: storeData.was_rate
        };
      });

      return res.status(200).json({ stores: storesWithFollowStatus });
    }

    // If user is not authenticated, set `following` to false for all stores
    const storesWithNoFollow = stores.map(store => {
      const storeData = store.toJSON();
      return {
        ...storeData,
        following: false,
        logo: storeData.logo_url,
        wasRate: storeData.was_rate
      };
    });

    return res.status(200).json({ stores: storesWithNoFollow });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Error fetching random stores' });
  }
};

// New endpoint to toggle follow status
exports.toggleFollowStore = async (req, res) => {
  try {
    const { id } = req.params;
    const token = req.headers['authorization']?.split(' ')[1];

    if (!token) {
      return res.status(401).json({ message: 'Unauthorized: No token provided' });
    }

    let userId;
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      userId = decoded?.userId;
    } catch (err) {
      return res.status(401).json({ message: 'Unauthorized: Invalid token' });
    }

    // Check if store exists
    const store = await Store.findByPk(id);
    if (!store) {
      return res.status(404).json({ message: 'Store not found' });
    }

    // Check if user is already following the store
    const existingFollow = await Follow.findOne({
      where: { user_id: userId, store_id: id }
    });

    let following = false;
    if (existingFollow) {
      // Unfollow
      await existingFollow.destroy();
      following = false;
    } else {
      // Follow
      await Follow.create({
        user_id: userId,
        store_id: id
      });
      following = true;
    }

    // Get updated followers count
    const followersCount = await Follow.count({
      where: { store_id: id }
    });

    return res.status(200).json({
      following,
      followers: followersCount,
      message: following ? 'Store followed successfully' : 'Store unfollowed successfully'
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Error toggling follow status' });
  }
};

// New endpoint to submit a review
exports.submitReview = async (req, res) => {
  try {
    const { id } = req.params;
    const { rating, comment } = req.body;
    const token = req.headers['authorization']?.split(' ')[1];

    if (!token) {
      return res.status(401).json({ message: 'Unauthorized: No token provided' });
    }

    let userId;
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      userId = decoded?.userId;
    } catch (err) {
      return res.status(401).json({ message: 'Unauthorized: Invalid token' });
    }

    if (!rating || !comment) {
      return res.status(400).json({ message: 'Rating and comment are required' });
    }

    // Check if store exists
    const store = await Store.findByPk(id);
    if (!store) {
      return res.status(404).json({ message: 'Store not found' });
    }

    // Check if user already reviewed this store
    const existingReview = await Review.findOne({
      where: { user_id: userId, store_id: id }
    });

    if (existingReview) {
      return res.status(400).json({ message: 'You have already reviewed this store' });
    }

    // Create new review
    const newReview = await Review.create({
      user_id: userId,
      store_id: id,
      rating: parseInt(rating),
      comment,
    });

    // Update store's average rating
    const reviewStats = await Review.findOne({
      where: { store_id: id },
      attributes: [
        [sequelize.fn('AVG', sequelize.col('rating')), 'avgRating'],
        [sequelize.fn('COUNT', sequelize.col('id')), 'totalReviews']
      ],
      raw: true
    });

    const avgRating = reviewStats?.avgRating ? parseFloat(reviewStats.avgRating).toFixed(1) : rating;

    // Update store rating
    await store.update({ rating: avgRating });

    return res.status(201).json({
      message: 'Review submitted successfully',
      review: {
        id: newReview.id,
        rating: newReview.rating,
        comment: newReview.comment,
        date: new Date(newReview.created_at).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric'
        })
      },
      storeRating: parseFloat(avgRating),
      totalReviews: parseInt(reviewStats?.totalReviews || 1)
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Error submitting review' });
  }
};

exports.getCategories = async (req, res) => {
  try {
    const categories = await Store.findAll({
      attributes: [[sequelize.fn('DISTINCT', sequelize.col('category')), 'category']],
      where: {
        category: {
          [Op.not]: null
        }
      },
      raw: true
    });

    const categoryList = ['All', ...categories.map(cat => cat.category).filter(Boolean)];

    return res.status(200).json({ categories: categoryList });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Error fetching categories' });
  }
};

exports.getLocations = async (req, res) => {
  try {
    const locations = await Store.findAll({
      attributes: [[sequelize.fn('DISTINCT', sequelize.col('location')), 'location']],
      where: {
        location: {
          [Op.not]: null
        }
      },
      raw: true
    });

    const locationList = ['All Locations', ...locations.map(loc => loc.location).filter(Boolean)];

    return res.status(200).json({ locations: locationList });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Error fetching locations' });
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

    const storeData = updatedStore.toJSON();
    return res.status(200).json({
      message: 'Store updated successfully',
      store: {
        ...storeData,
        logo: storeData.logo_url,
        wasRate: storeData.was_rate
      }
    });
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
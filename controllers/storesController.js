const { Follow, Store, Deal, Service, Outlet, Review, User, Merchant, sequelize } = require('../models');
const jwt = require('jsonwebtoken');
const { Op } = require('sequelize');
const JWT_SECRET = process.env.JWT_SECRET;

// Updated createStore function in storesController.js
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
      status = 'open', // Use 'open' since that's in your ENUM
      cashback = '5%',
      category,
      rating = 0,
      was_rate
    } = req.body;

    // Validate required fields
    if (!name || !location || !primary_email || !phone_number || !description) {
      return res.status(400).json({ 
        success: false,
        message: 'Name, location, primary email, phone number, and description are required' 
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(primary_email)) {
      return res.status(400).json({ 
        success: false,
        message: 'Invalid email format' 
      });
    }

    // Validate working days
    if (!working_days || !Array.isArray(working_days) || working_days.length === 0) {
      return res.status(400).json({ 
        success: false,
        message: 'At least one working day is required' 
      });
    }

    // Validate times
    if (!opening_time || !closing_time) {
      return res.status(400).json({ 
        success: false,
        message: 'Opening and closing times are required' 
      });
    }

    // Check if merchant already has a store
    const existingStore = await Store.findOne({ where: { merchant_id: req.user.id } });
    if (existingStore) {
      return res.status(400).json({ 
        success: false,
        message: 'You already have a store. Each merchant can only have one store.' 
      });
    }

    // Check if email is already in use
    const existingEmailStore = await Store.findOne({ where: { primary_email } });
    if (existingEmailStore) {
      return res.status(400).json({ 
        success: false,
        message: 'A store with this primary email already exists' 
      });
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
      working_days: JSON.stringify(working_days), // Store as JSON string
      status: 'open', // Use valid ENUM value
      is_active: true, // IMPORTANT: Set this to true for store to show up
      merchant_id: req.user.id,
      cashback,
      category,
      rating,
      was_rate,
      created_by: req.user.id,
    });

    // Return store data with proper formatting
    const storeData = newStore.toJSON();
    try {
      storeData.working_days = JSON.parse(storeData.working_days || '[]');
    } catch (e) {
      storeData.working_days = [];
    }

    return res.status(201).json({ 
      success: true,
      message: 'Store created successfully',
      newStore: storeData 
    });
  } catch (err) {
    console.error('Create store error:', err);
    return res.status(500).json({ 
      success: false,
      message: 'Error creating store',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};
exports.getMerchantStores = async (req, res) => {
  try {
    const stores = await Store.findAll({
      where: { merchant_id: req.user.id },
      include: [
        {
          model: Merchant,
          as: 'merchant',
          attributes: ['id', 'firstName', 'lastName', 'email']
        }
      ],
      order: [['created_at', 'DESC']]
    });

    // Format stores data
    const formattedStores = stores.map(store => {
      const storeData = store.toJSON();
      storeData.working_days = JSON.parse(storeData.working_days || '[]');
      storeData.logo = storeData.logo_url;
      storeData.wasRate = storeData.was_rate;
      return storeData;
    });

    return res.status(200).json({
      success: true,
      stores: formattedStores
    });
  } catch (err) {
    console.error('Get merchant stores error:', err);
    return res.status(500).json({ 
      success: false,
      message: 'Error fetching stores',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
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
    const whereClause = { status: 'active' }; // Only show active stores

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
      include: [
        {
          model: Merchant,
          as: 'merchant',
          attributes: ['id', 'firstName', 'lastName']
        }
      ]
    });

    let userId = null;
    const token = req.headers['authorization']?.split(' ')[1];
    if (token) {
      try {
        const decoded = jwt.verify(token, JWT_SECRET);
        userId = decoded?.userId || decoded?.id;
      } catch (err) {
        console.error('Error verifying token:', err);
        userId = null;
      }
    }

    // Get follow status if user is authenticated
    let followedStoreIds = new Set();
    if (userId) {
      const followedStores = await Follow.findAll({
        where: { user_id: userId },
        attributes: ['store_id'],
      });
      followedStoreIds = new Set(followedStores.map(follow => follow.store_id));
    }

    // Format stores with follow status
    const storesWithFollowStatus = stores.map(store => {
      const storeData = store.toJSON();
      storeData.working_days = JSON.parse(storeData.working_days || '[]');
      return {
        ...storeData,
        following: followedStoreIds.has(store.id),
        logo: storeData.logo_url,
        wasRate: storeData.was_rate
      };
    });

    return res.status(200).json({
      success: true,
      stores: storesWithFollowStatus,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(count / limit),
        totalItems: count,
        hasNextPage: offset + stores.length < count,
        hasPrevPage: page > 1
      }
    });
  } catch (err) {
    console.error('Get stores error:', err);
    return res.status(500).json({ 
      success: false,
      message: 'Error fetching stores',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
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
        },
        {
          model: Merchant,
          as: 'merchant',
          attributes: ['id', 'firstName', 'lastName', 'email']
        }
      ]
    });

    if (!store) {
      return res.status(404).json({ 
        success: false,
        message: 'Store not found' 
      });
    }

    let userId = null;
    const token = req.headers['authorization']?.split(' ')[1];

    if (token) {
      try {
        const decoded = jwt.verify(token, JWT_SECRET);
        userId = decoded?.userId || decoded?.id;
      } catch (err) {
        console.error('Error verifying token:', err);
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
    storeData.working_days = JSON.parse(storeData.working_days || '[]');

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
        facebook: storeData.facebook_url || null,
        twitter: storeData.twitter_url || null,
        instagram: storeData.instagram_url || null,
        website: storeData.website_url || null
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
      })) || [],

      // Format services
      services: storeData.services?.map(service => ({
        id: service.id,
        title: service.name || service.title,
        description: service.description,
        duration: service.duration || '60 minutes',
        price: service.price || '$50',
        available: service.status === 'active'
      })) || [],

      // Format outlets
      outlets: storeData.outlets?.map(outlet => ({
        id: outlet.id,
        name: outlet.name || `${storeData.name} ${outlet.location}`,
        address: outlet.address,
        phone: outlet.phone_number || storeData.phone_number,
        hours: outlet.operating_hours || `${storeData.opening_time} - ${storeData.closing_time}`,
        distance: outlet.distance || null,
        image: outlet.image_url || storeData.logo_url,
        latitude: outlet.latitude,
        longitude: outlet.longitude
      })) || [],

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
      success: true,
      store: responseData,
    });
  } catch (err) {
    console.error('Get store by ID error:', err);
    return res.status(500).json({ 
      success: false,
      message: 'Error fetching store',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

exports.updateStore = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if store exists and belongs to the merchant
    const store = await Store.findOne({
      where: { 
        id,
        merchant_id: req.user.id 
      }
    });

    if (!store) {
      return res.status(404).json({ 
        success: false,
        message: 'Store not found or access denied' 
      });
    }

    // Validate email if it's being updated
    if (req.body.primary_email && req.body.primary_email !== store.primary_email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(req.body.primary_email)) {
        return res.status(400).json({ 
          success: false,
          message: 'Invalid email format' 
        });
      }

      // Check if email is already in use by another store
      const existingEmailStore = await Store.findOne({ 
        where: { 
          primary_email: req.body.primary_email,
          id: { [Op.ne]: id }
        } 
      });
      if (existingEmailStore) {
        return res.status(400).json({ 
          success: false,
          message: 'A store with this primary email already exists' 
        });
      }
    }

    // Prepare update data
    const updateData = { ...req.body };
    if (updateData.working_days && Array.isArray(updateData.working_days)) {
      updateData.working_days = JSON.stringify(updateData.working_days);
    }
    updateData.updated_by = req.user.id;

    const updatedStore = await store.update(updateData);

    const storeData = updatedStore.toJSON();
    storeData.working_days = JSON.parse(storeData.working_days || '[]');

    return res.status(200).json({
      success: true,
      message: 'Store updated successfully',
      store: {
        ...storeData,
        logo: storeData.logo_url,
        wasRate: storeData.was_rate
      }
    });
  } catch (err) {
    console.error('Update store error:', err);
    return res.status(500).json({ 
      success: false,
      message: 'Error updating store',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

exports.deleteStore = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if store exists and belongs to the merchant
    const store = await Store.findOne({
      where: { 
        id,
        merchant_id: req.user.id 
      }
    });

    if (!store) {
      return res.status(404).json({ 
        success: false,
        message: 'Store not found or access denied' 
      });
    }

    await store.destroy();
    
    return res.status(200).json({ 
      success: true,
      message: 'Store deleted successfully' 
    });
  } catch (err) {
    console.error('Delete store error:', err);
    return res.status(500).json({ 
      success: false,
      message: 'Error deleting store',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

exports.getRandomStores = async (req, res) => {
  try {
    const { limit = 21 } = req.query;

    const stores = await Store.findAll({
      where: { is_active: true }, // Changed from status: 'active'
      order: sequelize.random(),
      limit: parseInt(limit),
      include: [
        {
          model: Merchant,
          as: 'storeMerchant', // Updated alias
          attributes: ['id', 'firstName', 'lastName']
        }
      ]
    });

    let userId = null;
    const token = req.headers['authorization']?.split(' ')[1];

    if (token) {
      try {
        const decoded = jwt.verify(token, JWT_SECRET);
        userId = decoded?.userId || decoded?.id;
      } catch (err) {
        console.error('Error verifying token:', err);
        userId = null;
      }
    }

    // Get follow status if user is authenticated
    let followedStoreIds = new Set();
    if (userId) {
      const followedStores = await Follow.findAll({
        where: { user_id: userId },
        attributes: ['store_id'],
      });
      followedStoreIds = new Set(followedStores.map(follow => follow.store_id));
    }

    // Format stores with follow status
    const storesWithFollowStatus = stores.map(store => {
      const storeData = store.toJSON();
      storeData.working_days = JSON.parse(storeData.working_days || '[]');
      return {
        ...storeData,
        following: followedStoreIds.has(store.id),
        logo: storeData.logo_url,
        wasRate: storeData.was_rate
      };
    });

    return res.status(200).json({ 
      success: true,
      stores: storesWithFollowStatus 
    });
  } catch (err) {
    console.error('Get random stores error:', err);
    return res.status(500).json({ 
      success: false,
      message: 'Error fetching random stores',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

exports.toggleFollowStore = async (req, res) => {
  try {
    const { id } = req.params;
    const token = req.headers['authorization']?.split(' ')[1];

    if (!token) {
      return res.status(401).json({ 
        success: false,
        message: 'Unauthorized: No token provided' 
      });
    }

    let userId;
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      userId = decoded?.userId || decoded?.id;
    } catch (err) {
      return res.status(401).json({ 
        success: false,
        message: 'Unauthorized: Invalid token' 
      });
    }

    // Check if store exists and is active
    const store = await Store.findOne({
      where: { 
        id,
        is_active: true // Changed from status: 'active'
      }
    });
    if (!store) {
      return res.status(404).json({ 
        success: false,
        message: 'Store not found' 
      });
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
      success: true,
      following,
      followers: followersCount,
      message: following ? 'Store followed successfully' : 'Store unfollowed successfully'
    });
  } catch (err) {
    console.error('Toggle follow store error:', err);
    return res.status(500).json({ 
      success: false,
      message: 'Error toggling follow status',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

exports.submitReview = async (req, res) => {
  try {
    const { id } = req.params;
    const { rating, comment } = req.body;
    const token = req.headers['authorization']?.split(' ')[1];

    if (!token) {
      return res.status(401).json({ 
        success: false,
        message: 'Unauthorized: No token provided' 
      });
    }

    let userId;
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      userId = decoded?.userId || decoded?.id;
    } catch (err) {
      return res.status(401).json({ 
        success: false,
        message: 'Unauthorized: Invalid token' 
      });
    }

    if (!rating || !comment) {
      return res.status(400).json({ 
        success: false,
        message: 'Rating and comment are required' 
      });
    }

    if (rating < 1 || rating > 5) {
      return res.status(400).json({ 
        success: false,
        message: 'Rating must be between 1 and 5' 
      });
    }

    // Check if store exists and is active
    const store = await Store.findOne({
      where: { 
        id,
        is_active: true // Changed from status: 'active'
      }
    });
    if (!store) {
      return res.status(404).json({ 
        success: false,
        message: 'Store not found' 
      });
    }

    // Check if user already reviewed this store
    const existingReview = await Review.findOne({
      where: { user_id: userId, store_id: id }
    });

    if (existingReview) {
      return res.status(400).json({ 
        success: false,
        message: 'You have already reviewed this store' 
      });
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
      success: true,
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
    console.error('Submit review error:', err);
    return res.status(500).json({ 
      success: false,
      message: 'Error submitting review',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

exports.getCategories = async (req, res) => {
  try {
    const categories = await Store.findAll({
      attributes: [[sequelize.fn('DISTINCT', sequelize.col('category')), 'category']],
      where: {
        category: {
          [Op.not]: null
        },
        is_active: true // Changed from status: 'active'
      },
      raw: true
    });

    const categoryList = ['All', ...categories.map(cat => cat.category).filter(Boolean)];

    return res.status(200).json({ 
      success: true,
      categories: categoryList 
    });
  } catch (err) {
    console.error('Get categories error:', err);
    return res.status(500).json({ 
      success: false,
      message: 'Error fetching categories',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

exports.getLocations = async (req, res) => {
  try {
    const locations = await Store.findAll({
      attributes: [[sequelize.fn('DISTINCT', sequelize.col('location')), 'location']],
      where: {
        location: {
          [Op.not]: null
        },
        is_active: true // Changed from status: 'active'
      },
      raw: true
    });

    const locationList = ['All Locations', ...locations.map(loc => loc.location).filter(Boolean)];

    return res.status(200).json({ 
      success: true,
      locations: locationList 
    });
  } catch (err) {
    console.error('Get locations error:', err);
    return res.status(500).json({ 
      success: false,
      message: 'Error fetching locations',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

// Store analytics for merchants
exports.getStoreAnalytics = async (req, res) => {
  try {
    const { timeRange = '7d' } = req.query;
    
    // Get merchant's store
    const store = await Store.findOne({
      where: { merchant_id: req.user.id }
    });

    if (!store) {
      return res.status(404).json({
        success: false,
        message: 'Store not found'
      });
    }

    // Calculate date range
    const now = new Date();
    let startDate = new Date();
    
    switch (timeRange) {
      case '24h':
        startDate.setHours(now.getHours() - 24);
        break;
      case '7d':
        startDate.setDate(now.getDate() - 7);
        break;
      case '30d':
        startDate.setDate(now.getDate() - 30);
        break;
      case '90d':
        startDate.setDate(now.getDate() - 90);
        break;
      default:
        startDate.setDate(now.getDate() - 7);
    }

    // Get various analytics
    const [
      totalViews,
      totalFollowers,
      totalReviews,
      averageRating,
      totalBookings,
      recentReviews
    ] = await Promise.all([
      // Total views (you might need to implement view tracking)
      Promise.resolve(Math.floor(Math.random() * 1000) + 100), // Mock data
      
      // Total followers
      Follow.count({ where: { store_id: store.id } }),
      
      // Total reviews
      Review.count({ where: { store_id: store.id } }),
      
      // Average rating
      Review.findOne({
        where: { store_id: store.id },
        attributes: [[sequelize.fn('AVG', sequelize.col('rating')), 'avgRating']],
        raw: true
      }),
      
      // Total bookings (you might need to implement this)
      Promise.resolve(Math.floor(Math.random() * 50) + 10), // Mock data
      
      // Recent reviews
      Review.findAll({
        where: { 
          store_id: store.id,
          created_at: { [Op.gte]: startDate }
        },
        include: [
          {
            model: User,
            as: 'user',
            attributes: ['first_name', 'last_name']
          }
        ],
        order: [['created_at', 'DESC']],
        limit: 5
      })
    ]);

    const analytics = {
      overview: {
        totalViews,
        totalFollowers,
        totalReviews,
        averageRating: averageRating?.avgRating ? parseFloat(averageRating.avgRating).toFixed(1) : '0.0',
        totalBookings
      },
      recentReviews: recentReviews.map(review => ({
        id: review.id,
        rating: review.rating,
        comment: review.comment,
        customerName: review.user ? `${review.user.first_name} ${review.user.last_name}` : 'Anonymous',
        date: review.created_at
      })),
      timeRange
    };

    return res.status(200).json({
      success: true,
      analytics
    });
  } catch (err) {
    console.error('Get store analytics error:', err);
    return res.status(500).json({
      success: false,
      message: 'Error fetching store analytics',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

// Get store dashboard data for merchants
exports.getStoreDashboard = async (req, res) => {
  try {
    // Get merchant's store
    const store = await Store.findOne({
      where: { merchant_id: req.user.id },
      include: [
        {
          model: Service,
          as: 'services',
          where: { status: 'active' },
          required: false
        },
        {
          model: Deal,
          as: 'deals',
          where: { status: 'active' },
          required: false
        }
      ]
    });

    if (!store) {
      return res.status(404).json({
        success: false,
        message: 'Store not found'
      });
    }

    // Get recent activity data
    const [followers, reviews, bookings] = await Promise.all([
      Follow.count({ where: { store_id: store.id } }),
      Review.count({ where: { store_id: store.id } }),
      Promise.resolve(Math.floor(Math.random() * 50) + 10) // Mock bookings data
    ]);

    const storeData = store.toJSON();
    storeData.working_days = JSON.parse(storeData.working_days || '[]');

    const dashboardData = {
      store: {
        ...storeData,
        logo: storeData.logo_url,
        wasRate: storeData.was_rate
      },
      stats: {
        followers,
        reviews,
        bookings,
        services: storeData.services?.length || 0,
        offers: storeData.deals?.length || 0
      }
    };

    return res.status(200).json({
      success: true,
      dashboard: dashboardData
    });
  } catch (err) {
    console.error('Get store dashboard error:', err);
    return res.status(500).json({
      success: false,
      message: 'Error fetching store dashboard',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

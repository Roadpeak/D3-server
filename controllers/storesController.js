// Complete storesController.js with all required functions

const { Store, Service, Review, User, Merchant, Follow, sequelize } = require('../models');
// Note: Deal and Outlet models are missing, so we'll work without them for now

const jwt = require('jsonwebtoken');
const { Op } = require('sequelize');
const JWT_SECRET = process.env.JWT_SECRET;

// Test function to verify models are loaded correctly
const testModels = () => {
  console.log('🔍 Testing model availability:');
  console.log('Store model:', Store ? '✅ Available' : '❌ Missing');
  console.log('Merchant model:', Merchant ? '✅ Available' : '❌ Missing');
  console.log('Service model:', Service ? '✅ Available' : '❌ Missing');
  console.log('Review model:', Review ? '✅ Available' : '❌ Missing');
  console.log('User model:', User ? '✅ Available' : '❌ Missing');
  console.log('Follow model:', Follow ? '✅ Available' : '❌ Missing');
  console.log('Sequelize instance:', sequelize ? '✅ Available' : '❌ Missing');
};

// Call test function when controller loads
testModels();

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
      status = 'open',
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
      working_days: JSON.stringify(working_days),
      status: 'open',
      is_active: true,
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
      order: [['created_at', 'DESC']]
    });

    // Format stores data
    const formattedStores = stores.map(store => {
      const storeData = store.toJSON();
      try {
        storeData.working_days = JSON.parse(storeData.working_days || '[]');
      } catch (e) {
        storeData.working_days = [];
      }
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
    console.log('🔍 DEBUG: Starting getStores function');
    
    const {
      category,
      location,
      sortBy,
      page = 1,
      limit = 20
    } = req.query;

    // Build where clause for filtering
    const whereClause = { is_active: true };

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
    let orderClause = [['created_at', 'DESC']];

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
        orderClause = [['created_at', 'DESC']];
    }

    // Calculate pagination
    const offset = (page - 1) * limit;

    console.log('🔍 DEBUG: About to query stores...');

    const { count, rows: stores } = await Store.findAndCountAll({
      where: whereClause,
      order: orderClause,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    console.log('🔍 DEBUG: Found stores:', count);

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
    if (userId && Follow) {
      try {
        const followedStores = await Follow.findAll({
          where: { user_id: userId },
          attributes: ['store_id'],
        });
        followedStoreIds = new Set(followedStores.map(follow => follow.store_id));
      } catch (err) {
        console.log('Follow query failed:', err.message);
      }
    }

    // Format stores with follow status
    const storesWithFollowStatus = stores.map(store => {
      const storeData = store.toJSON();
      try {
        storeData.working_days = JSON.parse(storeData.working_days || '[]');
      } catch (e) {
        storeData.working_days = [];
      }
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
    console.log('🔍 DEBUG: Getting store by ID:', id);

    const store = await Store.findByPk(id);

    if (!store) {
      return res.status(404).json({ 
        success: false,
        message: 'Store not found' 
      });
    }

    console.log('🔍 DEBUG: Found store:', store.name);

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
    if (Follow) {
      try {
        followersCount = await Follow.count({
          where: { store_id: id }
        });

        if (userId) {
          const followedStore = await Follow.findOne({
            where: { user_id: userId, store_id: id },
          });
          following = !!followedStore;
        }
      } catch (err) {
        console.log('Follow operations failed:', err.message);
      }
    }

    // Get review stats
    let avgRating = store.rating || 0;
    let totalReviews = 0;
    let reviews = [];

    if (Review) {
      try {
        const reviewStats = await Review.findOne({
          where: { store_id: id },
          attributes: [
            [sequelize.fn('AVG', sequelize.col('rating')), 'avgRating'],
            [sequelize.fn('COUNT', sequelize.col('id')), 'totalReviews']
          ],
          raw: true
        });

        avgRating = reviewStats?.avgRating ? parseFloat(reviewStats.avgRating).toFixed(1) : store.rating || 0;
        totalReviews = reviewStats?.totalReviews || 0;

        // Get recent reviews
        const recentReviews = await Review.findAll({
          where: { store_id: id },
          include: User ? [
            {
              model: User,
              as: 'user',
              attributes: ['first_name', 'last_name']
            }
          ] : [],
          order: [['created_at', 'DESC']],
          limit: 10
        });

        reviews = recentReviews.map(review => ({
          id: review.id,
          name: review.user ? `${review.user.first_name} ${review.user.last_name.charAt(0)}.` : 'Anonymous',
          rating: review.rating,
          date: new Date(review.created_at).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
          }),
          comment: review.comment
        }));

      } catch (err) {
        console.log('Review operations failed:', err.message);
      }
    }

    const storeData = store.toJSON();
    try {
      storeData.working_days = JSON.parse(storeData.working_days || '[]');
    } catch (e) {
      storeData.working_days = [];
    }

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

      // Create a basic deal from store cashback info
      deals: [{
        id: 1,
        type: 'cashback',
        title: `${storeData.cashback} Cashback for Purchases at ${storeData.name}`,
        description: `${storeData.cashback} Base Cashback\nValid on all purchases\nNo minimum order value required`,
        discount: storeData.cashback,
        label: 'BACK',
        buttonText: 'Get Reward',
        expiryDate: null,
        code: null,
        terms: 'Cashback is not available if you fail to clean your shopping bag before clicking through to the retailer.'
      }],

      // Empty arrays for now - will be populated when Deal/Outlet models are available
      services: [],
      outlets: [],
      reviews: reviews
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
    try {
      storeData.working_days = JSON.parse(storeData.working_days || '[]');
    } catch (e) {
      storeData.working_days = [];
    }

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
      where: { is_active: true },
      order: sequelize.random(),
      limit: parseInt(limit)
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
    if (userId && Follow) {
      try {
        const followedStores = await Follow.findAll({
          where: { user_id: userId },
          attributes: ['store_id'],
        });
        followedStoreIds = new Set(followedStores.map(follow => follow.store_id));
      } catch (err) {
        console.log('Follow query failed:', err.message);
      }
    }

    // Format stores with follow status
    const storesWithFollowStatus = stores.map(store => {
      const storeData = store.toJSON();
      try {
        storeData.working_days = JSON.parse(storeData.working_days || '[]');
      } catch (e) {
        storeData.working_days = [];
      }
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
    console.log('🔄 Toggle follow called for store ID:', id);
    
    // The verifyToken middleware should have already set req.user
    if (!req.user) {
      console.log('❌ No user found in request');
      return res.status(401).json({ 
        success: false,
        message: 'Authentication required' 
      });
    }

    const userId = req.user.id || req.user.userId;
    const userType = req.user.userType || req.user.type;
    
    console.log('👤 User attempting to follow:', userId, 'Type:', userType);

    // Check if store exists and is active
    const store = await Store.findOne({
      where: { 
        id,
        is_active: true
      }
    });
    
    if (!store) {
      console.log('❌ Store not found:', id);
      return res.status(404).json({ 
        success: false,
        message: 'Store not found' 
      });
    }

    if (!Follow) {
      console.log('❌ Follow model not available');
      return res.status(500).json({ 
        success: false,
        message: 'Follow functionality not available' 
      });
    }

    // Check if user is already following the store
    const existingFollow = await Follow.findOne({
      where: { user_id: userId, store_id: id }
    });

    let following = false;
    let message = '';

    if (existingFollow) {
      // Unfollow
      await existingFollow.destroy();
      following = false;
      message = 'Store unfollowed successfully';
      console.log('📤 User unfollowed store');
    } else {
      // Follow
      await Follow.create({
        user_id: userId,
        store_id: id
      });
      following = true;
      message = 'Store followed successfully';
      console.log('📥 User followed store');
    }

    // Get updated followers count
    const followersCount = await Follow.count({
      where: { store_id: id }
    });

    console.log('✅ Follow toggle successful, new state:', following);

    return res.status(200).json({
      success: true,
      following,
      followers: followersCount,
      message
    });
    
  } catch (err) {
    console.error('💥 Toggle follow store error:', err);
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
    
    console.log('📝 Submit review called for store ID:', id);
    console.log('📝 Review data:', { rating, comment: comment?.substring(0, 50) + '...' });
    
    // The verifyToken middleware should have already set req.user
    if (!req.user) {
      console.log('❌ No user found in request');
      return res.status(401).json({ 
        success: false,
        message: 'Authentication required' 
      });
    }

    const userId = req.user.id || req.user.userId;
    const userType = req.user.userType || req.user.type;
    
    console.log('👤 User submitting review:', userId, 'Type:', userType);
    console.log('👤 User details:', {
      firstName: req.user.firstName,
      lastName: req.user.lastName,
      email: req.user.email
    });

    // Get user display name from req.user (set by verifyToken middleware)
    let userName = 'Anonymous';
    if (req.user.firstName && req.user.lastName) {
      userName = `${req.user.firstName} ${req.user.lastName.charAt(0)}.`;
    } else if (req.user.firstName) {
      userName = req.user.firstName;
    }
    
    console.log('👤 Display name will be:', userName);

    // Validate input
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
        is_active: true
      }
    });
    
    if (!store) {
      console.log('❌ Store not found:', id);
      return res.status(404).json({ 
        success: false,
        message: 'Store not found' 
      });
    }

    if (!Review) {
      console.log('❌ Review model not available');
      return res.status(500).json({ 
        success: false,
        message: 'Review functionality not available' 
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
      comment: comment.trim(),
    });

    console.log('✅ Review created successfully');

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

    console.log('✅ Store rating updated to:', avgRating);

    return res.status(201).json({
      success: true,
      message: 'Review submitted successfully',
      review: {
        id: newReview.id,
        rating: newReview.rating,
        comment: newReview.comment,
        name: userName, // Use the properly formatted name
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
    console.error('💥 Submit review error:', err);
    return res.status(500).json({ 
      success: false,
      message: 'Error submitting review',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

// Updated getStoreById to properly handle authentication for both users and merchants
exports.getStoreById = async (req, res) => {
  try {
    const { id } = req.params;
    console.log('🔍 DEBUG: Getting store by ID:', id);

    const store = await Store.findByPk(id);

    if (!store) {
      return res.status(404).json({ 
        success: false,
        message: 'Store not found' 
      });
    }

    console.log('🔍 DEBUG: Found store:', store.name);

    let userId = null;
    let userType = null;
    const token = req.headers['authorization']?.split(' ')[1];

    if (token) {
      try {
        const decoded = jwt.verify(token, JWT_SECRET);
        console.log('🔍 Decoded token in getStoreById:', decoded);
        
        // Handle both user and merchant tokens
        if (decoded.type === 'user' && decoded.userId) {
          userId = decoded.userId;
          userType = 'user';
        } else if (decoded.type === 'merchant' && decoded.id) {
          userId = decoded.id;
          userType = 'merchant';
        } else if (decoded.userId) {
          userId = decoded.userId;
          userType = 'user';
        } else if (decoded.id) {
          userId = decoded.id;
          userType = 'merchant';
        }
        
        console.log('👤 Authenticated user:', userId, 'Type:', userType);
      } catch (err) {
        console.error('Error verifying token:', err);
        userId = null;
        userType = null;
      }
    }

    let following = false;
    let followersCount = 0;

    // Get followers count and check if current user is following
    if (Follow) {
      try {
        followersCount = await Follow.count({
          where: { store_id: id }
        });

        if (userId) {
          const followedStore = await Follow.findOne({
            where: { user_id: userId, store_id: id },
          });
          following = !!followedStore;
        }
      } catch (err) {
        console.log('Follow operations failed:', err.message);
      }
    }

    // Get review stats and reviews
    let avgRating = store.rating || 0;
    let totalReviews = 0;
    let reviews = [];

    if (Review) {
      try {
        const reviewStats = await Review.findOne({
          where: { store_id: id },
          attributes: [
            [sequelize.fn('AVG', sequelize.col('rating')), 'avgRating'],
            [sequelize.fn('COUNT', sequelize.col('id')), 'totalReviews']
          ],
          raw: true
        });

        avgRating = reviewStats?.avgRating ? parseFloat(reviewStats.avgRating).toFixed(1) : store.rating || 0;
        totalReviews = reviewStats?.totalReviews || 0;

        // Get recent reviews with user info
        const recentReviews = await Review.findAll({
          where: { store_id: id },
          order: [['created_at', 'DESC']],
          limit: 10
        });

        // Format reviews with user names
        reviews = await Promise.all(recentReviews.map(async (review) => {
          let reviewerName = 'Anonymous';
          
          try {
            // Try to get user info (could be regular user or merchant)
            if (User) {
              const user = await User.findByPk(review.user_id);
              if (user) {
                reviewerName = `${user.first_name || user.firstName} ${(user.last_name || user.lastName)?.charAt(0) || ''}.`;
              }
            }
            
            // If not found in User, try Merchant
            if (reviewerName === 'Anonymous' && Merchant) {
              const merchant = await Merchant.findByPk(review.user_id);
              if (merchant) {
                reviewerName = `${merchant.firstName} ${merchant.lastName?.charAt(0) || ''}.`;
              }
            }
          } catch (err) {
            console.log('Error getting reviewer info:', err.message);
          }

          return {
            id: review.id,
            name: reviewerName,
            rating: review.rating,
            date: new Date(review.created_at).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric'
            }),
            comment: review.comment
          };
        }));

      } catch (err) {
        console.log('Review operations failed:', err.message);
      }
    }

    const storeData = store.toJSON();
    try {
      storeData.working_days = JSON.parse(storeData.working_days || '[]');
    } catch (e) {
      storeData.working_days = [];
    }

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

      // Create a basic deal from store cashback info
      deals: [{
        id: 1,
        type: 'cashback',
        title: `${storeData.cashback} Cashback for Purchases at ${storeData.name}`,
        description: `${storeData.cashback} Base Cashback\nValid on all purchases\nNo minimum order value required`,
        discount: storeData.cashback,
        label: 'BACK',
        buttonText: 'Get Reward',
        expiryDate: null,
        code: null,
        terms: 'Cashback is not available if you fail to clean your shopping bag before clicking through to the retailer.'
      }],

      // Empty arrays for now - will be populated when Deal/Outlet models are available
      services: [],
      outlets: [],
      reviews: reviews
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

exports.getCategories = async (req, res) => {
  try {
    const categories = await Store.findAll({
      attributes: [[sequelize.fn('DISTINCT', sequelize.col('category')), 'category']],
      where: {
        category: {
          [Op.not]: null
        },
        is_active: true
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
        is_active: true
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

    const [
      totalViews,
      totalFollowers,
      totalReviews,
      averageRating,
      totalBookings,
      recentReviews
    ] = await Promise.all([
      Promise.resolve(Math.floor(Math.random() * 1000) + 100), // Mock data
      Follow ? Follow.count({ where: { store_id: store.id } }) : 0,
      Review ? Review.count({ where: { store_id: store.id } }) : 0,
      Review ? Review.findOne({
        where: { store_id: store.id },
        attributes: [[sequelize.fn('AVG', sequelize.col('rating')), 'avgRating']],
        raw: true
      }) : { avgRating: 0 },
      Promise.resolve(Math.floor(Math.random() * 50) + 10), // Mock data
      Review ? Review.findAll({
        where: { 
          store_id: store.id,
          created_at: { [Op.gte]: startDate }
        },
        include: User ? [
          {
            model: User,
            as: 'user',
            attributes: ['first_name', 'last_name']
          }
        ] : [],
        order: [['created_at', 'DESC']],
        limit: 5
      }) : []
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
    const store = await Store.findOne({
      where: { merchant_id: req.user.id }
    });

    if (!store) {
      return res.status(404).json({
        success: false,
        message: 'Store not found'
      });
    }

    // Get recent activity data
    const [followers, reviews, bookings] = await Promise.all([
      Follow ? Follow.count({ where: { store_id: store.id } }) : 0,
      Review ? Review.count({ where: { store_id: store.id } }) : 0,
      Promise.resolve(Math.floor(Math.random() * 50) + 10) // Mock bookings data
    ]);

    const storeData = store.toJSON();
    try {
      storeData.working_days = JSON.parse(storeData.working_days || '[]');
    } catch (e) {
      storeData.working_days = [];
    }

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
        services: 0, // Will be populated when Service model associations are working
        offers: 1 // At least one default cashback offer
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
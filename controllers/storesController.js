// Complete storesController.js with all required functions

const { Store, Service, Review, User, Merchant, Follow, Social, sequelize } = require('../models');
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
      order: [['createdAt', 'DESC']] // Use 'createdAt' instead of 'created_at'
    });

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
      limit = 20,
      search
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

    // Add search functionality
    if (search) {
      whereClause[Op.or] = [
        { name: { [Op.like]: `%${search}%` } },
        { description: { [Op.like]: `%${search}%` } },
        { category: { [Op.like]: `%${search}%` } },
        { location: { [Op.like]: `%${search}%` } }
      ];
    }

    // UPDATED: Build order clause with new "Most Reviewed" option
    let orderClause = [['createdAt', 'DESC']];

    switch (sortBy) {
      case 'Popular':
        orderClause = [['rating', 'DESC']];
        break;
      case 'Most Reviewed':
        // ADDED: Sort by review count (subquery to count reviews)
        orderClause = [
          [
            sequelize.literal(`(
              SELECT COUNT(*) 
              FROM Reviews 
              WHERE Reviews.store_id = Store.id
            )`), 
            'DESC'
          ],
          ['rating', 'DESC'] // Secondary sort by rating
        ];
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
        orderClause = [['createdAt', 'DESC']];
    }

    // Calculate pagination
    const offset = (page - 1) * limit;

    console.log('🔍 DEBUG: About to query stores with sort:', sortBy);

    // UPDATED: Query with review count as virtual field for Most Reviewed sorting
    const queryOptions = {
      where: whereClause,
      order: orderClause,
      limit: parseInt(limit),
      offset: parseInt(offset)
    };

    // Add review count as virtual attribute when sorting by Most Reviewed
    if (sortBy === 'Most Reviewed') {
      queryOptions.attributes = {
        include: [
          [
            sequelize.literal(`(
              SELECT COUNT(*) 
              FROM Reviews 
              WHERE Reviews.store_id = Store.id
            )`),
            'reviewCount'
          ]
        ]
      };
    }

    const { count, rows: stores } = await Store.findAndCountAll(queryOptions);

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

    // UPDATED: Format stores with review counts and follow status
    const storesWithData = await Promise.all(stores.map(async (store) => {
      const storeData = store.toJSON();
      try {
        storeData.working_days = JSON.parse(storeData.working_days || '[]');
      } catch (e) {
        storeData.working_days = [];
      }

      // Get actual review count and stats for each store
      let totalReviews = 0;
      let avgRating = storeData.rating || 0;

      if (Review) {
        try {
          const reviewStats = await Review.findOne({
            where: { store_id: store.id },
            attributes: [
              [sequelize.fn('COUNT', sequelize.col('id')), 'totalReviews'],
              [sequelize.fn('AVG', sequelize.col('rating')), 'avgRating']
            ],
            raw: true
          });

          totalReviews = reviewStats?.totalReviews || 0;
          avgRating = reviewStats?.avgRating ? 
            parseFloat(reviewStats.avgRating).toFixed(1) : 
            (storeData.rating || 0);
        } catch (err) {
          console.log('Review stats query failed for store', store.id, ':', err.message);
        }
      }

      return {
        ...storeData,
        following: followedStoreIds.has(store.id),
        logo: storeData.logo_url,
        wasRate: storeData.was_rate,
        totalReviews: parseInt(totalReviews),
        reviews: parseInt(totalReviews), // Alias for frontend compatibility
        rating: parseFloat(avgRating),
        reviewCount: storeData.reviewCount || totalReviews // From virtual attribute or calculated
      };
    }));

    return res.status(200).json({
      success: true,
      stores: storesWithData,
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

// Updated getStoreById function for your storesController.js
exports.getStoreById = async (req, res) => {
  try {
    const { id } = req.params;
    console.log('🔍 DEBUG: Getting store by ID:', id);

    // First, get the store
    const store = await Store.findByPk(id);

    if (!store) {
      return res.status(404).json({ 
        success: false,
        message: 'Store not found' 
      });
    }

    console.log('🔍 DEBUG: Found store:', store.name);

    // FIXED: Get social links (using the working method from earlier)
    let socialLinks = [];
    try {
      if (Social) {
        socialLinks = await Social.findAll({
          where: { store_id: id },
          attributes: ['id', 'platform', 'link', 'created_at'],
          order: [['created_at', 'ASC']],
          raw: true
        });
        console.log('📱 DEBUG: Fetched social links:', socialLinks.length);
      }
    } catch (socialError) {
      console.log('⚠️ Could not fetch social links:', socialError.message);
      socialLinks = [];
    }

    // Get authentication info
    let userId = null;
    let userType = null;
    const token = req.headers['authorization']?.split(' ')[1];

    if (token) {
      try {
        const decoded = jwt.verify(token, JWT_SECRET);
        console.log('🔍 Decoded token in getStoreById:', decoded);
        
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

    // Get follow status and followers count
    let following = false;
    let followersCount = 0;

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

    // FIXED: Enhanced review fetching with proper error handling and formatting
    let avgRating = store.rating || 0;
    let totalReviews = 0;
    let reviews = [];

    if (Review) {
      try {
        console.log('📝 DEBUG: Fetching reviews for store:', id);

        // Get review statistics
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

        console.log('📊 Review stats:', { avgRating, totalReviews });

        // FIXED: Get reviews with proper user information and error handling
        let reviewsData = [];
        
        try {
          // Try with User association first
          reviewsData = await Review.findAll({
            where: { store_id: id },
            order: [['created_at', 'DESC']],
            limit: 10,
            include: [
              {
                model: User,
                as: 'user',
                attributes: ['id', 'first_name', 'last_name', 'firstName', 'lastName', 'email'],
                required: false
              }
            ]
          });
          console.log('📝 Reviews with User association:', reviewsData.length);
        } catch (associationError) {
          console.log('⚠️ User association failed, trying without:', associationError.message);
          
          // Fallback: get reviews without user association
          reviewsData = await Review.findAll({
            where: { store_id: id },
            order: [['created_at', 'DESC']],
            limit: 10,
            raw: true
          });
          console.log('📝 Reviews without association:', reviewsData.length);
        }

        // FIXED: Format reviews with enhanced user name resolution
        reviews = await Promise.all(reviewsData.map(async (review) => {
          let reviewData = review.toJSON ? review.toJSON() : review;
          let reviewerName = 'Anonymous Customer';
          
          try {
            // Method 1: From included User association
            if (reviewData.user) {
              const firstName = reviewData.user.first_name || reviewData.user.firstName;
              const lastName = reviewData.user.last_name || reviewData.user.lastName;
              if (firstName) {
                reviewerName = `${firstName} ${lastName?.charAt(0) || ''}.`;
              }
              console.log('👤 Review user from association:', reviewerName);
            } 
            // Method 2: Direct user lookup if no association
            else if (reviewData.user_id && User) {
              const user = await User.findByPk(reviewData.user_id, {
                attributes: ['first_name', 'last_name', 'firstName', 'lastName']
              });
              
              if (user) {
                const userData = user.toJSON();
                const firstName = userData.first_name || userData.firstName;
                const lastName = userData.last_name || userData.lastName;
                if (firstName) {
                  reviewerName = `${firstName} ${lastName?.charAt(0) || ''}.`;
                }
                console.log('👤 Review user from direct lookup:', reviewerName);
              }
            }
            // Method 3: Try Merchant table if User lookup failed
            else if (reviewData.user_id && Merchant && reviewerName === 'Anonymous Customer') {
              const merchant = await Merchant.findByPk(reviewData.user_id, {
                attributes: ['firstName', 'lastName', 'first_name', 'last_name']
              });
              
              if (merchant) {
                const merchantData = merchant.toJSON();
                const firstName = merchantData.firstName || merchantData.first_name;
                const lastName = merchantData.lastName || merchantData.last_name;
                if (firstName) {
                  reviewerName = `${firstName} ${lastName?.charAt(0) || ''}.`;
                }
                console.log('👤 Review user from merchant lookup:', reviewerName);
              }
            }
          } catch (userLookupError) {
            console.log('⚠️ User lookup failed for review:', userLookupError.message);
          }

          // FIXED: Return properly formatted review object
          return {
            id: reviewData.id,
            name: reviewerName,
            customerName: reviewerName,
            rating: reviewData.rating,
            comment: reviewData.text || reviewData.comment,
            text: reviewData.text || reviewData.comment,
            date: new Date(reviewData.created_at || reviewData.createdAt).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric'
            }),
            createdAt: reviewData.created_at || reviewData.createdAt,
            created_at: reviewData.created_at || reviewData.createdAt,
            user_id: reviewData.user_id
          };
        }));

        console.log('📝 Final formatted reviews:', reviews.length);

      } catch (reviewError) {
        console.error('📝 Review operations failed:', reviewError);
        reviews = [];
        totalReviews = 0;
      }
    }

    // Format store data
    const storeData = store.toJSON();
    try {
      storeData.working_days = JSON.parse(storeData.working_days || '[]');
    } catch (e) {
      storeData.working_days = [];
    }

    // Format social links
    const socialLinksFormatted = {};
    if (socialLinks && socialLinks.length > 0) {
      socialLinks.forEach(social => {
        socialLinksFormatted[social.platform] = social.link;
      });
    }

    // FIXED: Build complete response with all data properly included
    const responseData = {
      ...storeData,
      following,
      followers: followersCount,
      totalReviews: parseInt(totalReviews),
      rating: parseFloat(avgRating),
      logo: storeData.logo_url,
      wasRate: storeData.was_rate,

      // CRITICAL: Include the reviews array
      reviews: reviews,

      // Social links
      socialLinksRaw: socialLinks.map(social => ({
        id: social.id,
        platform: social.platform,
        link: social.link,
        created_at: social.created_at
      })),

      socialLinks: {
        facebook: socialLinksFormatted.facebook || null,
        twitter: socialLinksFormatted.twitter || null,
        instagram: socialLinksFormatted.instagram || null,
        linkedin: socialLinksFormatted.linkedin || null,
        youtube: socialLinksFormatted.youtube || null,
        tiktok: socialLinksFormatted.tiktok || null,
        pinterest: socialLinksFormatted.pinterest || null,
        snapchat: socialLinksFormatted.snapchat || null,
        whatsapp: socialLinksFormatted.whatsapp || null,
        discord: socialLinksFormatted.discord || null,
        tumblr: socialLinksFormatted.tumblr || null,
        reddit: socialLinksFormatted.reddit || null,
        vimeo: socialLinksFormatted.vimeo || null,
        github: socialLinksFormatted.github || null,
        flickr: socialLinksFormatted.flickr || null,
        website: storeData.website_url || null,
        ...socialLinksFormatted
      },

      // Deals and services
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

      services: [],
      outlets: []
    };

    console.log('🎯 FINAL DEBUG: Complete response structure:', {
      hasReviews: !!(responseData.reviews && responseData.reviews.length > 0),
      reviewsCount: responseData.reviews?.length || 0,
      totalReviews: responseData.totalReviews,
      rating: responseData.rating,
      socialLinksRawCount: responseData.socialLinksRaw.length,
      socialLinksKeys: Object.keys(responseData.socialLinks).filter(key => responseData.socialLinks[key])
    });

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

exports.getFollowedStores = async (req, res) => {
  try {
    console.log('📋 Getting followed stores for user:', req.user.id || req.user.userId);
    
    // Get user ID from token (handle both user types)
    const userId = req.user.id || req.user.userId;
    const userType = req.user.userType || req.user.type;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User authentication required'
      });
    }

    if (!Follow) {
      console.log('❌ Follow model not available');
      return res.status(500).json({
        success: false,
        message: 'Follow functionality not available'
      });
    }

    // Get all store IDs that this user is following
    const followedStoreIds = await Follow.findAll({
      where: { user_id: userId },
      attributes: ['store_id'],
      raw: true
    });

    console.log(`📊 User follows ${followedStoreIds.length} stores`);

    if (followedStoreIds.length === 0) {
      return res.status(200).json({
        success: true,
        followedStores: [],
        message: 'No followed stores found'
      });
    }

    // Extract store IDs
    const storeIds = followedStoreIds.map(follow => follow.store_id);

    // Get store details for followed stores
    const stores = await Store.findAll({
      where: {
        id: storeIds,
        is_active: true // Only return active stores
      },
      order: [['name', 'ASC']] // Sort alphabetically
    });

    console.log(`📋 Found ${stores.length} active followed stores`);

    // Format stores with follow status and additional data
    const formattedStores = await Promise.all(stores.map(async (store) => {
      const storeData = store.toJSON();
      
      try {
        storeData.working_days = JSON.parse(storeData.working_days || '[]');
      } catch (e) {
        storeData.working_days = [];
      }

      // Get followers count
      let followersCount = 0;
      try {
        followersCount = await Follow.count({
          where: { store_id: store.id }
        });
      } catch (err) {
        console.log(`⚠️ Could not get followers count for store ${store.id}:`, err.message);
      }

      // Get review count and average rating
      let reviewCount = 0;
      let averageRating = storeData.rating || 0;
      
      if (Review) {
        try {
          const reviewStats = await Review.findOne({
            where: { store_id: store.id },
            attributes: [
              [sequelize.fn('COUNT', sequelize.col('id')), 'totalReviews'],
              [sequelize.fn('AVG', sequelize.col('rating')), 'avgRating']
            ],
            raw: true
          });

          reviewCount = reviewStats?.totalReviews || 0;
          averageRating = reviewStats?.avgRating ? 
            parseFloat(reviewStats.avgRating).toFixed(1) : 
            storeData.rating || 0;
        } catch (err) {
          console.log(`⚠️ Could not get review stats for store ${store.id}:`, err.message);
        }
      }

      return {
        ...storeData,
        // Standard formatting
        logo: storeData.logo_url,
        wasRate: storeData.was_rate,
        following: true, // Always true since these are followed stores
        
        // Additional stats
        followers: followersCount,
        followerCount: followersCount,
        reviewCount: parseInt(reviewCount),
        totalReviews: parseInt(reviewCount),
        rating: parseFloat(averageRating),
        
        // Dates for sorting
        followedAt: new Date(), // You might want to get actual follow date from Follow table
        createdAt: storeData.createdAt || storeData.created_at,
        updatedAt: storeData.updatedAt || storeData.updated_at
      };
    }));

    console.log('✅ Successfully formatted followed stores');

    return res.status(200).json({
      success: true,
      followedStores: formattedStores,
      total: formattedStores.length,
      message: `Found ${formattedStores.length} followed stores`
    });

  } catch (err) {
    console.error('💥 Get followed stores error:', err);
    return res.status(500).json({
      success: false,
      message: 'Error fetching followed stores',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

exports.submitReview = async (req, res) => {
  try {
    const { id } = req.params; // Store ID from URL params
    const { rating, comment, text } = req.body;
    
    console.log('📝 Submit review called for store ID:', id);
    console.log('📝 Review data:', { rating, comment: (comment || text)?.substring(0, 50) + '...' });
    
    // Check authentication
    if (!req.user) {
      console.log('❌ No user found in request');
      return res.status(401).json({ 
        success: false,
        message: 'Authentication required to submit a review' 
      });
    }

    const userId = req.user.id || req.user.userId;
    const userType = req.user.userType || req.user.type;
    
    console.log('👤 User submitting review:', userId, 'Type:', userType);
    console.log('👤 User details:', {
      firstName: req.user.firstName,
      lastName: req.user.lastName,
      first_name: req.user.first_name,
      last_name: req.user.last_name,
      email: req.user.email
    });

    // Get user display name with multiple field support
    let userName = 'Anonymous Customer';
    const firstNameCandidates = [
      req.user.firstName, 
      req.user.first_name, 
      req.user.fname
    ].filter(Boolean);
    
    const lastNameCandidates = [
      req.user.lastName, 
      req.user.last_name, 
      req.user.lname
    ].filter(Boolean);

    const firstName = firstNameCandidates[0];
    const lastName = lastNameCandidates[0];

    if (firstName) {
      userName = lastName ? `${firstName} ${lastName.charAt(0)}.` : firstName;
    }
    
    console.log('👤 Display name will be:', userName);

    // Validate input
    if (!rating || (!comment && !text)) {
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
        message: 'You have already reviewed this store. Each customer can only submit one review per store.' 
      });
    }

    // FIXED: Create new review with proper field mapping
    const reviewText = comment || text || '';
    
    const newReview = await Review.create({
      user_id: userId,
      store_id: id,
      rating: parseInt(rating),
      text: reviewText.trim(), // Use 'text' field as per your model
    });

    console.log('✅ Review created successfully with ID:', newReview.id);

    // FIXED: Update store's average rating
    const updatedReviewStats = await Review.findOne({
      where: { store_id: id },
      attributes: [
        [sequelize.fn('AVG', sequelize.col('rating')), 'avgRating'],
        [sequelize.fn('COUNT', sequelize.col('id')), 'totalReviews']
      ],
      raw: true
    });

    const newAvgRating = updatedReviewStats?.avgRating ? parseFloat(updatedReviewStats.avgRating).toFixed(1) : rating;
    const newTotalReviews = updatedReviewStats?.totalReviews || 1;

    // Update store rating in database
    await store.update({ rating: newAvgRating });

    console.log('✅ Store rating updated to:', newAvgRating);

    // FIXED: Return properly formatted response
    return res.status(201).json({
      success: true,
      message: 'Review submitted successfully',
      review: {
        id: newReview.id,
        rating: newReview.rating,
        text: newReview.text,
        comment: newReview.text, // Alias for frontend compatibility
        name: userName,
        customerName: userName,
        date: new Date(newReview.createdAt).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric'
        }),
        createdAt: newReview.createdAt,
        created_at: newReview.createdAt
      },
      storeRating: parseFloat(newAvgRating),
      totalReviews: parseInt(newTotalReviews)
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

// controllers/storesController.js - ADD these methods to your existing controller

// Update store information (which serves as main branch)
exports.updateStoreProfile = async (req, res) => {
  try {
    const { storeId } = req.params;
    const merchantId = req.user.id;
    const updateData = req.body;

    console.log('🏪 Updating store (main branch info):', storeId, updateData);

    // Verify store belongs to merchant
    const store = await Store.findOne({
      where: {
        id: storeId,
        merchant_id: merchantId
      }
    });

    if (!store) {
      return res.status(404).json({
        success: false,
        message: 'Store not found or access denied'
      });
    }

    // Validate update data - INCLUDING logo_url
    const allowedFields = [
      'name', 
      'location', 
      'phone_number', 
      'primary_email', 
      'description',
      'opening_time',
      'closing_time',
      'working_days',
      'website_url',
      'logo_url'  // ADD THIS for logo updates
    ];

    const filteredData = {};
    Object.keys(updateData).forEach(key => {
      if (allowedFields.includes(key)) {
        filteredData[key] = updateData[key];
      }
    });

    // Handle working_days array
    if (filteredData.working_days && Array.isArray(filteredData.working_days)) {
      filteredData.working_days = JSON.stringify(filteredData.working_days);
    }

    // Validate email if it's being updated
    if (filteredData.primary_email && filteredData.primary_email !== store.primary_email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(filteredData.primary_email)) {
        return res.status(400).json({ 
          success: false,
          message: 'Invalid email format' 
        });
      }

      const existingEmailStore = await Store.findOne({ 
        where: { 
          primary_email: filteredData.primary_email,
          id: { [Op.ne]: storeId }
        } 
      });
      if (existingEmailStore) {
        return res.status(400).json({ 
          success: false,
          message: 'A store with this primary email already exists' 
        });
      }
    }

    // Update the store
    await store.update({
      ...filteredData,
      updated_at: new Date()
    });

    // FIXED: Fetch updated store WITHOUT problematic include
    const updatedStore = await Store.findByPk(storeId);

    const storeData = updatedStore.toJSON();
    try {
      storeData.working_days = JSON.parse(storeData.working_days || '[]');
    } catch (e) {
      storeData.working_days = [];
    }

    console.log('✅ Store updated successfully (main branch info updated)');

    return res.status(200).json({
      success: true,
      message: 'Store information updated successfully. Main branch details have been updated.',
      store: {
        ...storeData,
        logo: storeData.logo_url,
        wasRate: storeData.was_rate
      }
    });

  } catch (error) {
    console.error('Update store error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error updating store information',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Get store details (for main branch info)
exports.getStoreProfile = async (req, res) => {
  try {
    const { storeId } = req.params;
    const merchantId = req.user.id;

    console.log('📋 Fetching store details:', storeId);

    const store = await Store.findOne({
      where: {
        id: storeId,
        merchant_id: merchantId
      },
      include: [
        {
          model: Merchant,
          attributes: ['id', 'first_name', 'last_name', 'email_address', 'phone_number']
        }
      ]
    });

    if (!store) {
      return res.status(404).json({
        success: false,
        message: 'Store not found or access denied'
      });
    }

    const storeData = store.toJSON();
    try {
      storeData.working_days = JSON.parse(storeData.working_days || '[]');
    } catch (e) {
      storeData.working_days = [];
    }

    return res.status(200).json({
      success: true,
      store: {
        ...storeData,
        logo: storeData.logo_url,
        wasRate: storeData.was_rate
      },
      mainBranchInfo: {
        id: `store-${store.id}`,
        name: `${store.name} - Main Branch`,
        address: store.location,
        phone: store.phone_number,
        email: store.primary_email,
        status: store.status || 'Active',
        openingTime: store.opening_time,
        closingTime: store.closing_time,
        workingDays: storeData.working_days,
        description: store.description,
        isMainBranch: true,
        isStoreMainBranch: true
      }
    });

  } catch (error) {
    console.error('Get store error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error fetching store information',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Update merchant profile (personal info only)
exports.updateMerchantProfile = async (req, res) => {
  try {
    const merchantId = req.user.id;
    const updateData = req.body;

    console.log('👤 Updating merchant profile:', merchantId, updateData);

    const merchant = await Merchant.findByPk(merchantId);

    if (!merchant) {
      return res.status(404).json({
        success: false,
        message: 'Merchant not found'
      });
    }

    // Validate update data
    const allowedFields = [
      'first_name',
      'last_name', 
      'email_address',
      'phone_number'
    ];

    const filteredData = {};
    Object.keys(updateData).forEach(key => {
      if (allowedFields.includes(key)) {
        filteredData[key] = updateData[key];
      }
    });

    // Validate email if it's being updated
    if (filteredData.email_address && filteredData.email_address !== merchant.email_address) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(filteredData.email_address)) {
        return res.status(400).json({ 
          success: false,
          message: 'Invalid email format' 
        });
      }

      const existingMerchant = await Merchant.findOne({ 
        where: { 
          email_address: filteredData.email_address,
          id: { [Op.ne]: merchantId }
        } 
      });
      if (existingMerchant) {
        return res.status(400).json({ 
          success: false,
          message: 'A merchant with this email already exists' 
        });
      }
    }

    // Update the merchant
    await merchant.update({
      ...filteredData,
      updated_at: new Date()
    });

    // Fetch updated merchant with store info
    const updatedMerchant = await Merchant.findByPk(merchantId, {
      include: [
        {
          model: Store,
          as: 'store',
          attributes: ['id', 'name', 'location', 'phone_number', 'primary_email']
        }
      ]
    });

    console.log('✅ Merchant profile updated successfully');

    return res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      merchantProfile: updatedMerchant
    });

  } catch (error) {
    console.error('Update merchant profile error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error updating profile',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};
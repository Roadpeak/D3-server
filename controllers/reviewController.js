// reviewController.js - Enhanced version with merchant store review fetching

const { Review, User, Store, Merchant, sequelize } = require('../models');
const jwt = require('jsonwebtoken');
const { Op } = require('sequelize');
const JWT_SECRET = process.env.JWT_SECRET;

// Create a new review (customers submit reviews on store page)
exports.createReview = async (req, res) => {
  try {
    const { store_id, rating, text, comment } = req.body;
    
    console.log('📝 Creating review:', { store_id, rating, text: text?.substring(0, 50) });
    
    // Validate required fields
    if (!store_id || !rating) {
      return res.status(400).json({
        success: false,
        message: 'Store ID and rating are required'
      });
    }

    if (rating < 1 || rating > 5) {
      return res.status(400).json({
        success: false,
        message: 'Rating must be between 1 and 5'
      });
    }

    // Check if store exists
    const store = await Store.findByPk(store_id);
    if (!store) {
      return res.status(404).json({
        success: false,
        message: 'Store not found'
      });
    }

    // Get user ID from token
    let userId = null;
    if (req.user) {
      userId = req.user.id || req.user.userId;
    }

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required to submit a review'
      });
    }

    // Check if user already reviewed this store
    const existingReview = await Review.findOne({
      where: { user_id: userId, store_id }
    });

    if (existingReview) {
      return res.status(400).json({
        success: false,
        message: 'You have already reviewed this store'
      });
    }

    // Create the review
    const newReview = await Review.create({
      store_id,
      user_id: userId,
      rating: parseInt(rating),
      text: text || comment || null, // Handle both field names
    });

    // Get user info for response
    let userName = 'Anonymous';
    try {
      if (User) {
        const user = await User.findByPk(userId);
        if (user) {
          userName = `${user.first_name || user.firstName} ${(user.last_name || user.lastName)?.charAt(0) || ''}.`;
        }
      }
    } catch (err) {
      console.log('Error getting user info:', err.message);
    }

    // Update store's average rating
    const reviewStats = await Review.findOne({
      where: { store_id },
      attributes: [
        [sequelize.fn('AVG', sequelize.col('rating')), 'avgRating'],
        [sequelize.fn('COUNT', sequelize.col('id')), 'totalReviews']
      ],
      raw: true
    });

    const avgRating = reviewStats?.avgRating ? parseFloat(reviewStats.avgRating).toFixed(1) : rating;
    
    // Update store rating
    await store.update({ rating: avgRating });

    console.log('✅ Review created successfully');

    return res.status(201).json({
      success: true,
      message: 'Review submitted successfully',
      review: {
        id: newReview.id,
        rating: newReview.rating,
        text: newReview.text,
        customerName: userName,
        createdAt: newReview.createdAt,
        created_at: newReview.createdAt
      },
      storeRating: parseFloat(avgRating),
      totalReviews: parseInt(reviewStats?.totalReviews || 1)
    });

  } catch (error) {
    console.error('Create review error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error creating review',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Get reviews for a specific store (for merchant dashboard and public store view)
exports.getReviewsByStore = async (req, res) => {
  try {
    const { store_id } = req.params;
    const { page = 1, limit = 10, rating = null, sortBy = 'newest' } = req.query;
    
    console.log('📖 Fetching reviews for store:', store_id);
    console.log('📖 Query params:', { page, limit, rating, sortBy });

    // Check if store exists
    const store = await Store.findByPk(store_id);
    if (!store) {
      return res.status(404).json({
        success: false,
        message: 'Store not found'
      });
    }

    // Build where clause
    const whereClause = { store_id };
    if (rating && rating !== 'all') {
      whereClause.rating = parseInt(rating);
    }

    // Build order clause
    let orderClause = [['created_at', 'DESC']]; // Default: newest first
    
    switch (sortBy) {
      case 'oldest':
        orderClause = [['created_at', 'ASC']];
        break;
      case 'highest':
        orderClause = [['rating', 'DESC'], ['created_at', 'DESC']];
        break;
      case 'lowest':
        orderClause = [['rating', 'ASC'], ['created_at', 'DESC']];
        break;
      default:
        orderClause = [['created_at', 'DESC']];
    }

    // Calculate pagination
    const offset = (page - 1) * limit;

    // Get reviews with user information
    const { count, rows: reviewsData } = await Review.findAndCountAll({
      where: whereClause,
      order: orderClause,
      limit: parseInt(limit),
      offset: parseInt(offset),
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'first_name', 'last_name', 'firstName', 'lastName'],
          required: false
        }
      ]
    });

    console.log('📖 Found reviews:', count);

    // Format reviews with customer names
    const formattedReviews = reviewsData.map(review => {
      const reviewData = review.toJSON();
      
      // Get customer name from associated user
      let customerName = 'Anonymous Customer';
      if (reviewData.user) {
        const firstName = reviewData.user.first_name || reviewData.user.firstName;
        const lastName = reviewData.user.last_name || reviewData.user.lastName;
        if (firstName) {
          customerName = `${firstName} ${lastName?.charAt(0) || ''}.`;
        }
      }

      return {
        id: reviewData.id,
        rating: reviewData.rating,
        text: reviewData.text,
        comment: reviewData.text, // Alias for compatibility
        customerName,
        name: customerName, // Alias for compatibility
        User: reviewData.user, // Keep original structure
        user: reviewData.user,
        createdAt: reviewData.createdAt,
        created_at: reviewData.createdAt,
        date: new Date(reviewData.createdAt).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric'
        })
      };
    });

    // Calculate review statistics
    const allReviews = await Review.findAll({
      where: { store_id },
      attributes: ['rating'],
      raw: true
    });

    const stats = {
      totalReviews: count,
      averageRating: allReviews.length > 0 
        ? Math.round((allReviews.reduce((sum, r) => sum + r.rating, 0) / allReviews.length) * 10) / 10
        : 0,
      ratingDistribution: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 }
    };

    // Calculate rating distribution
    allReviews.forEach(review => {
      if (stats.ratingDistribution[review.rating] !== undefined) {
        stats.ratingDistribution[review.rating]++;
      }
    });

    return res.status(200).json({
      success: true,
      reviews: formattedReviews,
      stats,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(count / limit),
        totalItems: count,
        hasNextPage: offset + reviewsData.length < count,
        hasPrevPage: page > 1
      }
    });

  } catch (error) {
    console.error('Get reviews by store error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error fetching reviews',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Get a single review by ID
exports.getReviewById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const review = await Review.findByPk(id, {
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'first_name', 'last_name', 'firstName', 'lastName']
        },
        {
          model: Store,
          as: 'store',
          attributes: ['id', 'name', 'logo_url']
        }
      ]
    });

    if (!review) {
      return res.status(404).json({
        success: false,
        message: 'Review not found'
      });
    }

    const reviewData = review.toJSON();
    
    // Format customer name
    let customerName = 'Anonymous Customer';
    if (reviewData.user) {
      const firstName = reviewData.user.first_name || reviewData.user.firstName;
      const lastName = reviewData.user.last_name || reviewData.user.lastName;
      if (firstName) {
        customerName = `${firstName} ${lastName?.charAt(0) || ''}.`;
      }
    }

    const formattedReview = {
      ...reviewData,
      customerName,
      name: customerName
    };

    return res.status(200).json({
      success: true,
      review: formattedReview
    });

  } catch (error) {
    console.error('Get review by ID error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error fetching review',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Update review (only by the original reviewer)
exports.updateReview = async (req, res) => {
  try {
    const { id } = req.params;
    const { rating, text, comment } = req.body;
    
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    const userId = req.user.id || req.user.userId;

    const review = await Review.findOne({
      where: { 
        id,
        user_id: userId 
      }
    });

    if (!review) {
      return res.status(404).json({
        success: false,
        message: 'Review not found or access denied'
      });
    }

    // Validate rating if provided
    if (rating && (rating < 1 || rating > 5)) {
      return res.status(400).json({
        success: false,
        message: 'Rating must be between 1 and 5'
      });
    }

    // Update the review
    const updateData = {};
    if (rating) updateData.rating = parseInt(rating);
    if (text || comment) updateData.text = text || comment;

    const updatedReview = await review.update(updateData);

    // Recalculate store rating if rating was updated
    if (rating) {
      const reviewStats = await Review.findOne({
        where: { store_id: review.store_id },
        attributes: [
          [sequelize.fn('AVG', sequelize.col('rating')), 'avgRating']
        ],
        raw: true
      });

      const avgRating = reviewStats?.avgRating ? parseFloat(reviewStats.avgRating).toFixed(1) : rating;
      
      // Update store rating
      await Store.update(
        { rating: avgRating },
        { where: { id: review.store_id } }
      );
    }

    return res.status(200).json({
      success: true,
      message: 'Review updated successfully',
      review: updatedReview
    });

  } catch (error) {
    console.error('Update review error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error updating review',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Delete review (only by the original reviewer or store owner)
exports.deleteReview = async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    const userId = req.user.id || req.user.userId;
    const userType = req.user.userType || req.user.type;

    // Find the review with store info
    const review = await Review.findByPk(id, {
      include: [
        {
          model: Store,
          as: 'store',
          attributes: ['id', 'merchant_id']
        }
      ]
    });

    if (!review) {
      return res.status(404).json({
        success: false,
        message: 'Review not found'
      });
    }

    // Check permissions: either the reviewer or the store owner can delete
    const canDelete = 
      review.user_id === userId || // Original reviewer
      (userType === 'merchant' && review.store?.merchant_id === userId); // Store owner

    if (!canDelete) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only delete your own reviews or reviews for your store.'
      });
    }

    const storeId = review.store_id;
    
    // Delete the review
    await review.destroy();

    // Recalculate store rating
    const reviewStats = await Review.findOne({
      where: { store_id: storeId },
      attributes: [
        [sequelize.fn('AVG', sequelize.col('rating')), 'avgRating'],
        [sequelize.fn('COUNT', sequelize.col('id')), 'totalReviews']
      ],
      raw: true
    });

    const avgRating = reviewStats?.avgRating ? parseFloat(reviewStats.avgRating).toFixed(1) : 0;
    
    // Update store rating
    await Store.update(
      { rating: avgRating },
      { where: { id: storeId } }
    );

    return res.status(200).json({
      success: true,
      message: 'Review deleted successfully',
      newStoreRating: parseFloat(avgRating),
      totalReviews: parseInt(reviewStats?.totalReviews || 0)
    });

  } catch (error) {
    console.error('Delete review error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error deleting review',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// ENHANCED: Get reviews by store (with better formatting and authentication handling)
exports.getReviewsByStore = async (req, res) => {
  try {
    const { store_id } = req.params;
    const { page = 1, limit = 20, rating = null, sortBy = 'newest' } = req.query;
    
    console.log('📖 Enhanced: Fetching reviews for store:', store_id);
    console.log('📖 Query params:', { page, limit, rating, sortBy });

    // Check if store exists
    const store = await Store.findByPk(store_id);
    if (!store) {
      return res.status(404).json({
        success: false,
        message: 'Store not found'
      });
    }

    // Build where clause for filtering
    const whereClause = { store_id };
    if (rating && rating !== 'all') {
      whereClause.rating = parseInt(rating);
    }

    // Build order clause for sorting
    let orderClause = [['created_at', 'DESC']]; // Default: newest first
    
    switch (sortBy) {
      case 'oldest':
        orderClause = [['created_at', 'ASC']];
        break;
      case 'highest':
        orderClause = [['rating', 'DESC'], ['created_at', 'DESC']];
        break;
      case 'lowest':
        orderClause = [['rating', 'ASC'], ['created_at', 'DESC']];
        break;
      default:
        orderClause = [['created_at', 'DESC']];
    }

    // Calculate pagination
    const offset = (page - 1) * limit;

    // Get reviews with user information (using proper association alias)
    const { count, rows: reviewsData } = await Review.findAndCountAll({
      where: whereClause,
      order: orderClause,
      limit: parseInt(limit),
      offset: parseInt(offset),
      include: [
        {
          model: User,
          as: 'user', // This must match the alias in your Review model associations
          attributes: ['id', 'first_name', 'last_name', 'firstName', 'lastName', 'email'],
          required: false
        }
      ]
    });

    console.log('📖 Found reviews:', count);

    // Format reviews with better customer information
    const formattedReviews = reviewsData.map(review => {
      const reviewData = review.toJSON();
      
      // Get customer name from associated user with multiple fallbacks
      let customerName = 'Anonymous Customer';
      let customerEmail = null;
      
      if (reviewData.user) {
        // Try different field name combinations
        const firstName = reviewData.user.first_name || reviewData.user.firstName;
        const lastName = reviewData.user.last_name || reviewData.user.lastName;
        customerEmail = reviewData.user.email;
        
        if (firstName) {
          customerName = `${firstName} ${lastName?.charAt(0) || ''}.`;
        }
      }

      return {
        id: reviewData.id,
        rating: reviewData.rating,
        text: reviewData.text,
        comment: reviewData.text, // Alias for compatibility
        customerName,
        name: customerName, // Alias for compatibility
        customerEmail,
        User: reviewData.user, // Keep original structure for compatibility
        user: reviewData.user,
        createdAt: reviewData.createdAt,
        created_at: reviewData.createdAt,
        date: new Date(reviewData.createdAt).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric'
        }),
        timeAgo: getTimeAgo(reviewData.createdAt)
      };
    });

    // Calculate comprehensive review statistics
    const allReviews = await Review.findAll({
      where: { store_id },
      attributes: ['rating', 'created_at'],
      raw: true
    });

    const stats = {
      totalReviews: count,
      averageRating: allReviews.length > 0 
        ? Math.round((allReviews.reduce((sum, r) => sum + r.rating, 0) / allReviews.length) * 10) / 10
        : 0,
      ratingDistribution: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 }
    };

    // Calculate rating distribution
    allReviews.forEach(review => {
      if (stats.ratingDistribution[review.rating] !== undefined) {
        stats.ratingDistribution[review.rating]++;
      }
    });

    // Calculate recent trend (last 30 days vs previous 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const sixtyDaysAgo = new Date();
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

    const recentReviews = allReviews.filter(r => new Date(r.created_at) >= thirtyDaysAgo);
    const previousReviews = allReviews.filter(r => 
      new Date(r.created_at) >= sixtyDaysAgo && new Date(r.created_at) < thirtyDaysAgo
    );

    let recentTrend = 'stable';
    if (recentReviews.length > 0 && previousReviews.length > 0) {
      const recentAvg = recentReviews.reduce((sum, r) => sum + r.rating, 0) / recentReviews.length;
      const previousAvg = previousReviews.reduce((sum, r) => sum + r.rating, 0) / previousReviews.length;
      
      if (recentAvg > previousAvg + 0.3) recentTrend = 'improving';
      else if (recentAvg < previousAvg - 0.3) recentTrend = 'declining';
    }

    stats.recentTrend = recentTrend;

    return res.status(200).json({
      success: true,
      reviews: formattedReviews,
      stats,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(count / limit),
        totalItems: count,
        hasNextPage: offset + reviewsData.length < count,
        hasPrevPage: page > 1
      }
    });

  } catch (error) {
    console.error('Enhanced get reviews by store error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error fetching reviews',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// NEW: Get reviews for merchant's own store (dashboard endpoint)
exports.getMerchantStoreReviews = async (req, res) => {
  try {
    console.log('📊 Getting reviews for merchant store...');
    
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    const merchantId = req.user.id;
    console.log('👤 Merchant ID:', merchantId);

    // Find the merchant's store
    const store = await Store.findOne({
      where: { merchant_id: merchantId }
    });

    if (!store) {
      return res.status(404).json({
        success: false,
        message: 'No store found for your merchant account'
      });
    }

    console.log('🏪 Found merchant store:', store.name);

    // Use the existing getReviewsByStore logic but with merchant's store
    req.params.store_id = store.id;
    return exports.getReviewsByStore(req, res);

  } catch (error) {
    console.error('Get merchant store reviews error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error fetching your store reviews',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Utility function to calculate time ago
function getTimeAgo(date) {
  const now = new Date();
  const reviewDate = new Date(date);
  const diffInHours = Math.floor((now - reviewDate) / (1000 * 60 * 60));
  
  if (diffInHours < 1) return 'Just now';
  if (diffInHours < 24) return `${diffInHours} hours ago`;
  
  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 7) return `${diffInDays} days ago`;
  
  const diffInWeeks = Math.floor(diffInDays / 7);
  if (diffInWeeks < 4) return `${diffInWeeks} weeks ago`;
  
  const diffInMonths = Math.floor(diffInDays / 30);
  return `${diffInMonths} months ago`;
}
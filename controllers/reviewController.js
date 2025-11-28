// controllers/reviewController.js - FIXED version with correct column names and associations

const { Review, User, Store, Merchant, sequelize } = require('../models');
const jwt = require('jsonwebtoken');
const { Op } = require('sequelize');
const JWT_SECRET = process.env.JWT_SECRET;

// ===============================
// CREATE REVIEW
// ===============================
exports.createReview = async (req, res) => {
  try {
    const { store_id, rating, text, comment } = req.body;
    
    console.log('📝 Creating review:', { 
      store_id, 
      rating, 
      text: text?.substring(0, 50),
      userId: req.user?.id || req.user?.userId,
      userType: req.user?.userType || req.user?.type
    });
    
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

    // FIXED: Get user ID from authenticated request
    let userId = null;
    if (req.user) {
      userId = req.user.id || req.user.userId;
      console.log('✅ User ID extracted from token:', userId);
    }

    if (!userId) {
      console.error('❌ No user ID found in request');
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
        message: 'You have already reviewed this store. You can edit your existing review instead.',
        existingReviewId: existingReview.id
      });
    }

    // Create the review
    const newReview = await Review.create({
      store_id,
      user_id: userId,
      rating: parseInt(rating),
      text: text || comment || null,
    });

    console.log('✅ Review created with ID:', newReview.id);

    // FIXED: Get user info with correct column names
    let userName = 'Anonymous';
    let userEmail = null;
    
    try {
      const user = await User.findByPk(userId, {
        attributes: ['id', 'firstName', 'lastName', 'email'] // ✅ FIXED: Use correct column names
      });
      
      if (user) {
        const firstName = user.firstName;
        const lastName = user.lastName;
        userEmail = user.email;
        
        if (firstName) {
          userName = lastName ? `${firstName} ${lastName.charAt(0)}.` : firstName;
        }
        
        console.log('✅ User info retrieved:', { firstName, lastName, email: userEmail });
      } else {
        console.warn('⚠️ User not found in database:', userId);
      }
    } catch (err) {
      console.error('❌ Error getting user info:', err.message);
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
    const totalReviews = parseInt(reviewStats?.totalReviews || 1);
    
    // Update store rating
    await store.update({ rating: avgRating });

    console.log('✅ Store rating updated:', { avgRating, totalReviews });

    // Send push notification to merchant
    try {
      const PushNotificationService = require('../services/pushNotificationService');
      const pushService = new PushNotificationService();

      await pushService.sendNewReviewNotification(
        store.merchant_id,
        userName,
        store.name,
        parseInt(rating)
      );
      console.log('📱 Push notification sent to merchant for new review');
    } catch (pushError) {
      console.error('❌ Failed to send push notification:', pushError);
      // Don't fail the review creation if push notification fails
    }

    return res.status(201).json({
      success: true,
      message: 'Review submitted successfully',
      review: {
        id: newReview.id,
        rating: newReview.rating,
        text: newReview.text,
        customerName: userName,
        name: userName,
        customerEmail: userEmail,
        createdAt: newReview.createdAt,
        created_at: newReview.createdAt,
        date: new Date(newReview.createdAt).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric'
        })
      },
      storeRating: parseFloat(avgRating),
      totalReviews: totalReviews
    });

  } catch (error) {
    console.error('❌ Create review error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error creating review',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// ===============================
// GET REVIEWS BY STORE
// ===============================
exports.getReviewsByStore = async (req, res) => {
  try {
    const { store_id } = req.params;
    const { page = 1, limit = 20, rating = null, sortBy = 'newest' } = req.query;
    
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

    // Build where clause for filtering
    const whereClause = { store_id };
    if (rating && rating !== 'all') {
      whereClause.rating = parseInt(rating);
    }

    // Build order clause for sorting
    let orderClause = [['createdAt', 'DESC']]; // Default: newest first
    
    switch (sortBy) {
      case 'oldest':
        orderClause = [['createdAt', 'ASC']];
        break;
      case 'highest':
        orderClause = [['rating', 'DESC'], ['createdAt', 'DESC']];
        break;
      case 'lowest':
        orderClause = [['rating', 'ASC'], ['createdAt', 'DESC']];
        break;
      default:
        orderClause = [['createdAt', 'DESC']];
    }

    // Calculate pagination
    const offset = (page - 1) * limit;

    // FIXED: Get reviews with correct association alias
    const { count, rows: reviewsData } = await Review.findAndCountAll({
      where: whereClause,
      order: orderClause,
      limit: parseInt(limit),
      offset: parseInt(offset),
      include: [
        {
          model: User,
          as: 'reviewUser', // ✅ FIXED: Use correct association alias
          attributes: ['id', 'firstName', 'lastName', 'email'], // ✅ FIXED: Use correct column names
          required: false // LEFT JOIN to include reviews even if user is deleted
        }
      ]
    });

    console.log('📖 Found reviews:', count);

    // FIXED: Format reviews with correct user data access
    const formattedReviews = reviewsData.map(review => {
      const reviewData = review.toJSON();
      
      // Get customer name from associated user
      let customerName = 'Anonymous Customer';
      let customerEmail = null;
      
      if (reviewData.reviewUser) { // ✅ FIXED: Use correct association alias
        const firstName = reviewData.reviewUser.firstName;
        const lastName = reviewData.reviewUser.lastName;
        customerEmail = reviewData.reviewUser.email;
        
        if (firstName) {
          customerName = lastName ? `${firstName} ${lastName.charAt(0)}.` : firstName;
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
        User: reviewData.reviewUser, // Keep original structure for compatibility
        user: reviewData.reviewUser, // Alias for compatibility
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
      attributes: ['rating', 'createdAt'],
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
    console.error('❌ Get reviews by store error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error fetching reviews',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// ===============================
// UPDATE REVIEW
// ===============================
exports.updateReview = async (req, res) => {
  try {
    const { id } = req.params;
    const { rating, text, comment } = req.body;
    
    console.log('✏️ Updating review:', id, { rating, text: text?.substring(0, 50) });
    
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    const userId = req.user.id || req.user.userId;

    // Find the review with user and store info
    const review = await Review.findOne({
      where: { 
        id,
        user_id: userId // Ensure user can only edit their own review
      },
      include: [
        {
          model: User,
          as: 'reviewUser', // ✅ FIXED: Use correct association alias
          attributes: ['id', 'firstName', 'lastName'] // ✅ FIXED: Use correct column names
        }
      ]
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

      console.log('✅ Store rating recalculated:', avgRating);
    }

    // Format response with user info
    let userName = 'Anonymous';
    if (review.reviewUser) { // ✅ FIXED: Use correct association alias
      const firstName = review.reviewUser.firstName;
      const lastName = review.reviewUser.lastName;
      if (firstName) {
        userName = lastName ? `${firstName} ${lastName.charAt(0)}.` : firstName;
      }
    }

    return res.status(200).json({
      success: true,
      message: 'Review updated successfully',
      review: {
        id: updatedReview.id,
        rating: updatedReview.rating,
        text: updatedReview.text,
        customerName: userName,
        name: userName,
        createdAt: updatedReview.createdAt,
        updatedAt: updatedReview.updatedAt
      }
    });

  } catch (error) {
    console.error('❌ Update review error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error updating review',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// ===============================
// DELETE REVIEW
// ===============================
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
    console.error('❌ Delete review error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error deleting review',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// ===============================
// GET REVIEW BY ID
// ===============================
exports.getReviewById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const review = await Review.findByPk(id, {
      include: [
        {
          model: User,
          as: 'reviewUser', // ✅ FIXED: Use correct association alias
          attributes: ['id', 'firstName', 'lastName'] // ✅ FIXED: Use correct column names
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
    if (reviewData.reviewUser) { // ✅ FIXED: Use correct association alias
      const firstName = reviewData.reviewUser.firstName;
      const lastName = reviewData.reviewUser.lastName;
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
    console.error('❌ Get review by ID error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error fetching review',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// ===============================
// GET MERCHANT STORE REVIEWS
// ===============================
exports.getMerchantStoreReviews = async (req, res) => {
  try {
    console.log('📊 Getting reviews for merchant store...');
    
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    const merchantId = req.user.id || req.user.userId;
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
    console.error('❌ Get merchant store reviews error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error fetching your store reviews',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// ===============================
// UTILITY FUNCTIONS
// ===============================

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
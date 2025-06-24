const express = require('express');
const router = express.Router();

// Mock database - replace with your actual database
let offers = [
  {
    id: 1,
    title: "Get 50% off",
    description: "On your first deal purchase",
    image: "/images/3.jpg",
    discountPercentage: 50,
    originalPrice: 99.99,
    discountedPrice: 49.99,
    store: "Main Store",
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
    isActive: true,
    isFeatured: true,
    createdAt: new Date()
  },
  {
    id: 2,
    title: "Summer Sale Bonanza",
    description: "Up to 70% off on selected items",
    image: "/images/summer.jpg",
    discountPercentage: 70,
    originalPrice: 149.99,
    discountedPrice: 44.99,
    store: "Fashion Hub",
    expiresAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 days from now
    isActive: true,
    isFeatured: true,
    createdAt: new Date()
  },
  {
    id: 3,
    title: "Tech Gadgets Deal",
    description: "Latest electronics at unbeatable prices",
    image: "/images/tech.jpg",
    discountPercentage: 40,
    originalPrice: 299.99,
    discountedPrice: 179.99,
    store: "Tech World",
    expiresAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000), // 5 days from now
    isActive: true,
    isFeatured: true,
    createdAt: new Date()
  }
];

let sideOffers = [
  {
    id: 4,
    title: "Spa & Wellness Package",
    image: "/images/spa.png",
    originalPrice: 79.99,
    discountedPrice: 29.99,
    discountPercentage: 62,
    timeLeft: "2 days left",
    store: "Wellness Center",
    expiresAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
    isActive: true,
    isFeatured: false,
    createdAt: new Date()
  },
  {
    id: 5,
    title: "Adventure Activities",
    image: "/images/safr.jpg",
    originalPrice: 89.00,
    discountedPrice: 45.00,
    discountPercentage: 49,
    timeLeft: "Limited spots",
    store: "Adventure Co",
    expiresAt: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
    isActive: true,
    isFeatured: false,
    createdAt: new Date()
  }
];

// Helper function to check if offer is still valid
const isOfferValid = (offer) => {
  return offer.isActive && new Date() < new Date(offer.expiresAt);
};

// Helper function to calculate time left
const getTimeLeft = (expiresAt) => {
  const now = new Date();
  const expiry = new Date(expiresAt);
  const timeDiff = expiry - now;
  
  if (timeDiff <= 0) return "Expired";
  
  const days = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((timeDiff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  
  if (days > 0) return `${days} day${days > 1 ? 's' : ''} left`;
  if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} left`;
  return "Few minutes left";
};

// GET /api/hero/offers - Get all featured offers for hero carousel
router.get('/offers', (req, res) => {
  try {
    const validOffers = offers.filter(isOfferValid);
    
    // Add calculated time left to each offer
    const offersWithTimeLeft = validOffers.map(offer => ({
      ...offer,
      timeLeft: getTimeLeft(offer.expiresAt)
    }));
    
    res.json({
      success: true,
      data: offersWithTimeLeft,
      count: offersWithTimeLeft.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching hero offers',
      error: error.message
    });
  }
});

// GET /api/hero/side-offers - Get side offers
router.get('/side-offers', (req, res) => {
  try {
    const validSideOffers = sideOffers.filter(isOfferValid);
    
    // Add calculated time left to each offer
    const sideOffersWithTimeLeft = validSideOffers.map(offer => ({
      ...offer,
      timeLeft: getTimeLeft(offer.expiresAt)
    }));
    
    res.json({
      success: true,
      data: sideOffersWithTimeLeft,
      count: sideOffersWithTimeLeft.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching side offers',
      error: error.message
    });
  }
});

// GET /api/hero/offers/:id - Get specific offer
router.get('/offers/:id', (req, res) => {
  try {
    const offerId = parseInt(req.params.id);
    const offer = [...offers, ...sideOffers].find(o => o.id === offerId);
    
    if (!offer) {
      return res.status(404).json({
        success: false,
        message: 'Offer not found'
      });
    }
    
    if (!isOfferValid(offer)) {
      return res.status(410).json({
        success: false,
        message: 'Offer has expired'
      });
    }
    
    res.json({
      success: true,
      data: {
        ...offer,
        timeLeft: getTimeLeft(offer.expiresAt)
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching offer',
      error: error.message
    });
  }
});

// POST /api/hero/offers - Create new offer (admin endpoint)
router.post('/offers', (req, res) => {
  try {
    const {
      title,
      description,
      image,
      originalPrice,
      discountPercentage,
      store,
      durationDays,
      isFeatured = false
    } = req.body;
    
    // Validation
    if (!title || !description || !originalPrice || !discountPercentage || !store) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields'
      });
    }
    
    const discountedPrice = originalPrice - (originalPrice * discountPercentage / 100);
    const expiresAt = new Date(Date.now() + (durationDays || 7) * 24 * 60 * 60 * 1000);
    
    const newOffer = {
      id: Math.max(...offers.map(o => o.id), ...sideOffers.map(o => o.id)) + 1,
      title,
      description,
      image: image || '/images/default.jpg',
      originalPrice: parseFloat(originalPrice),
      discountedPrice: parseFloat(discountedPrice.toFixed(2)),
      discountPercentage: parseInt(discountPercentage),
      store,
      expiresAt,
      isActive: true,
      isFeatured,
      createdAt: new Date()
    };
    
    if (isFeatured) {
      offers.push(newOffer);
    } else {
      sideOffers.push(newOffer);
    }
    
    res.status(201).json({
      success: true,
      message: 'Offer created successfully',
      data: {
        ...newOffer,
        timeLeft: getTimeLeft(newOffer.expiresAt)
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error creating offer',
      error: error.message
    });
  }
});

// PUT /api/hero/offers/:id - Update offer
router.put('/offers/:id', (req, res) => {
  try {
    const offerId = parseInt(req.params.id);
    const updates = req.body;
    
    // Find offer in both arrays
    let offerIndex = offers.findIndex(o => o.id === offerId);
    let targetArray = offers;
    
    if (offerIndex === -1) {
      offerIndex = sideOffers.findIndex(o => o.id === offerId);
      targetArray = sideOffers;
    }
    
    if (offerIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Offer not found'
      });
    }
    
    // Update offer
    targetArray[offerIndex] = {
      ...targetArray[offerIndex],
      ...updates,
      id: offerId, // Ensure ID doesn't change
      updatedAt: new Date()
    };
    
    res.json({
      success: true,
      message: 'Offer updated successfully',
      data: {
        ...targetArray[offerIndex],
        timeLeft: getTimeLeft(targetArray[offerIndex].expiresAt)
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error updating offer',
      error: error.message
    });
  }
});

// DELETE /api/hero/offers/:id - Delete/deactivate offer
router.delete('/offers/:id', (req, res) => {
  try {
    const offerId = parseInt(req.params.id);
    
    // Find and deactivate offer
    let found = false;
    
    offers.forEach(offer => {
      if (offer.id === offerId) {
        offer.isActive = false;
        found = true;
      }
    });
    
    sideOffers.forEach(offer => {
      if (offer.id === offerId) {
        offer.isActive = false;
        found = true;
      }
    });
    
    if (!found) {
      return res.status(404).json({
        success: false,
        message: 'Offer not found'
      });
    }
    
    res.json({
      success: true,
      message: 'Offer deactivated successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error deleting offer',
      error: error.message
    });
  }
});

// GET /api/hero/stats - Get offers statistics
router.get('/stats', (req, res) => {
  try {
    const allOffers = [...offers, ...sideOffers];
    const activeOffers = allOffers.filter(isOfferValid);
    const expiredOffers = allOffers.filter(offer => !isOfferValid(offer));
    
    res.json({
      success: true,
      data: {
        total: allOffers.length,
        active: activeOffers.length,
        expired: expiredOffers.length,
        featured: offers.filter(isOfferValid).length,
        sideOffers: sideOffers.filter(isOfferValid).length
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching stats',
      error: error.message
    });
  }
});

module.exports = router;
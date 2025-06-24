const express = require('express');
const { Op } = require('sequelize');
const router = express.Router();

// Import your Sequelize models
// Assuming you have models defined like this:
const { Deal, Store, Category } = require('../models/homedealsstores');

// Note: You'll need to replace these with your actual model imports
// For example, if your models are in a different location:
// const db = require('../models');
// const { Deal, Store, Category } = db;

// Helper function to format deals for frontend
const formatDealsForFrontend = (deals) => {
  return deals.map(deal => ({
    id: deal.id,
    title: deal.title,
    originalPrice: `$${parseFloat(deal.originalPrice).toFixed(2)}`,
    salePrice: `$${parseFloat(deal.salePrice).toFixed(2)}`,
    discount: `${deal.discount}%`,
    rating: deal.rating,
    reviews: deal.reviews,
    timeLeft: deal.timeLeft,
    image: deal.image,
    tag: deal.tag,
    location: deal.location
  }));
};

// Helper function to format stores for frontend
const formatStoresForFrontend = (stores) => {
  return stores.map(store => ({
    id: store.id,
    name: store.name,
    category: store.category,
    discount: `${store.discount}%`,
    offer: store.offer,
    rating: store.rating,
    reviews: store.reviews,
    image: store.image,
    logo: store.logo,
    logoColor: store.logoColor,
    tag: store.tag
  }));
};

// GET /api/home/top-deals - Get top rated deals for home page
router.get('/top-deals', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 4;
    
    // Query active deals using Sequelize
    const topDeals = await Deal.findAll({
      where: {
        isActive: true,
        expiresAt: {
          [Op.gt]: new Date()
        }
      },
      order: [
        ['rating', 'DESC'],
        ['reviews', 'DESC']
      ],
      limit: limit,
      include: [
        {
          model: Store,
          as: 'store', // Adjust alias based on your association
          attributes: ['name', 'location']
        }
      ]
    });

    const formattedDeals = formatDealsForFrontend(topDeals);

    res.json({
      success: true,
      data: {
        deals: formattedDeals,
        total: topDeals.length,
        message: 'Top deals retrieved successfully'
      }
    });
  } catch (error) {
    console.error('Error fetching top deals:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch top deals',
      error: error.message
    });
  }
});

// GET /api/home/popular-stores - Get top rated stores for home page
router.get('/popular-stores', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 8;
    const category = req.query.category; // Optional category filter
    
    // Build where clause
    const whereClause = { isActive: true };
    
    // Apply category filter if provided
    if (category) {
      whereClause.category = {
        [Op.iLike]: `%${category}%` // Use iLike for case-insensitive search
      };
    }
    
    // Query top stores using Sequelize
    const topStores = await Store.findAll({
      where: whereClause,
      order: [
        ['rating', 'DESC'],
        ['reviews', 'DESC'],
        ['activeDealsCount', 'DESC']
      ],
      limit: limit,
      include: [
        {
          model: Deal,
          as: 'deals', // Adjust alias based on your association
          where: { isActive: true },
          required: false, // LEFT JOIN
          attributes: ['id', 'title', 'discount']
        }
      ]
    });

    // Group stores by category for better organization
    const groupedStores = {
      travel: topStores.filter(store => store.categoryId === 2),
      food: topStores.filter(store => store.categoryId === 1)
    };

    const formattedStores = {
      travel: formatStoresForFrontend(groupedStores.travel),
      food: formatStoresForFrontend(groupedStores.food)
    };

    res.json({
      success: true,
      data: {
        stores: formattedStores,
        allStores: formatStoresForFrontend(topStores),
        total: topStores.length,
        message: 'Popular stores retrieved successfully'
      }
    });
  } catch (error) {
    console.error('Error fetching popular stores:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch popular stores',
      error: error.message
    });
  }
});

// GET /api/home/dashboard - Get both deals and stores for home page
router.get('/dashboard', async (req, res) => {
  try {
    const dealsLimit = parseInt(req.query.dealsLimit) || 4;
    const storesLimit = parseInt(req.query.storesLimit) || 8;
    
    // Get top deals
    const topDeals = await Deal.findAll({
      where: {
        isActive: true,
        expiresAt: {
          [Op.gt]: new Date()
        }
      },
      order: [
        ['rating', 'DESC'],
        ['reviews', 'DESC']
      ],
      limit: dealsLimit,
      include: [
        {
          model: Store,
          as: 'store',
          attributes: ['name', 'location']
        }
      ]
    });

    // Get top stores
    const topStores = await Store.findAll({
      where: { isActive: true },
      order: [
        ['rating', 'DESC'],
        ['reviews', 'DESC'],
        ['activeDealsCount', 'DESC']
      ],
      limit: storesLimit
    });

    // Get statistics
    const [totalActiveDeals, totalActiveStores, foodStores, travelStores] = await Promise.all([
      Deal.count({ where: { isActive: true } }),
      Store.count({ where: { isActive: true } }),
      Store.count({ where: { categoryId: 1, isActive: true } }),
      Store.count({ where: { categoryId: 2, isActive: true } })
    ]);

    // Group stores by category
    const groupedStores = {
      travel: topStores.filter(store => store.categoryId === 2),
      food: topStores.filter(store => store.categoryId === 1)
    };

    res.json({
      success: true,
      data: {
        topDeals: formatDealsForFrontend(topDeals),
        popularStores: {
          travel: formatStoresForFrontend(groupedStores.travel),
          food: formatStoresForFrontend(groupedStores.food)
        },
        stats: {
          totalActiveDeals,
          totalActiveStores,
          categories: {
            food: foodStores,
            travel: travelStores
          }
        },
        message: 'Dashboard data retrieved successfully'
      }
    });
  } catch (error) {
    console.error('Error fetching dashboard data:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch dashboard data',
      error: error.message
    });
  }
});

// GET /api/home/deals/:id - Get specific deal details
router.get('/deals/:id', async (req, res) => {
  try {
    const dealId = parseInt(req.params.id);
    
    const deal = await Deal.findOne({
      where: { 
        id: dealId, 
        isActive: true 
      },
      include: [
        {
          model: Store,
          as: 'store',
          attributes: ['id', 'name', 'location', 'category']
        }
      ]
    });
    
    if (!deal) {
      return res.status(404).json({
        success: false,
        message: 'Deal not found or no longer active'
      });
    }

    // Get related deals from the same store
    const relatedDeals = await Deal.findAll({
      where: {
        storeId: deal.storeId,
        id: { [Op.ne]: deal.id },
        isActive: true
      },
      limit: 3,
      order: [['rating', 'DESC']]
    });

    res.json({
      success: true,
      data: {
        deal: {
          ...deal.toJSON(),
          originalPrice: `$${parseFloat(deal.originalPrice).toFixed(2)}`,
          salePrice: `$${parseFloat(deal.salePrice).toFixed(2)}`,
          discount: `${deal.discount}%`
        },
        relatedDeals: formatDealsForFrontend(relatedDeals),
        message: 'Deal details retrieved successfully'
      }
    });
  } catch (error) {
    console.error('Error fetching deal details:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch deal details',
      error: error.message
    });
  }
});

// GET /api/home/stores/:id - Get specific store details
router.get('/stores/:id', async (req, res) => {
  try {
    const storeId = parseInt(req.params.id);
    
    const store = await Store.findOne({
      where: { 
        id: storeId, 
        isActive: true 
      }
    });
    
    if (!store) {
      return res.status(404).json({
        success: false,
        message: 'Store not found or no longer active'
      });
    }

    // Get store's active deals
    const storeDeals = await Deal.findAll({
      where: {
        storeId: store.id,
        isActive: true
      },
      order: [['rating', 'DESC']]
    });

    res.json({
      success: true,
      data: {
        store: store.toJSON(),
        deals: formatDealsForFrontend(storeDeals),
        dealsCount: storeDeals.length,
        message: 'Store details retrieved successfully'
      }
    });
  } catch (error) {
    console.error('Error fetching store details:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch store details',
      error: error.message
    });
  }
});

// GET /api/home/search - Search deals and stores
router.get('/search', async (req, res) => {
  try {
    const { q: query, category, minDiscount, maxPrice, sortBy = 'rating' } = req.query;
    const limit = parseInt(req.query.limit) || 20;
    const offset = parseInt(req.query.offset) || 0;

    if (!query) {
      return res.status(400).json({
        success: false,
        message: 'Search query is required'
      });
    }

    // Build where clauses for deals
    const dealWhere = {
      isActive: true,
      expiresAt: { [Op.gt]: new Date() },
      [Op.or]: [
        { title: { [Op.iLike]: `%${query}%` } },
        { location: { [Op.iLike]: `%${query}%` } }
      ]
    };

    // Add filters
    if (minDiscount) {
      dealWhere.discount = { [Op.gte]: parseInt(minDiscount) };
    }
    if (maxPrice) {
      dealWhere.salePrice = { [Op.lte]: parseFloat(maxPrice) };
    }

    // Build order clause
    let orderClause;
    switch (sortBy) {
      case 'price_low':
        orderClause = [['salePrice', 'ASC']];
        break;
      case 'price_high':
        orderClause = [['salePrice', 'DESC']];
        break;
      case 'discount':
        orderClause = [['discount', 'DESC']];
        break;
      case 'newest':
        orderClause = [['createdAt', 'DESC']];
        break;
      default:
        orderClause = [['rating', 'DESC'], ['reviews', 'DESC']];
    }

    const deals = await Deal.findAndCountAll({
      where: dealWhere,
      order: orderClause,
      limit,
      offset,
      include: [
        {
          model: Store,
          as: 'store',
          attributes: ['name', 'location'],
          where: category ? { categoryId: parseInt(category) } : undefined
        }
      ]
    });

    res.json({
      success: true,
      data: {
        deals: formatDealsForFrontend(deals.rows),
        total: deals.count,
        page: Math.floor(offset / limit) + 1,
        totalPages: Math.ceil(deals.count / limit),
        message: 'Search results retrieved successfully'
      }
    });
  } catch (error) {
    console.error('Error searching deals:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to search deals',
      error: error.message
    });
  }
});

module.exports = router;
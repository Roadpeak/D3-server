// models/ServiceRequest.js - FIXED CATEGORY ENUM
module.exports = (sequelize, DataTypes) => {
  const ServiceRequest = sequelize.define('ServiceRequest', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    title: {
      type: DataTypes.STRING(200),
      allowNull: false,
      validate: {
        len: [5, 200],
        notEmpty: true,
      },
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: false,
      validate: {
        len: [10, 2000],
        notEmpty: true,
      },
    },
    category: {
      type: DataTypes.ENUM(
        // ✅ FIXED: Updated to match frontend categories
        'Web Development',
        'Graphic Design', 
        'Writing & Translation',
        'Digital Marketing',
        'Video & Animation',
        'Music & Audio',
        'Programming',
        'Business',
        'Health & Fitness',      
        'Beauty & Salon',        
        'Photography',
        'Home Services',
        'Automotive',           
        'Education',             
        'Technology',            
        'Legal Services',
        'Consulting',
        'Healthcare',
        'Food & Catering',
        'Event Services',
        'Pet Services',
        'Moving & Storage',
        'Landscaping',
        'Cleaning Services',
        'Repair Services',
        'Installation Services',
        'Financial Services',
        'Other'
      ),
      allowNull: false,
    },
    budgetMin: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      validate: {
        min: 0,
        isDecimal: true,
      },
    },
    budgetMax: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      validate: {
        min: 0,
        isDecimal: true,
      },
    },
    timeline: {
      type: DataTypes.ENUM('urgent', 'thisweek', 'nextweek', 'thismonth', 'flexible'),
      allowNull: false,
    },
    location: {
      type: DataTypes.STRING(255),
      allowNull: false,
      validate: {
        len: [3, 255],
        notEmpty: true,
      },
    },
    coordinates: {
      type: DataTypes.JSON,
      defaultValue: null,
    },
    requirements: {
      type: DataTypes.JSON,
      defaultValue: [],
    },
    priority: {
      type: DataTypes.ENUM('low', 'normal', 'high', 'urgent'),
      defaultValue: 'normal',
    },
    postedBy: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'Users',
        key: 'id',
      },
      onDelete: 'CASCADE',
    },
    status: {
      type: DataTypes.ENUM('open', 'in_progress', 'completed', 'cancelled', 'disputed'),
      defaultValue: 'open',
    },
    acceptedOfferId: {
      type: DataTypes.UUID,
      defaultValue: null,
      references: {
        model: 'service_offers',
        key: 'id',
      },
      onDelete: 'SET NULL',
    },
    completedAt: {
      type: DataTypes.DATE,
      defaultValue: null,
    },
    cancelledAt: {
      type: DataTypes.DATE,
      defaultValue: null,
    },
    cancellationReason: {
      type: DataTypes.TEXT,
      defaultValue: null,
    },
    finalRating: {
      type: DataTypes.INTEGER,
      validate: {
        min: 1,
        max: 5,
      },
      defaultValue: null,
    },
    finalReview: {
      type: DataTypes.TEXT,
      validate: {
        len: [0, 1000],
      },
      defaultValue: null,
    },
    images: {
      type: DataTypes.JSON,
      defaultValue: [],
    },
    attachments: {
      type: DataTypes.JSON,
      defaultValue: [],
    },
    urgentUntil: {
      type: DataTypes.DATE,
      defaultValue: null,
    },
    expiresAt: {
      type: DataTypes.DATE,
      defaultValue: () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
    },
    viewCount: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    bookmarkCount: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    // Store-related tracking
    offerCount: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      comment: 'Total number of offers received'
    },
    storeOfferCount: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      comment: 'Number of store-based offers received'
    },
    uniqueStoreCount: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      comment: 'Number of unique stores that offered'
    },
    averageOfferPrice: {
      type: DataTypes.DECIMAL(10, 2),
      defaultValue: null,
      comment: 'Average price of all offers received'
    },
    lowestOfferPrice: {
      type: DataTypes.DECIMAL(10, 2),
      defaultValue: null,
      comment: 'Lowest price offered'
    },
    highestOfferPrice: {
      type: DataTypes.DECIMAL(10, 2),
      defaultValue: null,
      comment: 'Highest price offered'
    },
    // Performance tracking
    firstOfferReceivedAt: {
      type: DataTypes.DATE,
      defaultValue: null,
      comment: 'When the first offer was received'
    },
    lastOfferReceivedAt: {
      type: DataTypes.DATE,
      defaultValue: null,
      comment: 'When the last offer was received'
    },
    averageResponseTime: {
      type: DataTypes.DECIMAL(8, 2),
      defaultValue: null,
      comment: 'Average time in hours for stores to respond'
    }
  }, {
    tableName: 'service_requests',
    timestamps: true,
    indexes: [
      {
        fields: ['category', 'status'],
        name: 'idx_service_requests_category_status'
      },
      {
        fields: ['location', 'status'],
        name: 'idx_service_requests_location_status'
      },
      {
        fields: ['budgetMin', 'budgetMax', 'status'],
        name: 'idx_service_requests_budget_status'
      },
      {
        fields: ['timeline', 'priority', 'status'],
        name: 'idx_service_requests_timeline_priority_status'
      },
      {
        fields: ['postedBy', 'status'],
        name: 'idx_service_requests_user_status'
      }
    ]
  });

  // ASSOCIATIONS
  ServiceRequest.associate = (models) => {
    // User who posted the request
    ServiceRequest.belongsTo(models.User, {
      foreignKey: 'postedBy',
      as: 'postedByUser',
      onDelete: 'CASCADE',
    });

    // All offers for this request
    ServiceRequest.hasMany(models.ServiceOffer, {
      foreignKey: 'requestId',
      as: 'offers',
      onDelete: 'CASCADE',
    });

    // Specific accepted offer
    ServiceRequest.belongsTo(models.ServiceOffer, {
      foreignKey: 'acceptedOfferId',
      as: 'acceptedOffer',
      onDelete: 'SET NULL',
    });

    // Through offers, access stores that offered
    ServiceRequest.belongsToMany(models.Store, {
      through: models.ServiceOffer,
      foreignKey: 'requestId',
      otherKey: 'storeId',
      as: 'offeringStores'
    });
  };

  // INSTANCE METHODS
  ServiceRequest.prototype.incrementViewCount = async function() {
    await this.increment('viewCount');
    return this.viewCount + 1;
  };

  ServiceRequest.prototype.getOfferStats = async function() {
    const { ServiceOffer } = sequelize.models;
    
    const [stats, storeStats, priceStats] = await Promise.all([
      ServiceOffer.findAll({
        where: { requestId: this.id },
        attributes: [
          'status',
          [sequelize.fn('COUNT', sequelize.col('id')), 'count']
        ],
        group: ['status'],
        raw: true
      }),
      
      ServiceOffer.findAll({
        where: { requestId: this.id },
        attributes: [
          [sequelize.fn('COUNT', sequelize.fn('DISTINCT', sequelize.col('storeId'))), 'uniqueStores'],
          [sequelize.fn('COUNT', sequelize.col('id')), 'totalOffers']
        ],
        raw: true
      }),
      
      ServiceOffer.findAll({
        where: { requestId: this.id },
        attributes: [
          [sequelize.fn('AVG', sequelize.col('quotedPrice')), 'avgPrice'],
          [sequelize.fn('MIN', sequelize.col('quotedPrice')), 'minPrice'],
          [sequelize.fn('MAX', sequelize.col('quotedPrice')), 'maxPrice']
        ],
        raw: true
      })
    ]);

    const result = {
      total: 0,
      pending: 0,
      accepted: 0,
      rejected: 0,
      withdrawn: 0,
      uniqueStores: parseInt(storeStats[0]?.uniqueStores || 0),
      averagePrice: parseFloat(priceStats[0]?.avgPrice || 0),
      lowestPrice: parseFloat(priceStats[0]?.minPrice || 0),
      highestPrice: parseFloat(priceStats[0]?.maxPrice || 0)
    };

    stats.forEach(stat => {
      result[stat.status] = parseInt(stat.count);
      result.total += parseInt(stat.count);
    });

    return result;
  };

  ServiceRequest.prototype.canReceiveOffers = function() {
    return this.status === 'open' && new Date() < new Date(this.expiresAt);
  };

  ServiceRequest.prototype.acceptOffer = async function(offerId) {
    const { ServiceOffer } = sequelize.models;
    
    const transaction = await sequelize.transaction();
    
    try {
      const offer = await ServiceOffer.findByPk(offerId, { 
        include: [{
          model: sequelize.models.Store,
          as: 'store',
          attributes: ['id', 'name', 'merchant_id']
        }],
        transaction 
      });
      
      if (!offer || offer.requestId !== this.id) {
        throw new Error('Offer not found or does not belong to this request');
      }

      await offer.update({
        status: 'accepted',
        acceptedAt: new Date()
      }, { transaction });

      await this.update({
        status: 'in_progress',
        acceptedOfferId: offerId
      }, { transaction });

      await ServiceOffer.update({
        status: 'rejected',
        rejectedAt: new Date(),
        statusReason: 'Another offer was accepted'
      }, {
        where: {
          requestId: this.id,
          id: { [sequelize.Op.ne]: offerId },
          status: 'pending'
        },
        transaction
      });

      await transaction.commit();
      return { success: true, acceptedOffer: offer };
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  };

  ServiceRequest.prototype.updateOfferStats = async function() {
    const stats = await this.getOfferStats();
    
    await this.update({
      offerCount: stats.total,
      storeOfferCount: stats.total,
      uniqueStoreCount: stats.uniqueStores,
      averageOfferPrice: stats.averagePrice > 0 ? stats.averagePrice : null,
      lowestOfferPrice: stats.lowestPrice > 0 ? stats.lowestPrice : null,
      highestOfferPrice: stats.highestPrice > 0 ? stats.highestPrice : null,
      lastOfferReceivedAt: new Date()
    });

    if (stats.total === 1 && !this.firstOfferReceivedAt) {
      await this.update({
        firstOfferReceivedAt: new Date()
      });
    }
  };

  ServiceRequest.prototype.matchesStoreCategory = function(storeCategory) {
    return this.category === storeCategory;
  };

  // CLASS METHODS
  ServiceRequest.getRequestsForStore = async function(storeCategory, filters = {}) {
    const whereClause = {
      status: 'open',
      category: storeCategory
    };

    if (filters.timeline && filters.timeline !== 'all') {
      whereClause.timeline = filters.timeline;
    }

    if (filters.location) {
      whereClause.location = { [sequelize.Op.iLike]: `%${filters.location}%` };
    }

    if (filters.budget && filters.budget !== 'all') {
      if (filters.budget.includes('+')) {
        const minBudget = parseInt(filters.budget.replace('+', ''));
        whereClause.budgetMin = { [sequelize.Op.gte]: minBudget };
      } else if (filters.budget.includes('-')) {
        const [min, max] = filters.budget.split('-').map(b => parseInt(b.trim()));
        whereClause[sequelize.Op.and] = [
          { budgetMin: { [sequelize.Op.lte]: max } },
          { budgetMax: { [sequelize.Op.gte]: min } }
        ];
      }
    }

    const { page = 1, limit = 20 } = filters;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    return await this.findAndCountAll({
      where: whereClause,
      include: [{
        model: sequelize.models.User,
        as: 'postedByUser',
        attributes: ['id', 'firstName', 'lastName', 'avatar', 'verified']
      }],
      order: [
        ['priority', 'DESC'],
        ['createdAt', 'DESC']
      ],
      limit: parseInt(limit),
      offset
    });
  };

  ServiceRequest.getActiveRequestsCount = async function() {
    return await this.count({
      where: { status: 'open' }
    });
  };

  ServiceRequest.getRequestsByCategory = async function() {
    return await this.findAll({
      attributes: [
        'category',
        [sequelize.fn('COUNT', sequelize.col('id')), 'count']
      ],
      where: { status: 'open' },
      group: ['category'],
      raw: true
    });
  };

  ServiceRequest.getRequestsForMerchant = async function(merchantId, filters = {}) {
    const stores = await sequelize.models.Store.findAll({
      where: { 
        merchant_id: merchantId,
        is_active: true
      },
      attributes: ['category']
    });

    const categories = [...new Set(stores.map(store => store.category))];
    
    if (categories.length === 0) {
      return { count: 0, rows: [] };
    }

    const whereClause = {
      status: 'open',
      category: { [sequelize.Op.in]: categories }
    };

    if (filters.timeline && filters.timeline !== 'all') {
      whereClause.timeline = filters.timeline;
    }

    if (filters.location) {
      whereClause.location = { [sequelize.Op.iLike]: `%${filters.location}%` };
    }

    if (filters.budget && filters.budget !== 'all') {
      if (filters.budget.includes('+')) {
        const minBudget = parseInt(filters.budget.replace('+', ''));
        whereClause.budgetMin = { [sequelize.Op.gte]: minBudget };
      } else if (filters.budget.includes('-')) {
        const [min, max] = filters.budget.split('-').map(b => parseInt(b.trim()));
        whereClause[sequelize.Op.and] = [
          { budgetMin: { [sequelize.Op.lte]: max } },
          { budgetMax: { [sequelize.Op.gte]: min } }
        ];
      }
    }

    const { page = 1, limit = 20 } = filters;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    return await this.findAndCountAll({
      where: whereClause,
      include: [{
        model: sequelize.models.User,
        as: 'postedByUser',
        attributes: ['id', 'firstName', 'lastName', 'avatar', 'verified']
      }],
      order: [
        ['priority', 'DESC'],
        ['createdAt', 'DESC']
      ],
      limit: parseInt(limit),
      offset
    });
  };

  ServiceRequest.getPlatformStats = async function(period = '30d') {
    const daysBack = period === '7d' ? 7 : period === '90d' ? 90 : 30;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysBack);

    const [
      totalRequests,
      completedRequests,
      averageOffers,
      averageCompletionTime
    ] = await Promise.all([
      this.count({
        where: {
          createdAt: { [sequelize.Op.gte]: startDate }
        }
      }),
      
      this.count({
        where: {
          status: 'completed',
          completedAt: { [sequelize.Op.gte]: startDate }
        }
      }),
      
      this.findOne({
        where: {
          createdAt: { [sequelize.Op.gte]: startDate }
        },
        attributes: [
          [sequelize.fn('AVG', sequelize.col('offerCount')), 'avgOffers']
        ],
        raw: true
      }),
      
      this.findAll({
        where: {
          status: 'completed',
          completedAt: { [sequelize.Op.gte]: startDate }
        },
        attributes: [
          [
            sequelize.fn('AVG', 
              sequelize.literal('EXTRACT(EPOCH FROM (completed_at - created_at)) / 3600')
            ), 
            'avgCompletionHours'
          ]
        ],
        raw: true
      })
    ]);

    return {
      period,
      totalRequests,
      completedRequests,
      completionRate: totalRequests > 0 ? (completedRequests / totalRequests) * 100 : 0,
      averageOffers: Math.round((averageOffers?.avgOffers || 0) * 100) / 100,
      averageCompletionTime: Math.round((averageCompletionTime[0]?.avgCompletionHours || 0) * 100) / 100
    };
  };

  return ServiceRequest;
};
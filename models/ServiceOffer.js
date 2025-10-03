// models/ServiceOffer.js - Optimized with reduced indexes
module.exports = (sequelize, DataTypes) => {
  const ServiceOffer = sequelize.define('ServiceOffer', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    requestId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'service_requests',
        key: 'id',
      },
      onDelete: 'CASCADE',
    },
    storeId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'stores',
        key: 'id',
      },
      onDelete: 'CASCADE',
    },
    providerId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'merchants',
        key: 'id',
      },
      onDelete: 'CASCADE',
    },
    quotedPrice: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      validate: {
        min: 0,
        isDecimal: true,
      },
    },
    message: {
      type: DataTypes.TEXT,
      allowNull: false,
      validate: {
        len: [10, 1000],
        notEmpty: true,
      },
    },
    availability: {
      type: DataTypes.STRING(200),
      allowNull: false,
      validate: {
        len: [1, 200],
        notEmpty: true,
      },
    },
    estimatedDuration: {
      type: DataTypes.STRING(100),
      defaultValue: null,
    },
    includesSupplies: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    warranty: {
      type: DataTypes.JSON,
      defaultValue: {
        offered: false,
        duration: null,
        terms: null,
      },
    },
    status: {
      type: DataTypes.ENUM('pending', 'accepted', 'rejected', 'withdrawn', 'expired'),
      defaultValue: 'pending',
    },
    statusReason: {
      type: DataTypes.TEXT,
      defaultValue: null,
    },
    acceptedAt: {
      type: DataTypes.DATE,
      defaultValue: null,
    },
    rejectedAt: {
      type: DataTypes.DATE,
      defaultValue: null,
    },
    withdrawnAt: {
      type: DataTypes.DATE,
      defaultValue: null,
    },
    expiresAt: {
      type: DataTypes.DATE,
      defaultValue: () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
    responseTime: {
      type: DataTypes.DECIMAL(8, 2),
      defaultValue: 0,
      comment: 'Time in hours from request creation to offer submission'
    },
    revisionCount: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    originalOfferId: {
      type: DataTypes.UUID,
      defaultValue: null,
      references: {
        model: 'service_offers',
        key: 'id',
      },
      onDelete: 'SET NULL',
    },
    negotiationHistory: {
      type: DataTypes.JSON,
      defaultValue: [],
    },
    attachments: {
      type: DataTypes.JSON,
      defaultValue: [],
    },
    storeRating: {
      type: DataTypes.DECIMAL(3, 2),
      defaultValue: null,
      validate: {
        min: 0,
        max: 5
      }
    },
    storeReviewCount: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    viewedByCustomer: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    viewedAt: {
      type: DataTypes.DATE,
      defaultValue: null
    },
    customerResponseTime: {
      type: DataTypes.DECIMAL(8, 2),
      defaultValue: null,
      comment: 'Time in hours from offer creation to customer response'
    }
  }, {
    tableName: 'service_offers',
    timestamps: true,
    indexes: [
      // Foreign key indexes
      {
        fields: ['requestId'],
        name: 'idx_service_offers_request_id'
      },
      {
        fields: ['storeId'],
        name: 'idx_service_offers_store_id'
      },
      {
        fields: ['providerId'],
        name: 'idx_service_offers_provider_id'
      },
      // Composite index for store's offers filtered by status and sorted by date
      {
        fields: ['storeId', 'status', 'createdAt'],
        name: 'idx_service_offers_store_status_created'
      },
      // Composite index for cleaning up expired offers
      {
        fields: ['status', 'expiresAt'],
        name: 'idx_service_offers_status_expires'
      }
    ]
  });

  ServiceOffer.associate = (models) => {
    ServiceOffer.belongsTo(models.ServiceRequest, {
      foreignKey: 'requestId',
      as: 'request',
      onDelete: 'CASCADE',
    });

    ServiceOffer.belongsTo(models.Store, {
      foreignKey: 'storeId',
      as: 'store',
      onDelete: 'CASCADE',
    });

    ServiceOffer.belongsTo(models.Merchant, {
      foreignKey: 'providerId',
      as: 'provider',
      onDelete: 'CASCADE',
    });

    ServiceOffer.belongsTo(models.ServiceOffer, {
      foreignKey: 'originalOfferId',
      as: 'originalOffer',
      onDelete: 'SET NULL',
    });

    ServiceOffer.hasMany(models.ServiceOffer, {
      foreignKey: 'originalOfferId',
      as: 'revisions',
      onDelete: 'SET NULL',
    });
  };

  ServiceOffer.prototype.calculateResponseTime = function() {
    if (this.request && this.request.createdAt) {
      const requestTime = new Date(this.request.createdAt);
      const offerTime = new Date(this.createdAt);
      const diffInHours = (offerTime - requestTime) / (1000 * 60 * 60);
      this.responseTime = Math.round(diffInHours * 100) / 100;
      return this.responseTime;
    }
    return 0;
  };

  ServiceOffer.prototype.canBeModified = function() {
    return this.status === 'pending' && new Date() < new Date(this.expiresAt);
  };

  ServiceOffer.prototype.isWithinBudget = function() {
    if (!this.request) return false;
    const price = parseFloat(this.quotedPrice);
    return price >= this.request.budgetMin && price <= this.request.budgetMax;
  };

  ServiceOffer.prototype.validateStoreCategory = async function() {
    if (!this.store || !this.request) return false;
    return this.store.category === this.request.category;
  };

  ServiceOffer.prototype.withdraw = async function(reason = null) {
    if (this.status !== 'pending') {
      throw new Error('Only pending offers can be withdrawn');
    }

    await this.update({
      status: 'withdrawn',
      withdrawnAt: new Date(),
      statusReason: reason
    });

    return this;
  };

  ServiceOffer.prototype.accept = async function() {
    if (this.status !== 'pending') {
      throw new Error('Only pending offers can be accepted');
    }

    const transaction = await sequelize.transaction();

    try {
      await this.update({
        status: 'accepted',
        acceptedAt: new Date(),
        customerResponseTime: this.calculateCustomerResponseTime()
      }, { transaction });

      if (this.request) {
        await this.request.update({
          status: 'in_progress',
          acceptedOfferId: this.id
        }, { transaction });
      }

      await ServiceOffer.update({
        status: 'rejected',
        rejectedAt: new Date(),
        statusReason: 'Another offer was accepted'
      }, {
        where: {
          requestId: this.requestId,
          id: { [sequelize.Op.ne]: this.id },
          status: 'pending'
        },
        transaction
      });

      await transaction.commit();
      return this;
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  };

  ServiceOffer.prototype.reject = async function(reason = null) {
    if (this.status !== 'pending') {
      throw new Error('Only pending offers can be rejected');
    }

    await this.update({
      status: 'rejected',
      rejectedAt: new Date(),
      statusReason: reason,
      customerResponseTime: this.calculateCustomerResponseTime()
    });

    return this;
  };

  ServiceOffer.prototype.calculateCustomerResponseTime = function() {
    const now = new Date();
    const offerTime = new Date(this.createdAt);
    const diffInHours = (now - offerTime) / (1000 * 60 * 60);
    return Math.round(diffInHours * 100) / 100;
  };

  ServiceOffer.prototype.markAsViewed = async function() {
    if (!this.viewedByCustomer) {
      await this.update({
        viewedByCustomer: true,
        viewedAt: new Date()
      });
    }
    return this;
  };

  ServiceOffer.getOffersByStore = async function(storeId, options = {}) {
    const { status, page = 1, limit = 10 } = options;
    const whereClause = { storeId };
    
    if (status && status !== 'all') {
      whereClause.status = status;
    }

    const offset = (page - 1) * limit;

    return await this.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: sequelize.models.ServiceRequest,
          as: 'request',
          attributes: ['id', 'title', 'category', 'budgetMin', 'budgetMax', 'location', 'timeline'],
          include: [{
            model: sequelize.models.User,
            as: 'postedByUser',
            attributes: ['id', 'firstName', 'lastName', 'avatar']
          }]
        },
        {
          model: sequelize.models.Store,
          as: 'store',
          attributes: ['id', 'name', 'category', 'rating', 'logo_url']
        }
      ],
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
  };

  ServiceOffer.getOffersByMerchant = async function(merchantId, options = {}) {
    const { status, page = 1, limit = 10 } = options;
    
    const stores = await sequelize.models.Store.findAll({
      where: { merchant_id: merchantId },
      attributes: ['id']
    });
    
    const storeIds = stores.map(store => store.id);
    
    if (storeIds.length === 0) {
      return { count: 0, rows: [] };
    }
    
    const whereClause = { storeId: { [sequelize.Op.in]: storeIds } };
    
    if (status && status !== 'all') {
      whereClause.status = status;
    }

    const offset = (page - 1) * limit;

    return await this.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: sequelize.models.ServiceRequest,
          as: 'request',
          attributes: ['id', 'title', 'category', 'budgetMin', 'budgetMax', 'location', 'timeline'],
          include: [{
            model: sequelize.models.User,
            as: 'postedByUser',
            attributes: ['id', 'firstName', 'lastName', 'avatar']
          }]
        },
        {
          model: sequelize.models.Store,
          as: 'store',
          attributes: ['id', 'name', 'category', 'rating', 'logo_url']
        }
      ],
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
  };

  ServiceOffer.getOffersForRequest = async function(requestId) {
    return await this.findAll({
      where: { requestId },
      include: [
        {
          model: sequelize.models.Store,
          as: 'store',
          attributes: ['id', 'name', 'category', 'rating', 'logo_url', 'location', 'description']
        },
        {
          model: sequelize.models.Merchant,
          as: 'provider',
          attributes: ['id', 'firstName', 'lastName', 'avatar', 'emailVerified', 'phoneVerified']
        }
      ],
      order: [['createdAt', 'ASC']]
    });
  };

  ServiceOffer.hasStoreOffered = async function(requestId, storeId) {
    const existingOffer = await this.findOne({
      where: { requestId, storeId }
    });
    return !!existingOffer;
  };

  ServiceOffer.getStorePerformanceMetrics = async function(storeId, period = '30d') {
    const daysBack = period === '7d' ? 7 : period === '90d' ? 90 : 30;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysBack);

    const [
      totalOffers,
      acceptedOffers,
      averageResponseTime,
      averageQuoteAmount
    ] = await Promise.all([
      this.count({
        where: {
          storeId,
          createdAt: { [sequelize.Op.gte]: startDate }
        }
      }),
      this.count({
        where: {
          storeId,
          status: 'accepted',
          createdAt: { [sequelize.Op.gte]: startDate }
        }
      }),
      this.findOne({
        where: {
          storeId,
          createdAt: { [sequelize.Op.gte]: startDate }
        },
        attributes: [
          [sequelize.fn('AVG', sequelize.col('responseTime')), 'avgResponseTime']
        ],
        raw: true
      }),
      this.findOne({
        where: {
          storeId,
          createdAt: { [sequelize.Op.gte]: startDate }
        },
        attributes: [
          [sequelize.fn('AVG', sequelize.col('quotedPrice')), 'avgQuoteAmount']
        ],
        raw: true
      })
    ]);

    const acceptanceRate = totalOffers > 0 ? (acceptedOffers / totalOffers) * 100 : 0;

    return {
      period,
      totalOffers,
      acceptedOffers,
      acceptanceRate: Math.round(acceptanceRate * 100) / 100,
      averageResponseTime: Math.round((averageResponseTime?.avgResponseTime || 0) * 100) / 100,
      averageQuoteAmount: Math.round((averageQuoteAmount?.avgQuoteAmount || 0) * 100) / 100
    };
  };

  ServiceOffer.cleanupExpiredOffers = async function() {
    const expiredCount = await this.update(
      { status: 'expired' },
      {
        where: {
          status: 'pending',
          expiresAt: { [sequelize.Op.lt]: new Date() }
        }
      }
    );

    console.log(`✅ Marked ${expiredCount[0]} offers as expired`);
    return expiredCount[0];
  };

  return ServiceOffer;
};
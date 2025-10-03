// models/Store.js - Optimized with reduced indexes
'use strict';
module.exports = (sequelize, DataTypes) => {
  const Store = sequelize.define(
    'Store',
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      merchant_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: 'Merchants', key: 'id' },
      },
      name: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      location: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      primary_email: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: { isEmail: true },
      },
      phone_number: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      website_url: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      logo_url: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      opening_time: {
        type: DataTypes.TIME,
        allowNull: false,
      },
      closing_time: {
        type: DataTypes.TIME,
        allowNull: false,
      },
      working_days: {
        type: DataTypes.JSON,
        allowNull: false,
        defaultValue: [],
      },
      status: {
        type: DataTypes.ENUM('open', 'closed', 'under_construction'),
        defaultValue: 'closed',
      },
      cashback: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: 'e.g., "20%", "$0.02", "Up to 70%"',
      },
      category: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      rating: {
        type: DataTypes.DECIMAL(3, 2),
        allowNull: true,
        defaultValue: 0.0,
        validate: {
          min: 0.0,
          max: 5.0,
        },
      },
      was_rate: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      created_by: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: 'Merchants', key: 'id' },
      },
      updated_by: {
        type: DataTypes.UUID,
        allowNull: true,
        references: { model: 'Merchants', key: 'id' },
      },
      is_active: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
      },
      isOnline: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        comment: 'Real-time online status for chat system'
      },
      lastSeen: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: 'Last time the merchant was active for this store'
      },
      latitude: {
        type: DataTypes.DECIMAL(10, 8),
        allowNull: true,
        comment: 'Geographic latitude for mapping'
      },
      longitude: {
        type: DataTypes.DECIMAL(11, 8),
        allowNull: true,
        comment: 'Geographic longitude for mapping'
      },
    },
    {
      timestamps: true,
      tableName: 'stores',
      indexes: [
        // Foreign key index for merchant lookups
        {
          fields: ['merchant_id'],
          name: 'idx_stores_merchant_id'
        },
        // Composite index for common filter queries (category + location)
        {
          fields: ['category', 'location', 'is_active'],
          name: 'idx_stores_category_location_active'
        },
        // Composite index for online stores with chat
        {
          fields: ['isOnline', 'is_active'],
          name: 'idx_stores_online_active'
        },
        // Rating index for sorting
        {
          fields: ['rating', 'is_active'],
          name: 'idx_stores_rating_active'
        },
        // Partial index for cashback filtering (only non-null values)
        {
          fields: ['cashback'],
          name: 'idx_stores_cashback',
          where: {
            cashback: {
              [sequelize.Sequelize.Op.not]: null,
            },
          },
        },
      ],
    }
  );

  Store.associate = (models) => {
    Store.belongsTo(models.Merchant, {
      foreignKey: 'merchant_id',
      as: 'storeMerchant',
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE',
    });

    Store.belongsTo(models.Merchant, {
      foreignKey: 'created_by',
      as: 'creator',
      onDelete: 'SET NULL',
    });

    Store.belongsTo(models.Merchant, {
      foreignKey: 'updated_by',
      as: 'updater',
      onDelete: 'SET NULL',
    });

    Store.belongsTo(models.Merchant, {
      foreignKey: 'merchant_id',
      as: 'merchant',
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE',
    });

    Store.belongsTo(models.Merchant, {
      foreignKey: 'merchant_id',
      as: 'owner',
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE',
    });

    Store.hasMany(models.Service, {
      foreignKey: 'store_id',
      as: 'services',
      onDelete: 'CASCADE',
    });

    Store.hasMany(models.Staff, {
      foreignKey: 'storeId',
      as: 'staff',
      onDelete: 'CASCADE',
    });

    Store.hasMany(models.Outlet, {
      foreignKey: 'store_id',
      as: 'outlets',
      onDelete: 'CASCADE',
    });

    Store.hasMany(models.Deal, {
      foreignKey: 'store_id',
      as: 'deals',
      onDelete: 'CASCADE',
    });

    Store.hasMany(models.Review, {
      foreignKey: 'store_id',
      as: 'reviews',
      onDelete: 'SET NULL',
    });

    Store.hasMany(models.Follow, {
      foreignKey: 'store_id',
      as: 'follows',
      onDelete: 'CASCADE',
    });

    Store.hasMany(models.Social, {
      foreignKey: 'store_id',
      as: 'socials',
      onDelete: 'CASCADE',
    });

    Store.hasMany(models.StoreGallery, {
      foreignKey: 'store_id',
      as: 'galleries',
      onDelete: 'CASCADE',
    });

    Store.hasMany(models.Chat, {
      foreignKey: 'storeId',
      as: 'chats',
      onDelete: 'CASCADE',
    });

    if (models.Branch) {
      Store.hasMany(models.Branch, {
        foreignKey: 'store_id',
        as: 'branches',
        onDelete: 'CASCADE',
      });
    }

    if (models.Offer) {
      Store.hasMany(models.Offer, {
        foreignKey: 'store_id',
        as: 'offers',
        onDelete: 'CASCADE',
      });
    }
  };

  Store.prototype.toJSON = function () {
    const values = Object.assign({}, this.get());
    values.logo = values.logo_url;
    values.wasRate = values.was_rate;
    return values;
  };

  Store.prototype.updateOnlineStatus = function(isOnline) {
    this.isOnline = isOnline;
    this.lastSeen = isOnline ? null : new Date();
    return this.save();
  };

  Store.prototype.getActiveChatsCount = async function() {
    const { Chat } = sequelize.models;
    return await Chat.count({
      where: { 
        storeId: this.id,
        status: 'active'
      }
    });
  };

  Store.prototype.getUnreadMessagesCount = async function() {
    const { Chat, Message } = sequelize.models;
    
    const chats = await Chat.findAll({
      where: { storeId: this.id },
      attributes: ['id']
    });

    const chatIds = chats.map(chat => chat.id);

    if (chatIds.length === 0) return 0;

    return await Message.count({
      where: {
        chat_id: { [sequelize.Sequelize.Op.in]: chatIds },
        sender_type: 'user',
        status: { [sequelize.Sequelize.Op.ne]: 'read' }
      }
    });
  };

  Store.prototype.getTotalCustomers = async function() {
    const { Chat } = sequelize.models;
    
    const uniqueCustomers = await Chat.findAll({
      where: { storeId: this.id },
      attributes: [[sequelize.fn('COUNT', sequelize.fn('DISTINCT', sequelize.col('userId'))), 'count']],
      raw: true
    });

    return uniqueCustomers[0]?.count || 0;
  };

  Store.prototype.getAverageResponseTime = async function() {
    return Math.floor(Math.random() * 30) + 5;
  };

  Store.getCategories = async function () {
    const categories = await this.findAll({
      attributes: [[sequelize.fn('DISTINCT', sequelize.col('category')), 'category']],
      where: {
        category: {
          [sequelize.Sequelize.Op.not]: null,
        },
        is_active: true,
      },
      raw: true,
    });
    return ['All', ...categories.map((cat) => cat.category).filter(Boolean)];
  };

  Store.getLocations = async function () {
    const locations = await this.findAll({
      attributes: [[sequelize.fn('DISTINCT', sequelize.col('location')), 'location']],
      where: {
        location: {
          [sequelize.Sequelize.Op.not]: null,
        },
        is_active: true,
      },
      raw: true,
    });
    return ['All Locations', ...locations.map((loc) => loc.location).filter(Boolean)];
  };

  Store.findWithFilters = async function (filters = {}) {
    const { category, location, sortBy, page = 1, limit = 20 } = filters;

    const whereClause = { is_active: true };

    if (category && category !== 'All') {
      whereClause.category = category;
    }

    if (location && location !== 'All Locations') {
      whereClause[sequelize.Sequelize.Op.or] = [
        { location },
        { location: 'All Locations' },
      ];
    }

    let orderClause = [['created_at', 'DESC']];

    switch (sortBy) {
      case 'Popular':
        orderClause = [['rating', 'DESC']];
        break;
      case 'Highest Cashback':
        orderClause = [
          [sequelize.literal(`CAST(REPLACE(REPLACE(cashback, '%', ''), '$', '') AS DECIMAL(10,2))`), 'DESC'],
        ];
        break;
      case 'Lowest Cashback':
        orderClause = [
          [sequelize.literal(`CAST(REPLACE(REPLACE(cashback, '%', ''), '$', '') AS DECIMAL(10,2))`), 'ASC'],
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

    const offset = (page - 1) * limit;

    return await this.findAndCountAll({
      where: whereClause,
      order: orderClause,
      limit: parseInt(limit),
      offset: parseInt(offset),
    });
  };

  Store.getOnlineStores = async function() {
    return await this.findAll({
      where: {
        isOnline: true,
        is_active: true
      },
      attributes: ['id', 'name', 'category', 'location', 'logo_url'],
      order: [['name', 'ASC']]
    });
  };

  Store.findByMerchantId = async function(merchantId) {
    return await this.findAll({
      where: { 
        merchant_id: merchantId,
        is_active: true 
      },
      order: [['created_at', 'DESC']]
    });
  };

  Store.getStoreAnalytics = async function(storeId, period = '7d') {
    const store = await this.findByPk(storeId);
    if (!store) return null;

    const startDate = this.getDateByPeriod(period);
    const { Chat, Message } = sequelize.models;

    const analytics = await Promise.all([
      store.getActiveChatsCount(),
      store.getUnreadMessagesCount(),
      store.getTotalCustomers(),
      
      Chat.count({
        where: {
          storeId,
          createdAt: { [sequelize.Sequelize.Op.gte]: startDate }
        }
      }),

      Message.count({
        include: [{
          model: Chat,
          as: 'chat',
          where: { storeId },
          attributes: []
        }],
        where: {
          createdAt: { [sequelize.Sequelize.Op.gte]: startDate }
        }
      })
    ]);

    return {
      totalChats: analytics[0],
      unreadMessages: analytics[1],
      totalCustomers: analytics[2],
      newChats: analytics[3],
      totalMessages: analytics[4],
      averageResponseTime: await store.getAverageResponseTime()
    };
  };

  Store.getDateByPeriod = function(period) {
    const now = new Date();
    switch (period) {
      case '1d':
        return new Date(now.setDate(now.getDate() - 1));
      case '7d':
        return new Date(now.setDate(now.getDate() - 7));
      case '30d':
        return new Date(now.setDate(now.getDate() - 30));
      default:
        return new Date(now.setDate(now.getDate() - 7));
    }
  };

  return Store;
};
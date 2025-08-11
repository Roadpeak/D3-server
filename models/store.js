// models/Store.js - Updated with Chat System integration and your existing structure
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
        references: { model: 'merchants', key: 'id' },
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
        references: { model: 'merchants', key: 'id' },
      },
      updated_by: {
        type: DataTypes.UUID,
        allowNull: true,
        references: { model: 'merchants', key: 'id' },
      },
      is_active: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
      },
      // NEW FIELDS FOR CHAT SYSTEM
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
      tableName: 'stores', // Changed to lowercase for consistency
      indexes: [
        { fields: ['category'] },
        { fields: ['location'] },
        { fields: ['rating'] },
        { fields: ['category', 'location'] },
        { fields: ['merchant_id'] }, // Added for chat system
        { fields: ['isOnline'] }, // Added for chat system
        {
          fields: ['cashback'],
          where: {
            cashback: {
              [sequelize.Sequelize.Op.not]: null,
            },
          },
        },
      ],
    }
  );

  // ENHANCED ASSOCIATIONS (keeping your existing ones + chat system)
  Store.associate = (models) => {
    // Your existing Merchant associations
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

    // ENHANCED: Additional associations for chat system compatibility
    // If your Merchant model has a User association, this provides backward compatibility
    Store.belongsTo(models.Merchant, {
      foreignKey: 'merchant_id',
      as: 'merchant', // Alternative alias for chat system
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE',
    });

    Store.belongsTo(models.Merchant, {
      foreignKey: 'merchant_id',
      as: 'owner', // Alternative alias for chat system
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE',
    });

    // Your existing associations
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

    // NEW: Chat system associations
    Store.hasMany(models.Chat, {
      foreignKey: 'storeId',
      as: 'chats',
      onDelete: 'CASCADE',
    });

    // NEW: Branch/Outlet association for enhanced mapping
    if (models.Branch) {
      Store.hasMany(models.Branch, {
        foreignKey: 'store_id',
        as: 'branches',
        onDelete: 'CASCADE',
      });
    }

    // NEW: Offer association if exists
    if (models.Offer) {
      Store.hasMany(models.Offer, {
        foreignKey: 'store_id',
        as: 'offers',
        onDelete: 'CASCADE',
      });
    }
  };

  // ENHANCED INSTANCE METHODS (keeping your existing + chat system)
  Store.prototype.toJSON = function () {
    const values = Object.assign({}, this.get());
    values.logo = values.logo_url;
    values.wasRate = values.was_rate;
    return values;
  };

  // NEW: Chat system instance methods
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
        chat_id: { [sequelize.Op.in]: chatIds },
        sender_type: 'user', // Messages from customers
        status: { [sequelize.Op.ne]: 'read' }
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
    // This would require more complex logic to track response times
    // For now, return a mock value - implement based on your needs
    return Math.floor(Math.random() * 30) + 5; // 5-35 minutes
  };

  // ENHANCED CLASS METHODS (keeping your existing + new ones)
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

  // NEW: Chat system specific methods
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
      
      // New chats in period
      Chat.count({
        where: {
          storeId,
          createdAt: { [sequelize.Op.gte]: startDate }
        }
      }),

      // Total messages in period
      Message.count({
        include: [{
          model: Chat,
          as: 'chat',
          where: { storeId },
          attributes: []
        }],
        where: {
          createdAt: { [sequelize.Op.gte]: startDate }
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
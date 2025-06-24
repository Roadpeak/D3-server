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
        references: {
          model: 'Merchants',
          key: 'id',
        },
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
        validate: {
          isEmail: true,
        },
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
      // New fields for frontend compatibility
      cashback: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: 'Cashback percentage or amount (e.g., "20%", "$0.02", "Up to 70%")',
      },
      category: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: 'Store category (e.g., "Fashion & Clothing", "Electronics", "Beauty")',
      },
      rating: {
        type: DataTypes.DECIMAL(3, 2),
        allowNull: true,
        defaultValue: 0.0,
        validate: {
          min: 0.0,
          max: 5.0,
        },
        comment: 'Store rating from 0.0 to 5.0',
      },
      was_rate: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: 'Previous cashback rate for comparison (e.g., "Was 1%")',
      },
      created_by: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: 'Merchants', 
          key: 'id',
        },
      },
      updated_by: {
        type: DataTypes.UUID,
        allowNull: true,
        references: {
          model: 'Merchants',
          key: 'id',
        },
      },
      is_active: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
      },
    },
    {
      timestamps: true,
      tableName: 'Stores',
      indexes: [
        // Index for category filtering
        {
          fields: ['category'],
        },
        // Index for location filtering
        {
          fields: ['location'],
        },
        // Index for rating sorting
        {
          fields: ['rating'],
        },
        // Composite index for common filter combinations
        {
          fields: ['category', 'location'],
        },
        // Index for cashback sorting (partial index for non-null values)
        {
          fields: ['cashback'],
          where: {
            cashback: {
              [sequelize.Sequelize.Op.not]: null
            }
          }
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

    Store.hasMany(models.Social, {
      foreignKey: 'store_id',
      onDelete: 'CASCADE',
    });

    Store.hasMany(models.StoreGallery, {
      foreignKey: 'store_id',
      onDelete: 'CASCADE',
    });

    Store.hasMany(models.Review, {
      foreignKey: 'store_id',
      onDelete: 'SET NULL',
    });

    // New association for follows
    Store.hasMany(models.Follow, {
      foreignKey: 'store_id',
      onDelete: 'CASCADE',
    });
  };

  // Instance methods for frontend compatibility
  Store.prototype.toJSON = function() {
    const values = Object.assign({}, this.get());
    
    // Add computed properties for frontend
    values.logo = values.logo_url;
    values.wasRate = values.was_rate;
    
    return values;
  };

  // Class methods for common queries
  Store.getCategories = async function() {
    const categories = await this.findAll({
      attributes: [[sequelize.fn('DISTINCT', sequelize.col('category')), 'category']],
      where: {
        category: {
          [sequelize.Sequelize.Op.not]: null
        },
        is_active: true
      },
      raw: true
    });
    
    return ['All', ...categories.map(cat => cat.category).filter(Boolean)];
  };

  Store.getLocations = async function() {
    const locations = await this.findAll({
      attributes: [[sequelize.fn('DISTINCT', sequelize.col('location')), 'location']],
      where: {
        location: {
          [sequelize.Sequelize.Op.not]: null
        },
        is_active: true
      },
      raw: true
    });
    
    return ['All Locations', ...locations.map(loc => loc.location).filter(Boolean)];
  };

  Store.findWithFilters = async function(filters = {}) {
    const { category, location, sortBy, page = 1, limit = 20 } = filters;
    
    // Build where clause
    const whereClause = { is_active: true };
    
    if (category && category !== 'All') {
      whereClause.category = category;
    }
    
    if (location && location !== 'All Locations') {
      whereClause[sequelize.Sequelize.Op.or] = [
        { location: location },
        { location: 'All Locations' }
      ];
    }

    // Build order clause
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

  return Store;
};
// models/Store.js - Updated with Staff association
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
    },
    {
      timestamps: true,
      tableName: 'stores', // Changed to lowercase for consistency
      indexes: [
        { fields: ['category'] },
        { fields: ['location'] },
        { fields: ['rating'] },
        { fields: ['category', 'location'] },
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

  // ASSOCIATIONS
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

    Store.hasMany(models.Service, {
      foreignKey: 'store_id',
      as: 'services',
      onDelete: 'CASCADE',
    });

    // Add Staff association - Store has many Staff
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

    // Add Chat association
    Store.hasMany(models.Chat, {
      foreignKey: 'storeId',
      as: 'chats',
      onDelete: 'CASCADE',
    });
  };

  // INSTANCE METHODS
  Store.prototype.toJSON = function () {
    const values = Object.assign({}, this.get());
    values.logo = values.logo_url;
    values.wasRate = values.was_rate;
    return values;
  };

  // CLASS METHODS (keeping your existing methods)
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

  return Store;
};
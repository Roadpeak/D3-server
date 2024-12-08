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
      created_by: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: 'Merchants', // Correct table name
          key: 'id',
        },
      },
      updated_by: {
        type: DataTypes.UUID,
        allowNull: true,
        references: {
          model: 'Merchants', // Correct table name
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
    }
  );

  Store.associate = (models) => {
    Store.belongsTo(models.Merchant, {
      foreignKey: 'merchant_id',
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
  };
  return Store;
};

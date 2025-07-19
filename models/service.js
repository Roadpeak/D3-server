// models/Service.js - Fixed version with correct association placement

'use strict';

module.exports = (sequelize, DataTypes) => {
  const Service = sequelize.define('Service', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    price: {
      type: DataTypes.FLOAT,
      allowNull: true,
    },
    duration: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    image_url: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    store_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'stores',
        key: 'id',
      },
    },
    category: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    type: {
      type: DataTypes.ENUM('fixed', 'dynamic'),
      allowNull: false,
      defaultValue: 'fixed',
    },
  }, {
    tableName: 'services',
    timestamps: true,
    paranoid: true,
    indexes: [
      {
        fields: ['store_id'],
        name: 'services_store_id_index'
      },
      {
        fields: ['category'],
        name: 'services_category_index'
      },
      {
        fields: ['type'],
        name: 'services_type_index'
      }
    ],
  });

  // IMPORTANT: All associations must be inside this function
  Service.associate = (models) => {
    // Many-to-Many relationship with Staff through StaffService
    Service.belongsToMany(models.Staff, {
      through: models.StaffService,
      foreignKey: 'serviceId',
      otherKey: 'staffId',
      as: 'staff',
    });

    // Service belongs to a Store (many-to-one)
    Service.belongsTo(models.Store, {
      foreignKey: 'store_id',
      as: 'store',
      onDelete: 'CASCADE',
    });

    // ADD THIS INSIDE THE ASSOCIATE FUNCTION:
    // Service has many Offers (one-to-many)
    Service.hasMany(models.Offer, {
      foreignKey: 'service_id',
      as: 'offers',
      onDelete: 'CASCADE',
    });

    // If you have other associations, add them here too
    // Service.hasMany(models.Booking, {
    //   foreignKey: 'service_id',
    //   as: 'bookings',
    //   onDelete: 'CASCADE',
    // });
  };

  return Service;
};
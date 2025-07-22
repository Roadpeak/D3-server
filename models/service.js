// models/Service.js - Updated with concurrent bookings capacity

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
      comment: 'Duration in minutes'
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
    // NEW FIELD: Maximum concurrent bookings per slot
    max_concurrent_bookings: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
      validate: {
        min: 1,
        max: 50 // Reasonable upper limit
      },
      comment: 'Maximum number of bookings that can be scheduled at the same time slot'
    },
    // NEW FIELD: Whether to allow overbooking
    allow_overbooking: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      comment: 'Whether to allow bookings beyond max_concurrent_bookings'
    },
    // NEW FIELD: Slot interval (optional - defaults to duration)
    slot_interval: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: 'Time between slots in minutes (defaults to duration if null)'
    },
    // NEW FIELD: Buffer time between bookings
    buffer_time: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      comment: 'Buffer time in minutes between consecutive bookings'
    },
    // NEW FIELD: Advance booking settings
    min_advance_booking: {
      type: DataTypes.INTEGER,
      defaultValue: 30,
      comment: 'Minimum minutes in advance that booking can be made'
    },
    max_advance_booking: {
      type: DataTypes.INTEGER,
      defaultValue: 10080, // 7 days in minutes
      comment: 'Maximum minutes in advance that booking can be made'
    },
    // Service status
    status: {
      type: DataTypes.ENUM('active', 'inactive', 'suspended'),
      defaultValue: 'active',
    },
    // Booking settings
    booking_enabled: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      comment: 'Whether booking is enabled for this service'
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
      },
      {
        fields: ['status'],
        name: 'services_status_index'
      },
      {
        fields: ['booking_enabled'],
        name: 'services_booking_enabled_index'
      }
    ],
    hooks: {
      beforeValidate: (service) => {
        // Set slot_interval to duration if not specified
        if (!service.slot_interval && service.duration) {
          service.slot_interval = service.duration;
        }
      }
    }
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

    // Service has many Offers (one-to-many)
    Service.hasMany(models.Offer, {
      foreignKey: 'service_id',
      as: 'offers',
      onDelete: 'CASCADE',
    });

    // Service has many Bookings (one-to-many)
    Service.hasMany(models.Booking, {
      foreignKey: 'serviceId', // Note: using serviceId to match booking model
      as: 'bookings',
      onDelete: 'CASCADE',
    });
  };

  // Instance methods
  Service.prototype.getSlotInterval = function() {
    return this.slot_interval || this.duration || 60; // Default to 60 minutes
  };

  Service.prototype.getMaxConcurrentBookings = function() {
    return this.max_concurrent_bookings || 1;
  };

  Service.prototype.canAcceptBooking = function(advanceMinutes) {
    if (!this.booking_enabled) return false;
    if (advanceMinutes < this.min_advance_booking) return false;
    if (advanceMinutes > this.max_advance_booking) return false;
    return true;
  };

  return Service;
};
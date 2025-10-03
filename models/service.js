// models/Service.js - Optimized with reduced indexes

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
    images: {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: [],
      comment: 'Array of image URLs (max 3 images)',
      validate: {
        isValidImageArray(value) {
          if (value && Array.isArray(value) && value.length > 3) {
            throw new Error('Maximum 3 images allowed');
          }
        }
      }
    },
    image_url: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'Primary image URL (for backward compatibility)'
    },
    store_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'stores',
        key: 'id',
      },
    },
    branch_id: {
      type: DataTypes.UUID,
      allowNull: true,
      field: 'branch_id',
      references: {
        model: 'branches',
        key: 'id',
      },
      comment: 'Specific branch where service is offered'
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
    pricing_factors: {
      type: DataTypes.JSON,
      allowNull: true,
      comment: 'Factors that determine pricing for dynamic services'
    },
    price_range: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'Estimated price range for dynamic services'
    },
    consultation_required: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      comment: 'Whether consultation is required before service delivery'
    },
    auto_confirm_bookings: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      comment: 'Whether to automatically confirm bookings or require manual confirmation'
    },
    confirmation_message: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Custom message sent to clients when booking is confirmed'
    },
    require_prepayment: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      comment: 'Whether prepayment is required before confirmation'
    },
    cancellation_policy: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Cancellation policy for this service'
    },
    min_cancellation_hours: {
      type: DataTypes.INTEGER,
      defaultValue: 2,
      comment: 'Minimum hours before appointment that cancellation is allowed'
    },
    allow_early_checkin: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      comment: 'Whether clients can check in before their scheduled time'
    },
    early_checkin_minutes: {
      type: DataTypes.INTEGER,
      defaultValue: 15,
      comment: 'How many minutes early a client can check in'
    },
    auto_complete_on_duration: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      comment: 'Whether to automatically mark booking as complete after service duration'
    },
    grace_period_minutes: {
      type: DataTypes.INTEGER,
      defaultValue: 10,
      comment: 'Grace period after scheduled time before marking as no-show'
    },
    max_concurrent_bookings: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
      validate: {
        min: 1,
        max: 50
      },
      comment: 'Maximum number of bookings at the same time slot'
    },
    allow_overbooking: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      comment: 'Whether to allow bookings beyond max_concurrent_bookings'
    },
    slot_interval: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: 'Time between slots in minutes'
    },
    blackout_dates: {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: [],
      comment: 'Array of blackout dates/periods for this service'
    },
    min_advance_booking: {
      type: DataTypes.INTEGER,
      defaultValue: 30,
      comment: 'Minimum minutes in advance that booking can be made'
    },
    max_advance_booking: {
      type: DataTypes.INTEGER,
      defaultValue: 10080,
      comment: 'Maximum minutes in advance that booking can be made'
    },
    buffer_time: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      comment: 'Buffer time in minutes between consecutive bookings'
    },
    status: {
      type: DataTypes.ENUM('active', 'inactive', 'suspended'),
      defaultValue: 'active',
    },
    booking_enabled: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      comment: 'Whether booking is enabled for this service'
    },
    tags: {
      type: DataTypes.JSON,
      allowNull: true,
      comment: 'Tags for better searchability'
    },
    featured: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      comment: 'Whether service should be featured'
    }
  }, {
    tableName: 'services',
    timestamps: true,
    paranoid: true,
    underscored: false,
    indexes: [
      // Foreign key indexes
      {
        fields: ['store_id'],
        name: 'idx_services_store_id'
      },
      {
        fields: ['branch_id'],
        name: 'idx_services_branch_id'
      },
      // Composite index for filtering available services
      {
        fields: ['status', 'booking_enabled'],
        name: 'idx_services_status_booking'
      },
      // Composite index for store's active services by category
      {
        fields: ['store_id', 'category', 'status'],
        name: 'idx_services_store_category_status'
      },
      // Featured services
      {
        fields: ['featured', 'status'],
        name: 'idx_services_featured_status'
      }
    ],
    hooks: {
      beforeValidate: (service) => {
        if (!service.slot_interval && service.duration && service.type === 'fixed') {
          service.slot_interval = service.duration;
        }
        
        if (!service.slot_interval && service.type === 'dynamic') {
          service.slot_interval = 60;
        }
        
        if (service.images && service.images.length > 0 && !service.image_url) {
          service.image_url = service.images[0];
        }
        
        if (service.auto_confirm_bookings && !service.confirmation_message) {
          service.confirmation_message = `Your booking for ${service.name} has been automatically confirmed. We look forward to serving you!`;
        }
      },
      beforeUpdate: (service) => {
        if (service.changed('images') && service.images && service.images.length > 0) {
          service.image_url = service.images[0];
        }
      }
    }
  });

  Service.associate = (models) => {
    Service.belongsToMany(models.Staff, {
      through: models.StaffService,
      foreignKey: 'serviceId',
      otherKey: 'staffId',
      as: 'staff',
    });

    Service.belongsTo(models.Store, {
      foreignKey: 'store_id',
      as: 'store',
      onDelete: 'CASCADE',
    });

    if (models.Branch) {
      Service.belongsTo(models.Branch, {
        foreignKey: 'branch_id',
        as: 'branch',
        onDelete: 'SET NULL',
      });
    }

    Service.hasMany(models.Offer, {
      foreignKey: 'service_id',
      as: 'offers',
      onDelete: 'CASCADE',
    });

    Service.hasMany(models.Booking, {
      foreignKey: 'serviceId',
      as: 'Bookings',
      onDelete: 'CASCADE',
    });
  };

  Service.prototype.getSlotInterval = function() {
    return this.slot_interval || this.duration || 60;
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

  Service.prototype.shouldAutoConfirm = function() {
    return this.auto_confirm_bookings === true;
  };

  Service.prototype.canCheckinEarly = function(minutesEarly) {
    if (!this.allow_early_checkin) return false;
    return minutesEarly <= (this.early_checkin_minutes || 15);
  };

  Service.prototype.shouldAutoComplete = function() {
    return this.auto_complete_on_duration === true;
  };

  Service.prototype.getServiceDuration = function() {
    return this.duration || 60;
  };

  Service.prototype.isDynamic = function() {
    return this.type === 'dynamic';
  };

  Service.prototype.isFixed = function() {
    return this.type === 'fixed';
  };

  Service.prototype.getPrimaryImage = function() {
    if (this.images && this.images.length > 0) {
      return this.images[0];
    }
    return this.image_url || '/api/placeholder/300/200';
  };

  Service.prototype.getAllImages = function() {
    if (this.images && this.images.length > 0) {
      return this.images;
    }
    return this.image_url ? [this.image_url] : [];
  };

  Service.prototype.getBranchId = function() {
    return this.branch_id || null;
  };

  return Service;
};
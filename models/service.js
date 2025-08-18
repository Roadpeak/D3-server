// models/Service.js - FIXED with proper branch_id mapping

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
      allowNull: true, // Null for dynamic services
    },
    duration: {
      type: DataTypes.INTEGER,
      allowNull: true, // Null for dynamic services
      comment: 'Duration in minutes'
    },
    // UPDATED: Support for multiple images
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
    // Keep for backward compatibility
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
    // FIXED: Proper branch_id field mapping
    branch_id: {
      type: DataTypes.UUID,
      allowNull: true,
      field: 'branch_id', // Explicitly specify database column name
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
    // Dynamic service fields
    pricing_factors: {
      type: DataTypes.JSON,
      allowNull: true,
      comment: 'Factors that determine pricing for dynamic services (distance, weight, time, etc.)'
    },
    price_range: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'Estimated price range for dynamic services (e.g., "KES 500 - 2000")'
    },
    consultation_required: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      comment: 'Whether consultation is required before service delivery'
    },
    // Booking capacity fields
    max_concurrent_bookings: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
      validate: {
        min: 1,
        max: 50
      },
      comment: 'Maximum number of bookings that can be scheduled at the same time slot'
    },
    allow_overbooking: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      comment: 'Whether to allow bookings beyond max_concurrent_bookings'
    },
    slot_interval: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: 'Time between slots in minutes (defaults to duration if null)'
    },
    buffer_time: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      comment: 'Buffer time in minutes between consecutive bookings'
    },
    // Advance booking settings
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
    booking_enabled: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      comment: 'Whether booking is enabled for this service'
    },
    // SEO and marketing fields
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
    // CRITICAL FIX: Ensure proper snake_case/camelCase handling
    underscored: false, // Keep false to allow manual field mapping
    indexes: [
      {
        fields: ['store_id'],
        name: 'services_store_id_index'
      },
      {
        fields: ['branch_id'],
        name: 'services_branch_id_index'
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
      },
      {
        fields: ['featured'],
        name: 'services_featured_index'
      }
    ],
    hooks: {
      beforeValidate: (service) => {
        // Set slot_interval to duration if not specified (for fixed services)
        if (!service.slot_interval && service.duration && service.type === 'fixed') {
          service.slot_interval = service.duration;
        }
        
        // For dynamic services, set default slot_interval if not provided
        if (!service.slot_interval && service.type === 'dynamic') {
          service.slot_interval = 60; // Default 1 hour slots for dynamic services
        }
        
        // Set primary image_url from images array for backward compatibility
        if (service.images && service.images.length > 0 && !service.image_url) {
          service.image_url = service.images[0];
        }
      },
      beforeUpdate: (service) => {
        // Update primary image_url if images changed
        if (service.changed('images') && service.images && service.images.length > 0) {
          service.image_url = service.images[0];
        }
      }
    }
  });

  // Associations
  Service.associate = (models) => {
    // Many-to-Many relationship with Staff through StaffService
    Service.belongsToMany(models.Staff, {
      through: models.StaffService,
      foreignKey: 'serviceId',
      otherKey: 'staffId',
      as: 'staff',
    });

    // Service belongs to a Store
    Service.belongsTo(models.Store, {
      foreignKey: 'store_id',
      as: 'store',
      onDelete: 'CASCADE',
    });

    // FIXED: Service belongs to a Branch with proper field mapping
    if (models.Branch) {
      Service.belongsTo(models.Branch, {
        foreignKey: 'branch_id', // Use exact database column name
        as: 'branch',
        onDelete: 'SET NULL',
      });
    }

    // Service has many Offers
    Service.hasMany(models.Offer, {
      foreignKey: 'service_id',
      as: 'offers',
      onDelete: 'CASCADE',
    });

    // Service has many Bookings
    Service.hasMany(models.Booking, {
      foreignKey: 'serviceId',
      as: 'bookings',
      onDelete: 'CASCADE',
    });
  };

  // Instance methods
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

  // ADDED: Helper method to get branch ID with proper field access
  Service.prototype.getBranchId = function() {
    return this.branch_id || null;
  };

  return Service;
};
// models/Booking.js - Complete Enhanced version with all associations
const { Model, DataTypes } = require('sequelize');
const { v4: uuidv4 } = require('uuid');

module.exports = (sequelize) => {
  class Booking extends Model {
    static associate(models) {
      // Define associations here
      Booking.belongsTo(models.Offer, { 
        foreignKey: 'offerId',
        as: 'Offer'
      });
      
      Booking.belongsTo(models.Service, { 
        foreignKey: 'serviceId',
        as: 'Service'
      });
      
      Booking.belongsTo(models.User, { 
        foreignKey: 'userId',
        as: 'User'
      });
      
      Booking.belongsTo(models.Store, { 
        foreignKey: 'storeId',
        as: 'Store',
        allowNull: true
      });

      Booking.belongsTo(models.Branch, { 
        foreignKey: 'branchId',
        as: 'Branch',
        allowNull: true
      });
      
      Booking.belongsTo(models.Staff, { 
        foreignKey: 'staffId',
        as: 'Staff',
        allowNull: true
      });
      
      Booking.belongsTo(models.Payment, { 
        foreignKey: 'paymentId',
        as: 'Payment',
        allowNull: true
      });
    }
  }

  Booking.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      offerId: {
        type: DataTypes.UUID,
        allowNull: true,
        references: {
          model: 'offers',
          key: 'id',
        },
      },
      serviceId: {
        type: DataTypes.UUID,
        allowNull: true,
        references: {
          model: 'services',
          key: 'id',
        },
        comment: 'For direct service bookings (not through offers)'
      },
      userId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id',
        },
      },
      storeId: {
        type: DataTypes.UUID,
        allowNull: true,
        references: {
          model: 'stores',
          key: 'id',
        },
      },
      branchId: {
        type: DataTypes.UUID,
        allowNull: true,
        references: {
          model: 'branches',
          key: 'id',
        },
        comment: 'Branch where the service will be provided'
      },
      staffId: {
        type: DataTypes.UUID,
        allowNull: true,
        references: {
          model: 'staff',
          key: 'id',
        },
      },
      paymentId: {
        type: DataTypes.UUID,
        allowNull: true,
        references: {
          model: 'payments',
          key: 'id',
        },
      },
      paymentUniqueCode: {
        type: DataTypes.INTEGER,
        allowNull: true,
        unique: true,
      },
      status: {
        type: DataTypes.ENUM(
          'pending',
          'confirmed', 
          'in_progress',
          'completed',
          'cancelled',
          'no_show',
          'fulfilled'
        ),
        allowNull: false,
        defaultValue: 'pending',
      },
      bookingType: {
        type: DataTypes.ENUM('offer', 'service'),
        allowNull: false,
        defaultValue: 'offer',
      },
      startTime: {
        type: DataTypes.DATE,
        allowNull: false,
      },
      endTime: {
        type: DataTypes.DATE,
        allowNull: false,
      },
      accessFee: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
        defaultValue: 0.00,
        comment: 'Platform access fee paid by user'
      },
      notes: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'User notes for the booking'
      },
      merchantNotes: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'Merchant notes for the booking'
      },
      cancellationReason: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      qrCode: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'URL to QR code image for verification'
      },
      verificationCode: {
        type: DataTypes.STRING(20),
        allowNull: true,
        comment: 'Additional verification code'
      },
      // Timestamps for status changes
      confirmedAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      completedAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      cancelledAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      // Tracking fields
      createdBy: {
        type: DataTypes.UUID,
        allowNull: true,
        comment: 'ID of user who created the booking'
      },
      updatedBy: {
        type: DataTypes.UUID,
        allowNull: true,
        comment: 'ID of user who last updated the booking'
      },
      fulfilledBy: {
        type: DataTypes.UUID,
        allowNull: true,
        comment: 'ID of merchant/staff who fulfilled the booking'
      },
      // Additional metadata
      clientInfo: {
        type: DataTypes.JSON,
        allowNull: true,
        comment: 'Additional client information if different from user'
      },
      reminderSent: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        comment: 'Whether reminder email/SMS was sent'
      },
      reminderSentAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      isWalkIn: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        comment: 'Whether this was a walk-in booking'
      },
      sourceChannel: {
        type: DataTypes.ENUM('web', 'mobile', 'walk-in', 'phone', 'admin'),
        defaultValue: 'web',
        comment: 'Channel through which booking was made'
      },
      // Review and rating
      hasReview: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
      },
      rating: {
        type: DataTypes.INTEGER,
        allowNull: true,
        validate: {
          min: 1,
          max: 5
        }
      },
      reviewText: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      reviewDate: {
        type: DataTypes.DATE,
        allowNull: true,
      }
    },
    {
      sequelize,
      modelName: 'Booking',
      tableName: 'bookings',
      timestamps: true,
      paranoid: false,
      indexes: [
        {
          fields: ['offerId'],
          name: 'bookings_offer_id_index'
        },
        {
          fields: ['serviceId'],
          name: 'bookings_service_id_index'
        },
        {
          fields: ['userId'],
          name: 'bookings_user_id_index'
        },
        {
          fields: ['storeId'],
          name: 'bookings_store_id_index'
        },
        {
          fields: ['branchId'],
          name: 'bookings_branch_id_index'
        },
        {
          fields: ['staffId'],
          name: 'bookings_staff_id_index'
        },
        {
          fields: ['status'],
          name: 'bookings_status_index'
        },
        {
          fields: ['startTime'],
          name: 'bookings_start_time_index'
        },
        {
          fields: ['paymentUniqueCode'],
          name: 'bookings_payment_code_index'
        },
        {
          fields: ['bookingType'],
          name: 'bookings_type_index'
        },
        {
          fields: ['createdAt'],
          name: 'bookings_created_at_index'
        }
      ],
      hooks: {
        beforeCreate: (booking) => {
          // Generate verification code if not provided
          if (!booking.verificationCode) {
            booking.verificationCode = Math.random().toString(36).substring(2, 8).toUpperCase();
          }
          
          // Set created by
          if (!booking.createdBy && booking.userId) {
            booking.createdBy = booking.userId;
          }

          // Validate booking type constraints
          if (booking.bookingType === 'offer' && !booking.offerId) {
            throw new Error('Offer ID is required for offer bookings');
          }
          if (booking.bookingType === 'service' && !booking.serviceId) {
            throw new Error('Service ID is required for service bookings');
          }
        },
        
        beforeUpdate: (booking) => {
          // Update timestamp fields based on status changes
          if (booking.changed('status')) {
            const now = new Date();
            switch (booking.status) {
              case 'confirmed':
                if (!booking.confirmedAt) booking.confirmedAt = now;
                break;
              case 'completed':
                if (!booking.completedAt) booking.completedAt = now;
                break;
              case 'cancelled':
                if (!booking.cancelledAt) booking.cancelledAt = now;
                break;
            }
          }
        },
        
        afterCreate: async (booking) => {
          // Log booking creation
          console.log(`📅 New booking created: ${booking.id} for ${booking.bookingType} ${booking.offerId || booking.serviceId}`);
        },
        
        afterUpdate: async (booking) => {
          // Log significant status changes
          if (booking.changed('status')) {
            console.log(`📅 Booking ${booking.id} status changed to: ${booking.status}`);
          }
        }
      },
      
      // Instance methods
      instanceMethods: {
        // Check if booking is editable
        isEditable() {
          return ['pending', 'confirmed'].includes(this.status);
        },
        
        // Check if booking can be cancelled
        isCancellable() {
          return ['pending', 'confirmed'].includes(this.status) && 
                 new Date(this.startTime) > new Date();
        },
        
        // Check if booking is in the past
        isPast() {
          return new Date(this.endTime) < new Date();
        },
        
        // Check if booking is upcoming
        isUpcoming() {
          return new Date(this.startTime) > new Date();
        },
        
        // Get booking duration in minutes
        getDurationMinutes() {
          return Math.round((new Date(this.endTime) - new Date(this.startTime)) / (1000 * 60));
        }
      },
      
      // Class methods
      classMethods: {
        // Get bookings for a specific date range
        async getBookingsInRange(startDate, endDate, options = {}) {
          return this.findAll({
            where: {
              startTime: {
                [sequelize.Op.between]: [startDate, endDate]
              },
              ...options.where
            },
            ...options
          });
        },
        
        // Get booking statistics
        async getBookingStats(storeId = null, period = '30d') {
          const endDate = new Date();
          const startDate = new Date();
          
          switch (period) {
            case '7d':
              startDate.setDate(endDate.getDate() - 7);
              break;
            case '30d':
              startDate.setDate(endDate.getDate() - 30);
              break;
            case '90d':
              startDate.setDate(endDate.getDate() - 90);
              break;
          }
          
          const whereClause = {
            createdAt: {
              [sequelize.Op.between]: [startDate, endDate]
            }
          };
          
          if (storeId) {
            whereClause.storeId = storeId;
          }
          
          return this.findAll({
            where: whereClause,
            attributes: [
              'status',
              [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
              [sequelize.fn('SUM', sequelize.col('accessFee')), 'totalRevenue']
            ],
            group: ['status']
          });
        }
      }
    }
  );

  return Booking;
};
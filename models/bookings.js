// models/Booking.js - Optimized version with reduced indexes
const { Model, DataTypes } = require('sequelize');
const { v4: uuidv4 } = require('uuid');

module.exports = (sequelize) => {
  class Booking extends Model {
    static associate(models) {
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

    // Instance methods
    isEditable() {
      return ['pending', 'confirmed'].includes(this.status);
    }
    
    isCancellable() {
      return ['pending', 'confirmed'].includes(this.status) && 
             new Date(this.startTime) > new Date();
    }
    
    isPast() {
      return new Date(this.endTime) < new Date();
    }
    
    isUpcoming() {
      return new Date(this.startTime) > new Date();
    }
    
    getDurationMinutes() {
      return Math.round((new Date(this.endTime) - new Date(this.startTime)) / (1000 * 60));
    }

    // Class methods
    static async getBookingsInRange(startDate, endDate, options = {}) {
      return this.findAll({
        where: {
          startTime: {
            [sequelize.Sequelize.Op.between]: [startDate, endDate]
          },
          ...options.where
        },
        ...options
      });
    }
    
    static async getBookingStats(storeId = null, period = '30d') {
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
          [sequelize.Sequelize.Op.between]: [startDate, endDate]
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
      },
      auto_confirmed: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        comment: 'Whether booking was auto-confirmed by system'
      },
      confirmation_notes: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'Notes about confirmation decision'
      },
      audit_trail: {
        type: DataTypes.JSON,
        allowNull: true,
        comment: 'Audit trail of auto-confirmation decisions'
      },
      manually_confirmed: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        comment: 'Whether booking was manually confirmed by merchant'
      },
      confirmed_by: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: 'Who confirmed the booking (system/merchant name)'
      },
      confirmed_at: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: 'When the booking was confirmed'
      },
      no_show_marked_at: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: 'When the booking was marked as no-show'
      },
      no_show_reason: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'Reason for no-show status'
      },
      no_show_details: {
        type: DataTypes.JSON,
        allowNull: true,
        comment: 'Additional details about no-show processing'
      },
      auto_completed: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        comment: 'Whether booking was auto-completed by system'
      },
      completion_method: {
        type: DataTypes.ENUM('manual', 'automatic'),
        allowNull: true,
        comment: 'How the booking was completed'
      },
      completion_details: {
        type: DataTypes.JSON,
        allowNull: true,
        comment: 'Details about the completion process'
      },
      actual_duration: {
        type: DataTypes.INTEGER,
        allowNull: true,
        comment: 'Actual service duration in minutes'
      },
      service_started_at: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: 'When the service actually started'
      },
      service_end_time: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: 'Calculated end time based on start time + duration'
      }
    },
    {
      sequelize,
      modelName: 'Booking',
      tableName: 'bookings',
      timestamps: true,
      paranoid: false,
      indexes: [
        // Foreign key indexes - essential for JOIN performance
        {
          fields: ['userId'],
          name: 'idx_bookings_user_id'
        },
        {
          fields: ['storeId'],
          name: 'idx_bookings_store_id'
        },
        {
          fields: ['offerId'],
          name: 'idx_bookings_offer_id'
        },
        {
          fields: ['serviceId'],
          name: 'idx_bookings_service_id'
        },
        // Composite indexes for common query patterns
        {
          fields: ['storeId', 'status', 'startTime'],
          name: 'idx_bookings_store_status_time'
        },
        {
          fields: ['userId', 'status'],
          name: 'idx_bookings_user_status'
        },
        {
          fields: ['staffId', 'startTime', 'endTime', 'status'],
          name: 'idx_bookings_staff_schedule'
        },
        // Single column indexes only where absolutely necessary
        {
          fields: ['startTime'],
          name: 'idx_bookings_start_time'
        }
      ],
      hooks: {
        beforeCreate: (booking) => {
          if (!booking.verificationCode) {
            booking.verificationCode = Math.random().toString(36).substring(2, 8).toUpperCase();
          }
          
          if (!booking.createdBy && booking.userId) {
            booking.createdBy = booking.userId;
          }

          if (booking.bookingType === 'offer' && !booking.offerId) {
            throw new Error('Offer ID is required for offer bookings');
          }
          if (booking.bookingType === 'service' && !booking.serviceId) {
            throw new Error('Service ID is required for service bookings');
          }
        },
        
        beforeUpdate: (booking) => {
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
          console.log(`📅 New booking created: ${booking.id} for ${booking.bookingType} ${booking.offerId || booking.serviceId}`);
        },
        
        afterUpdate: async (booking) => {
          if (booking.changed('status')) {
            console.log(`📅 Booking ${booking.id} status changed to: ${booking.status}`);
          }
        }
      }
    }
  );

  return Booking;
};
// models/Payment.js - Optimized with reduced indexes
const { Model, DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  class Payment extends Model {
    static associate(models) {
      Payment.hasMany(models.Booking, {
        foreignKey: 'paymentId',
        as: 'Bookings'
      });
    }

    canRefund() {
      return this.status === 'completed' && 
             this.refund_amount < this.amount;
    }
    
    canRetry() {
      return this.status === 'failed' && 
             this.retry_count < this.max_retries;
    }
    
    getRefundableAmount() {
      return this.amount - (this.refund_amount || 0);
    }
    
    isPendingTooLong(hours = 24) {
      if (this.status !== 'pending') return false;
      const hoursDiff = (new Date() - this.createdAt) / (1000 * 60 * 60);
      return hoursDiff > hours;
    }
  }

  Payment.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      amount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        validate: {
          min: 0
        }
      },
      currency: {
        type: DataTypes.STRING(3),
        allowNull: false,
        defaultValue: 'KES',
        validate: {
          isIn: [['KES', 'USD', 'EUR', 'GBP']]
        }
      },
      method: {
        type: DataTypes.ENUM('mpesa', 'card', 'bank_transfer', 'cash', 'paypal', 'stripe'),
        allowNull: false,
        defaultValue: 'mpesa'
      },
      status: {
        type: DataTypes.ENUM('pending', 'processing', 'completed', 'failed', 'cancelled', 'refunded'),
        allowNull: false,
        defaultValue: 'pending'
      },
      unique_code: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
        defaultValue: () => 'PAY_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8).toUpperCase(),
        comment: 'Unique payment identifier for tracking'
      },
      transaction_id: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: 'External transaction ID from payment provider'
      },
      phone_number: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: 'Phone number for mobile payments'
      },
      mpesa_receipt_number: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: 'M-Pesa receipt number'
      },
      transaction_date: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: 'Date when transaction was processed by provider'
      },
      reference: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: 'Payment reference or description'
      },
      gateway_response: {
        type: DataTypes.JSON,
        allowNull: true,
        comment: 'Raw response from payment gateway'
      },
      metadata: {
        type: DataTypes.JSON,
        allowNull: true,
        comment: 'Additional payment metadata'
      },
      fee: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
        defaultValue: 0.00,
        comment: 'Transaction fee charged by payment provider'
      },
      net_amount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
        comment: 'Net amount after fees'
      },
      refund_amount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
        defaultValue: 0.00,
        comment: 'Amount refunded if applicable'
      },
      refund_reason: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'Reason for refund'
      },
      refunded_at: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: 'Date when refund was processed'
      },
      processed_at: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: 'Date when payment was processed'
      },
      failed_at: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: 'Date when payment failed'
      },
      retry_count: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        comment: 'Number of retry attempts'
      },
      max_retries: {
        type: DataTypes.INTEGER,
        defaultValue: 3,
        comment: 'Maximum number of retry attempts'
      },
      next_retry_at: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: 'Next retry attempt date'
      },
      customer_email: {
        type: DataTypes.STRING,
        allowNull: true,
        validate: {
          isEmail: true
        }
      },
      customer_name: {
        type: DataTypes.STRING,
        allowNull: true
      },
      billing_address: {
        type: DataTypes.JSON,
        allowNull: true,
        comment: 'Customer billing address'
      },
      ip_address: {
        type: DataTypes.STRING(45),
        allowNull: true,
        comment: 'IP address of the payment request'
      },
      user_agent: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'User agent string'
      },
      risk_score: {
        type: DataTypes.DECIMAL(3, 2),
        allowNull: true,
        validate: {
          min: 0,
          max: 1
        },
        comment: 'Risk score from 0 to 1'
      },
      risk_flags: {
        type: DataTypes.JSON,
        allowNull: true,
        comment: 'Risk assessment flags'
      },
      webhook_sent: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        comment: 'Whether webhook notification was sent'
      },
      webhook_sent_at: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: 'Date when webhook was sent'
      },
      webhook_response: {
        type: DataTypes.JSON,
        allowNull: true,
        comment: 'Response from webhook endpoint'
      }
    },
    {
      sequelize,
      modelName: 'Payment',
      tableName: 'payments',
      timestamps: true,
      indexes: [
        // Composite index for filtering payments by status and date
        {
          fields: ['status', 'createdAt'],
          name: 'idx_payments_status_created'
        },
        // Composite index for payment method analytics
        {
          fields: ['method', 'status'],
          name: 'idx_payments_method_status'
        },
        // Index for transaction lookup
        {
          fields: ['transaction_id'],
          name: 'idx_payments_transaction_id'
        }
      ],
      hooks: {
        beforeCreate: (payment) => {
          if (!payment.unique_code) {
            payment.unique_code = 'PAY_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8).toUpperCase();
          }
          
          if (payment.amount && payment.fee) {
            payment.net_amount = payment.amount - payment.fee;
          } else if (payment.amount) {
            payment.net_amount = payment.amount;
          }
          
          if (payment.status === 'completed' && !payment.processed_at) {
            payment.processed_at = new Date();
          }
        },
        
        beforeUpdate: (payment) => {
          if (payment.changed('status')) {
            const now = new Date();
            switch (payment.status) {
              case 'completed':
                if (!payment.processed_at) payment.processed_at = now;
                break;
              case 'failed':
                if (!payment.failed_at) payment.failed_at = now;
                break;
              case 'refunded':
                if (!payment.refunded_at) payment.refunded_at = now;
                break;
            }
          }
          
          if (payment.changed('amount') || payment.changed('fee')) {
            payment.net_amount = (payment.amount || 0) - (payment.fee || 0);
          }
        }
      }
    }
  );

  return Payment;
};
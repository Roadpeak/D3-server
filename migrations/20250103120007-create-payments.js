'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('payments', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true
      },
      amount: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false
      },
      currency: {
        type: Sequelize.STRING(3),
        allowNull: false,
        defaultValue: 'KES'
      },
      method: {
        type: Sequelize.ENUM('mpesa', 'card', 'bank_transfer', 'cash', 'paypal', 'stripe'),
        allowNull: false,
        defaultValue: 'mpesa'
      },
      status: {
        type: Sequelize.ENUM('pending', 'processing', 'completed', 'failed', 'cancelled', 'refunded'),
        allowNull: false,
        defaultValue: 'pending'
      },
      unique_code: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true,
        comment: 'Unique payment identifier for tracking'
      },
      transaction_id: {
        type: Sequelize.STRING,
        allowNull: true,
        comment: 'External transaction ID from payment provider'
      },
      phone_number: {
        type: Sequelize.STRING,
        allowNull: true,
        comment: 'Phone number for mobile payments'
      },
      mpesa_receipt_number: {
        type: Sequelize.STRING,
        allowNull: true,
        comment: 'M-Pesa receipt number'
      },
      transaction_date: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: 'Date when transaction was processed by provider'
      },
      reference: {
        type: Sequelize.STRING,
        allowNull: true,
        comment: 'Payment reference or description'
      },
      gateway_response: {
        type: Sequelize.JSON,
        allowNull: true,
        comment: 'Raw response from payment gateway'
      },
      metadata: {
        type: Sequelize.JSON,
        allowNull: true,
        comment: 'Additional payment metadata'
      },
      fee: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true,
        defaultValue: 0.00,
        comment: 'Transaction fee charged by payment provider'
      },
      net_amount: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true,
        comment: 'Net amount after fees'
      },
      refund_amount: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true,
        defaultValue: 0.00,
        comment: 'Amount refunded if applicable'
      },
      refund_reason: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'Reason for refund'
      },
      refunded_at: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: 'Date when refund was processed'
      },
      processed_at: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: 'Date when payment was processed'
      },
      failed_at: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: 'Date when payment failed'
      },
      retry_count: {
        type: Sequelize.INTEGER,
        defaultValue: 0,
        comment: 'Number of retry attempts'
      },
      max_retries: {
        type: Sequelize.INTEGER,
        defaultValue: 3,
        comment: 'Maximum number of retry attempts'
      },
      next_retry_at: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: 'Next retry attempt date'
      },
      customer_email: {
        type: Sequelize.STRING,
        allowNull: true
      },
      customer_name: {
        type: Sequelize.STRING,
        allowNull: true
      },
      billing_address: {
        type: Sequelize.JSON,
        allowNull: true,
        comment: 'Customer billing address'
      },
      ip_address: {
        type: Sequelize.STRING(45),
        allowNull: true,
        comment: 'IP address of the payment request'
      },
      user_agent: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'User agent string'
      },
      risk_score: {
        type: Sequelize.DECIMAL(3, 2),
        allowNull: true,
        comment: 'Risk score from 0 to 1'
      },
      risk_flags: {
        type: Sequelize.JSON,
        allowNull: true,
        comment: 'Risk assessment flags'
      },
      webhook_sent: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
        comment: 'Whether webhook notification was sent'
      },
      webhook_sent_at: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: 'Date when webhook was sent'
      },
      webhook_response: {
        type: Sequelize.JSON,
        allowNull: true,
        comment: 'Response from webhook endpoint'
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP')
      }
    });

    // Add indexes
    await queryInterface.addIndex('payments', ['status', 'createdAt'], {
      name: 'idx_payments_status_created'
    });

    await queryInterface.addIndex('payments', ['method', 'status'], {
      name: 'idx_payments_method_status'
    });

    await queryInterface.addIndex('payments', ['transaction_id'], {
      name: 'idx_payments_transaction_id'
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('payments');
  }
};
'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('merchants', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true
      },
      first_name: {
        type: Sequelize.STRING,
        allowNull: false
      },
      last_name: {
        type: Sequelize.STRING,
        allowNull: false
      },
      email_address: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true
      },
      phone_number: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true
      },
      password: {
        type: Sequelize.STRING,
        allowNull: false
      },
      avatar: {
        type: Sequelize.STRING,
        allowNull: true,
        comment: 'Merchant profile picture URL'
      },
      business_name: {
        type: Sequelize.STRING,
        allowNull: true,
        comment: 'Name of the merchant business'
      },
      business_type: {
        type: Sequelize.STRING,
        allowNull: true,
        comment: 'Type of business (retail, service, etc.)'
      },
      business_address: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'Business address'
      },
      tax_id: {
        type: Sequelize.STRING,
        allowNull: true,
        comment: 'Business tax identification number'
      },
      verification_status: {
        type: Sequelize.ENUM('pending', 'verified', 'rejected'),
        defaultValue: 'pending',
        comment: 'Merchant verification status'
      },
      is_active: {
        type: Sequelize.BOOLEAN,
        defaultValue: true,
        comment: 'Whether merchant account is active'
      },
      last_login_at: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: 'Last login timestamp'
      },
      email_verified: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
        comment: 'Whether email is verified'
      },
      phone_verified: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
        comment: 'Whether phone is verified'
      },
      is_online: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
        comment: 'Real-time online status for chat system'
      },
      last_seen_at: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: 'Last seen timestamp for chat system'
      },
      chat_notifications: {
        type: Sequelize.BOOLEAN,
        defaultValue: true,
        comment: 'Whether to receive chat notifications'
      },
      email_notifications: {
        type: Sequelize.BOOLEAN,
        defaultValue: true,
        comment: 'Whether to receive email notifications'
      },
      sms_notifications: {
        type: Sequelize.BOOLEAN,
        defaultValue: true,
        comment: 'Whether to receive SMS notifications'
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
    await queryInterface.addIndex('merchants', ['verification_status', 'is_active'], {
      name: 'idx_merchants_verification_active'
    });

    await queryInterface.addIndex('merchants', ['is_online', 'is_active'], {
      name: 'idx_merchants_online_active'
    });

    await queryInterface.addIndex('merchants', ['business_type'], {
      name: 'idx_merchants_business_type'
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('merchants');
  }
};
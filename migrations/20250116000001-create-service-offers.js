'use strict';

/**
 * Migration: Create Service Offers table
 *
 * This table stores merchant offers for service requests.
 * Supports the Uber-style realtime bidding system where merchants
 * can submit offers and clients can accept one offer.
 *
 * Reference: D3_Service_Request_Technical_Design.pdf
 */

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('service_offers', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true
      },
      serviceRequestId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'service_requests',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
        comment: 'Reference to the service request'
      },
      merchantId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'users', // Assuming merchants are in users table
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
        comment: 'Merchant who submitted this offer'
      },
      storeId: {
        type: Sequelize.UUID,
        allowNull: true,
        comment: 'Store ID if offer is from a store'
      },
      price: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
        comment: 'Quoted price for the service'
      },
      message: {
        type: Sequelize.TEXT,
        allowNull: false,
        comment: 'Merchant message/pitch'
      },
      availability: {
        type: Sequelize.STRING(255),
        allowNull: true,
        comment: 'When the merchant is available'
      },
      status: {
        type: Sequelize.ENUM('PENDING', 'ACCEPTED', 'REJECTED'),
        defaultValue: 'PENDING',
        comment: 'Offer status'
      },
      acceptedAt: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: 'When the offer was accepted'
      },
      rejectedAt: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: 'When the offer was rejected (auto or manual)'
      },
      rejectionReason: {
        type: Sequelize.STRING(255),
        allowNull: true,
        comment: 'Why the offer was rejected (auto-rejection, client choice, etc.)'
      },
      responseTimeSeconds: {
        type: Sequelize.INTEGER,
        allowNull: true,
        comment: 'How long it took merchant to respond (in seconds)'
      },
      viewedByClient: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
        comment: 'Whether client has viewed this offer'
      },
      viewedAt: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: 'When client viewed this offer'
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

    // Add indexes for performance
    await queryInterface.addIndex('service_offers', ['serviceRequestId', 'status'], {
      name: 'idx_service_offers_request_status'
    });

    await queryInterface.addIndex('service_offers', ['merchantId', 'status'], {
      name: 'idx_service_offers_merchant_status'
    });

    await queryInterface.addIndex('service_offers', ['serviceRequestId', 'merchantId'], {
      name: 'idx_service_offers_request_merchant',
      unique: true, // One offer per merchant per request
      comment: 'Ensure merchant can only submit one offer per request'
    });

    await queryInterface.addIndex('service_offers', ['status', 'createdAt'], {
      name: 'idx_service_offers_status_created'
    });

    await queryInterface.addIndex('service_offers', ['price'], {
      name: 'idx_service_offers_price'
    });

    // Now add the foreign key constraint to service_requests table
    // that references accepted offer
    await queryInterface.addConstraint('service_requests', {
      fields: ['acceptedOfferId'],
      type: 'foreign key',
      name: 'fk_service_requests_accepted_offer',
      references: {
        table: 'service_offers',
        field: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL'
    });

    console.log('✅ Service Offers table created successfully');
  },

  down: async (queryInterface, Sequelize) => {
    // Remove foreign key constraint from service_requests first
    await queryInterface.removeConstraint('service_requests', 'fk_service_requests_accepted_offer');

    // Drop the service_offers table
    await queryInterface.dropTable('service_offers');

    console.log('✅ Service Offers table dropped successfully');
  }
};

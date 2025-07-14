// /migrations/YYYYMMDDHHMMSS-create-service-offers.js
'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('service_offers', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      requestId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'service_requests',
          key: 'id'
        },
        onDelete: 'CASCADE'
      },
      providerId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'Users',
          key: 'id'
        },
        onDelete: 'CASCADE'
      },
      storeId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'Stores',
          key: 'id'
        },
        onDelete: 'CASCADE'
      },
      quotedPrice: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false
      },
      message: {
        type: Sequelize.TEXT,
        allowNull: false
      },
      availability: {
        type: Sequelize.STRING(200),
        allowNull: false
      },
      estimatedDuration: {
        type: Sequelize.STRING(100)
      },
      includesSupplies: {
        type: Sequelize.BOOLEAN,
        defaultValue: false
      },
      warranty: {
        type: Sequelize.JSON,
        defaultValue: JSON.stringify({
          offered: false,
          duration: null,
          terms: null
        })
      },
      status: {
        type: Sequelize.ENUM('pending', 'accepted', 'rejected', 'withdrawn', 'expired'),
        defaultValue: 'pending'
      },
      statusReason: {
        type: Sequelize.TEXT
      },
      acceptedAt: {
        type: Sequelize.DATE
      },
      rejectedAt: {
        type: Sequelize.DATE
      },
      withdrawnAt: {
        type: Sequelize.DATE
      },
      expiresAt: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('DATE_ADD(NOW(), INTERVAL 7 DAY)')
      },
      responseTime: {
        type: Sequelize.DECIMAL(8, 2),
        defaultValue: 0,
        comment: 'Response time in hours'
      },
      revisionCount: {
        type: Sequelize.INTEGER,
        defaultValue: 0
      },
      originalOfferId: {
        type: Sequelize.INTEGER,
        references: {
          model: 'service_offers',
          key: 'id'
        },
        onDelete: 'SET NULL'
      },
      negotiationHistory: {
        type: Sequelize.JSON,
        defaultValue: JSON.stringify([])
      },
      attachments: {
        type: Sequelize.JSON,
        defaultValue: JSON.stringify([])
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE
      }
    });

    // Add indexes
    await queryInterface.addIndex('service_offers', ['requestId']);
    await queryInterface.addIndex('service_offers', ['providerId']);
    await queryInterface.addIndex('service_offers', ['storeId']);
    await queryInterface.addIndex('service_offers', ['status']);
    await queryInterface.addIndex('service_offers', ['createdAt']);
    await queryInterface.addIndex('service_offers', ['expiresAt']);
    await queryInterface.addIndex('service_offers', ['quotedPrice']);
    await queryInterface.addIndex('service_offers', ['requestId', 'status']);
    await queryInterface.addIndex('service_offers', ['providerId', 'status']);
    await queryInterface.addIndex('service_offers', ['storeId', 'status']);
    
    // Add unique constraint to prevent duplicate offers from same store to same request
    await queryInterface.addIndex('service_offers', ['requestId', 'storeId'], {
      unique: true,
      name: 'unique_store_request_offer'
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('service_offers');
  }
};
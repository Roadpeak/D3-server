'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('service_offers', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true
      },
      requestId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'service_requests',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      storeId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'stores',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      providerId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'merchants',
          key: 'id'
        },
        onUpdate: 'CASCADE',
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
        type: Sequelize.STRING(100),
        defaultValue: null
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
        type: Sequelize.TEXT,
        defaultValue: null
      },
      acceptedAt: {
        type: Sequelize.DATE,
        defaultValue: null
      },
      rejectedAt: {
        type: Sequelize.DATE,
        defaultValue: null
      },
      withdrawnAt: {
        type: Sequelize.DATE,
        defaultValue: null
      },
      expiresAt: {
        type: Sequelize.DATE,
        allowNull: false
      },
      responseTime: {
        type: Sequelize.DECIMAL(8, 2),
        defaultValue: 0,
        comment: 'Time in hours from request creation to offer submission'
      },
      revisionCount: {
        type: Sequelize.INTEGER,
        defaultValue: 0
      },
      originalOfferId: {
        type: Sequelize.UUID,
        defaultValue: null,
        references: {
          model: 'service_offers',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      negotiationHistory: {
        type: Sequelize.JSON,
        defaultValue: '[]'
      },
      attachments: {
        type: Sequelize.JSON,
        defaultValue: '[]'
      },
      storeRating: {
        type: Sequelize.DECIMAL(3, 2),
        defaultValue: null
      },
      storeReviewCount: {
        type: Sequelize.INTEGER,
        defaultValue: 0
      },
      viewedByCustomer: {
        type: Sequelize.BOOLEAN,
        defaultValue: false
      },
      viewedAt: {
        type: Sequelize.DATE,
        defaultValue: null
      },
      customerResponseTime: {
        type: Sequelize.DECIMAL(8, 2),
        defaultValue: null,
        comment: 'Time in hours from offer creation to customer response'
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
    await queryInterface.addIndex('service_offers', ['requestId'], {
      name: 'idx_service_offers_request_id'
    });

    await queryInterface.addIndex('service_offers', ['storeId'], {
      name: 'idx_service_offers_store_id'
    });

    await queryInterface.addIndex('service_offers', ['providerId'], {
      name: 'idx_service_offers_provider_id'
    });

    await queryInterface.addIndex('service_offers', ['storeId', 'status', 'createdAt'], {
      name: 'idx_service_offers_store_status_created'
    });

    await queryInterface.addIndex('service_offers', ['status', 'expiresAt'], {
      name: 'idx_service_offers_status_expires'
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('service_offers');
  }
};
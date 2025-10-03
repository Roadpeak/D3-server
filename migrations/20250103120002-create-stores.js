'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('stores', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true
      },
      merchant_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'merchants',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      name: {
        type: Sequelize.STRING,
        allowNull: false
      },
      location: {
        type: Sequelize.STRING,
        allowNull: false
      },
      primary_email: {
        type: Sequelize.STRING,
        allowNull: false
      },
      phone_number: {
        type: Sequelize.STRING,
        allowNull: true
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      website_url: {
        type: Sequelize.STRING,
        allowNull: true
      },
      logo_url: {
        type: Sequelize.STRING,
        allowNull: true
      },
      opening_time: {
        type: Sequelize.TIME,
        allowNull: false
      },
      closing_time: {
        type: Sequelize.TIME,
        allowNull: false
      },
      working_days: {
        type: Sequelize.JSON,
        allowNull: false,
        defaultValue: '[]'
      },
      status: {
        type: Sequelize.ENUM('open', 'closed', 'under_construction'),
        defaultValue: 'closed'
      },
      cashback: {
        type: Sequelize.STRING,
        allowNull: true,
        comment: 'e.g., "20%", "$0.02", "Up to 70%"'
      },
      category: {
        type: Sequelize.STRING,
        allowNull: true
      },
      rating: {
        type: Sequelize.DECIMAL(3, 2),
        allowNull: true,
        defaultValue: 0.0
      },
      was_rate: {
        type: Sequelize.STRING,
        allowNull: true
      },
      created_by: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'merchants',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      updated_by: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'merchants',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      is_active: {
        type: Sequelize.BOOLEAN,
        defaultValue: true
      },
      isOnline: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
        comment: 'Real-time online status for chat system'
      },
      lastSeen: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: 'Last time the merchant was active for this store'
      },
      latitude: {
        type: Sequelize.DECIMAL(10, 8),
        allowNull: true,
        comment: 'Geographic latitude for mapping'
      },
      longitude: {
        type: Sequelize.DECIMAL(11, 8),
        allowNull: true,
        comment: 'Geographic longitude for mapping'
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

    // Add indexes (removed partial index that caused SQL syntax error)
    await queryInterface.addIndex('stores', ['merchant_id'], {
      name: 'idx_stores_merchant_id'
    });

    await queryInterface.addIndex('stores', ['category', 'location', 'is_active'], {
      name: 'idx_stores_category_location_active'
    });

    await queryInterface.addIndex('stores', ['isOnline', 'is_active'], {
      name: 'idx_stores_online_active'
    });

    await queryInterface.addIndex('stores', ['rating', 'is_active'], {
      name: 'idx_stores_rating_active'
    });

    // Simple cashback index (no WHERE clause - MySQL doesn't support partial indexes the same way)
    await queryInterface.addIndex('stores', ['cashback'], {
      name: 'idx_stores_cashback'
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('stores');
  }
};
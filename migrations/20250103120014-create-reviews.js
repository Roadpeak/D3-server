'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('Reviews', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false
      },
      store_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'stores',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      user_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'users',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
        comment: 'Allow null for anonymous reviews'
      },
      text: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      rating: {
        type: Sequelize.INTEGER,
        allowNull: false
      },
      is_verified: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
        allowNull: false
      },
      is_helpful_count: {
        type: Sequelize.INTEGER,
        defaultValue: 0,
        allowNull: false
      },
      is_reported: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
        allowNull: false
      },
      merchant_response: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      merchant_response_date: {
        type: Sequelize.DATE,
        allowNull: true
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
    await queryInterface.addIndex('Reviews', ['store_id'], {
      name: 'idx_reviews_store_id'
    });

    await queryInterface.addIndex('Reviews', ['user_id'], {
      name: 'idx_reviews_user_id'
    });

    await queryInterface.addIndex('Reviews', ['rating'], {
      name: 'idx_reviews_rating'
    });

    await queryInterface.addIndex('Reviews', ['createdAt'], {
      name: 'idx_reviews_created_at'
    });

    await queryInterface.addIndex('Reviews', ['store_id', 'user_id'], {
      name: 'unique_store_user_review',
      unique: true
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('Reviews');
  }
};
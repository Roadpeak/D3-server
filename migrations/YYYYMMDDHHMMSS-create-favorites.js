// migrations/YYYYMMDDHHMMSS-create-favorites.js
'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('Favorites', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      user_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'Users',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      offer_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'Offers',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      created_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updated_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    // Add unique constraint to prevent duplicate favorites
    await queryInterface.addConstraint('Favorites', {
      fields: ['user_id', 'offer_id'],
      type: 'unique',
      name: 'unique_user_offer_favorite'
    });

    // Add indexes for better performance
    await queryInterface.addIndex('Favorites', ['user_id'], {
      name: 'favorites_user_id_index'
    });

    await queryInterface.addIndex('Favorites', ['offer_id'], {
      name: 'favorites_offer_id_index'
    });

    await queryInterface.addIndex('Favorites', ['created_at'], {
      name: 'favorites_created_at_index'
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('Favorites');
  }
};
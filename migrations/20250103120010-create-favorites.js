'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('Favorites', {
      id: {
        type: Sequelize.UUID,
        primaryKey: true,
        defaultValue: Sequelize.UUIDV4,
        allowNull: false
      },
      user_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      offer_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'offers',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP')
      }
    });

    // Add indexes
    await queryInterface.addIndex('Favorites', ['user_id', 'offer_id'], {
      unique: true,
      name: 'idx_favorites_user_offer_unique'
    });

    await queryInterface.addIndex('Favorites', ['user_id'], {
      name: 'idx_favorites_user_id'
    });

    await queryInterface.addIndex('Favorites', ['offer_id'], {
      name: 'idx_favorites_offer_id'
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('Favorites');
  }
};
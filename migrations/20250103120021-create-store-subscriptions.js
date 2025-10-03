'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('StoreSubscriptions', {
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
      start_date: {
        type: Sequelize.DATE,
        allowNull: false
      },
      end_date: {
        type: Sequelize.DATE,
        allowNull: false
      },
      next_billing_date: {
        type: Sequelize.DATE,
        allowNull: false
      },
      is_trial: {
        type: Sequelize.BOOLEAN,
        defaultValue: true,
        allowNull: false
      },
      is_active: {
        type: Sequelize.BOOLEAN,
        defaultValue: true,
        allowNull: false
      },
      status: {
        type: Sequelize.ENUM('active', 'inactive', 'canceled'),
        defaultValue: 'active',
        allowNull: false
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
    await queryInterface.addIndex('StoreSubscriptions', ['store_id'], {
      name: 'idx_store_subscriptions_store_id'
      // Add 'unique: true' if stores can only have ONE subscription at a time
    });

    await queryInterface.addIndex('StoreSubscriptions', ['status'], {
      name: 'idx_store_subscriptions_status'
    });

    await queryInterface.addIndex('StoreSubscriptions', ['next_billing_date'], {
      name: 'idx_store_subscriptions_next_billing'
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('StoreSubscriptions');
  }
};
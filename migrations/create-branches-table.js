// migrations/create-branches-table.js
'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('branches', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false
      },
      name: {
        type: Sequelize.STRING,
        allowNull: false
      },
      address: {
        type: Sequelize.TEXT,
        allowNull: false
      },
      phone: {
        type: Sequelize.STRING,
        allowNull: true
      },
      email: {
        type: Sequelize.STRING,
        allowNull: true
      },
      manager: {
        type: Sequelize.STRING,
        allowNull: true
      },
      status: {
        type: Sequelize.ENUM('Active', 'Inactive', 'Pending', 'Suspended'),
        defaultValue: 'Active',
        allowNull: false
      },
      opening_time: {
        type: Sequelize.TIME,
        allowNull: true
      },
      closing_time: {
        type: Sequelize.TIME,
        allowNull: true
      },
      working_days: {
        type: Sequelize.JSON,
        allowNull: true,
        defaultValue: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
      },
      latitude: {
        type: Sequelize.DECIMAL(10, 8),
        allowNull: true
      },
      longitude: {
        type: Sequelize.DECIMAL(11, 8),
        allowNull: true
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      is_main_branch: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
        allowNull: false
      },
      store_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'stores', // Adjust table name if different
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      merchant_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'merchants', // Adjust table name if different
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      created_by: {
        type: Sequelize.UUID,
        allowNull: true
      },
      updated_by: {
        type: Sequelize.UUID,
        allowNull: true
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn('NOW')
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn('NOW')
      },
      deleted_at: {
        type: Sequelize.DATE,
        allowNull: true
      }
    });

    // Add indexes
    await queryInterface.addIndex('branches', ['store_id']);
    await queryInterface.addIndex('branches', ['merchant_id']);
    await queryInterface.addIndex('branches', ['status']);
    await queryInterface.addIndex('branches', ['is_main_branch']);
    await queryInterface.addIndex('branches', ['store_id', 'is_main_branch']);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('branches');
  }
};
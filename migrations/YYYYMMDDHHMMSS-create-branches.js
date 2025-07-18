// migrations/YYYYMMDDHHMMSS-create-branches.js
'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('branches', {
      id: {
        allowNull: false,
        primaryKey: true,
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4
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
        allowNull: true,
        validate: {
          isEmail: true
        }
      },
      manager: {
        type: Sequelize.STRING,
        allowNull: true
      },
      status: {
        type: Sequelize.ENUM('Active', 'Inactive', 'Pending', 'Suspended'),
        defaultValue: 'Active'
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
        defaultValue: false
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
      created_by: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'merchants',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
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
      created_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updated_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP')
      },
      deleted_at: {
        type: Sequelize.DATE,
        allowNull: true
      }
    });

    // Add indexes for better performance
    await queryInterface.addIndex('branches', ['store_id']);
    await queryInterface.addIndex('branches', ['merchant_id']);
    await queryInterface.addIndex('branches', ['status']);
    await queryInterface.addIndex('branches', ['is_main_branch']);
    await queryInterface.addIndex('branches', ['created_at']);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('branches');
  }
};
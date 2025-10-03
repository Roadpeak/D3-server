'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('staff', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true
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
      branchId: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'branches',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      name: {
        type: Sequelize.STRING,
        allowNull: false
      },
      email: {
        type: Sequelize.STRING,
        allowNull: false
      },
      phoneNumber: {
        type: Sequelize.STRING,
        allowNull: true
      },
      role: {
        type: Sequelize.ENUM('staff', 'manager', 'supervisor', 'cashier', 'sales'),
        defaultValue: 'staff',
        allowNull: false
      },
      status: {
        type: Sequelize.ENUM('active', 'suspended', 'inactive'),
        defaultValue: 'active'
      },
      password: {
        type: Sequelize.STRING,
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
    await queryInterface.addIndex('staff', ['email', 'storeId'], {
      unique: true,
      name: 'idx_staff_email_store_unique'
    });

    await queryInterface.addIndex('staff', ['storeId'], {
      name: 'idx_staff_store_id'
    });

    await queryInterface.addIndex('staff', ['branchId'], {
      name: 'idx_staff_branch_id'
    });

    await queryInterface.addIndex('staff', ['storeId', 'status', 'role'], {
      name: 'idx_staff_store_status_role'
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('staff');
  }
};
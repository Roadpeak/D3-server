// migrations/xxxx-add-branch-role-to-staff.js
'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Add branchId column
    await queryInterface.addColumn('staff', 'branchId', {
      type: Sequelize.UUID,
      allowNull: true,
      references: {
        model: 'branches', // Make sure this matches your branch table name
        key: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    });

    // Add role column
    await queryInterface.addColumn('staff', 'role', {
      type: Sequelize.ENUM('staff', 'manager', 'supervisor', 'cashier', 'sales'),
      defaultValue: 'staff',
      allowNull: false,
    });

    // Add indexes for better performance
    await queryInterface.addIndex('staff', ['branchId'], {
      name: 'staff_branch_id_index'
    });

    await queryInterface.addIndex('staff', ['role'], {
      name: 'staff_role_index'
    });
  },

  async down(queryInterface, Sequelize) {
    // Remove indexes
    await queryInterface.removeIndex('staff', 'staff_role_index');
    await queryInterface.removeIndex('staff', 'staff_branch_id_index');
    
    // Remove columns
    await queryInterface.removeColumn('staff', 'role');
    await queryInterface.removeColumn('staff', 'branchId');
  }
};
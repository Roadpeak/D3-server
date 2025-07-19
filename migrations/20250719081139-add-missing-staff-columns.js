// migrations/XXXXXXXXXXXXXX-add-missing-staff-columns.js
'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    console.log('🔧 Adding missing columns to staff table...');
    
    // Add branchId column
    console.log('Adding branchId column...');
    await queryInterface.addColumn('staff', 'branchId', {
      type: Sequelize.UUID,
      allowNull: true,
      comment: 'Reference to branch table'
    });
    
    // Add role column
    console.log('Adding role column...');
    await queryInterface.addColumn('staff', 'role', {
      type: Sequelize.ENUM('staff', 'manager', 'supervisor', 'cashier', 'sales'),
      defaultValue: 'staff',
      allowNull: false,
      comment: 'Staff role/position'
    });
    
    // Add indexes for better performance
    console.log('Adding database indexes...');
    await queryInterface.addIndex('staff', ['branchId'], {
      name: 'idx_staff_branch_id'
    });
    
    await queryInterface.addIndex('staff', ['role'], {
      name: 'idx_staff_role'
    });
    
    console.log('✅ Successfully added branchId and role columns to staff table');
    console.log('✅ Added performance indexes');
    
    // Verify the changes
    const staffTable = await queryInterface.describeTable('staff');
    console.log('📋 Updated staff table columns:', Object.keys(staffTable));
  },

  async down(queryInterface, Sequelize) {
    console.log('🔄 Reverting staff table changes...');
    
    // Remove indexes first
    try {
      await queryInterface.removeIndex('staff', 'idx_staff_role');
      console.log('Removed role index');
    } catch (err) {
      console.log('Role index may not exist, continuing...');
    }
    
    try {
      await queryInterface.removeIndex('staff', 'idx_staff_branch_id');
      console.log('Removed branchId index');
    } catch (err) {
      console.log('BranchId index may not exist, continuing...');
    }
    
    // Remove columns
    await queryInterface.removeColumn('staff', 'role');
    console.log('Removed role column');
    
    await queryInterface.removeColumn('staff', 'branchId');
    console.log('Removed branchId column');
    
    console.log('✅ Staff table rollback completed');
  }
};
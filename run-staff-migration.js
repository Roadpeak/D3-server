// run-staff-migration.js
// This will run only the staff migration directly

const { Sequelize } = require('sequelize');
const config = require('./config/config.js');

const env = process.env.NODE_ENV || 'development';
const dbConfig = config[env];

const sequelize = new Sequelize(dbConfig.database, dbConfig.username, dbConfig.password, {
  host: dbConfig.host,
  dialect: dbConfig.dialect,
  logging: console.log
});

// Import the migration module directly
async function runStaffMigration() {
  try {
    console.log('🚀 Running staff migration directly...');
    
    // This is the same logic as your migration file
    console.log('🔧 Adding missing columns to staff table...');
    
    // Check current structure first
    const staffTable = await sequelize.getQueryInterface().describeTable('staff');
    console.log('📋 Current staff columns:', Object.keys(staffTable));
    
    // Add branchId column if it doesn't exist
    if (!staffTable.branchId) {
      console.log('Adding branchId column...');
      await sequelize.getQueryInterface().addColumn('staff', 'branchId', {
        type: Sequelize.UUID,
        allowNull: true,
        comment: 'Reference to branch table'
      });
    } else {
      console.log('branchId column already exists, skipping...');
    }
    
    // Add role column if it doesn't exist
    if (!staffTable.role) {
      console.log('Adding role column...');
      await sequelize.getQueryInterface().addColumn('staff', 'role', {
        type: Sequelize.ENUM('staff', 'manager', 'supervisor', 'cashier', 'sales'),
        defaultValue: 'staff',
        allowNull: false,
        comment: 'Staff role/position'
      });
    } else {
      console.log('role column already exists, skipping...');
    }
    
    // Add indexes for better performance
    try {
      if (!staffTable.branchId) {
        console.log('Adding branchId index...');
        await sequelize.getQueryInterface().addIndex('staff', ['branchId'], {
          name: 'idx_staff_branch_id'
        });
      }
    } catch (err) {
      console.log('Index may already exist, continuing...');
    }
    
    try {
      if (!staffTable.role) {
        console.log('Adding role index...');
        await sequelize.getQueryInterface().addIndex('staff', ['role'], {
          name: 'idx_staff_role'
        });
      }
    } catch (err) {
      console.log('Index may already exist, continuing...');
    }
    
    console.log('✅ Successfully completed staff table migration');
    
    // Mark the migration as complete in SequelizeMeta
    await sequelize.query(`
      INSERT IGNORE INTO SequelizeMeta (name) 
      VALUES ('20250719081139-add-missing-staff-columns.js')
    `);
    console.log('✅ Marked migration as complete in SequelizeMeta');
    
    // Verify the changes
    const updatedStaffTable = await sequelize.getQueryInterface().describeTable('staff');
    console.log('📋 Updated staff table columns:', Object.keys(updatedStaffTable));
    
    const hasBranchId = updatedStaffTable.branchId ? '✅' : '❌';
    const hasRole = updatedStaffTable.role ? '✅' : '❌';
    
    console.log('🎯 Final verification:');
    console.log(`   branchId: ${hasBranchId}`);
    console.log(`   role: ${hasRole}`);
    
  } catch (error) {
    console.error('❌ Error running staff migration:', error.message);
    console.error('Full error:', error);
  } finally {
    await sequelize.close();
  }
}

runStaffMigration();
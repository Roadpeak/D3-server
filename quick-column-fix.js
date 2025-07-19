// quick-column-fix.js
const { Sequelize } = require('sequelize');
const config = require('./config/config.js');

const env = process.env.NODE_ENV || 'development';
const dbConfig = config[env];

const sequelize = new Sequelize(dbConfig.database, dbConfig.username, dbConfig.password, {
  host: dbConfig.host,
  dialect: dbConfig.dialect,
  logging: console.log
});

async function fixColumnSize() {
  try {
    console.log('🔧 Fixing branchId column size...');
    
    // Step 1: Check current foreign key constraints
    const [constraints] = await sequelize.query(`
      SELECT CONSTRAINT_NAME 
      FROM information_schema.KEY_COLUMN_USAGE 
      WHERE TABLE_NAME = 'staff' 
      AND COLUMN_NAME = 'branchId' 
      AND CONSTRAINT_NAME != 'PRIMARY'
    `);
    
    console.log('📋 Current constraints on branchId:', constraints);
    
    // Step 2: Drop foreign key constraint if it exists
    if (constraints.length > 0) {
      const constraintName = constraints[0].CONSTRAINT_NAME;
      console.log(`🗑️  Dropping foreign key constraint: ${constraintName}`);
      
      await sequelize.query(`
        ALTER TABLE staff 
        DROP FOREIGN KEY ${constraintName}
      `);
      console.log('✅ Foreign key constraint dropped');
    }
    
    // Step 3: Drop the index if it exists
    try {
      await sequelize.query(`ALTER TABLE staff DROP INDEX idx_staff_branch_id`);
      console.log('✅ Dropped branchId index');
    } catch (indexError) {
      console.log('ℹ️  Index may not exist, continuing...');
    }
    
    // Step 4: Modify the column
    await sequelize.query(`
      ALTER TABLE staff 
      MODIFY COLUMN branchId VARCHAR(255) NULL 
      COMMENT 'Reference to branch table'
    `);
    console.log('✅ Modified branchId column to VARCHAR(255)');
    
    // Step 5: Recreate the index
    await sequelize.query(`
      ALTER TABLE staff 
      ADD INDEX idx_staff_branch_id (branchId)
    `);
    console.log('✅ Recreated branchId index');
    
    // Step 6: Verify the change
    const [results] = await sequelize.query(`SHOW COLUMNS FROM staff WHERE Field = 'branchId'`);
    console.log('📋 New branchId column info:', results[0]);
    
    console.log('🎉 Column fix completed successfully!');
    
  } catch (error) {
    console.error('❌ Error fixing column:', error.message);
    console.error('Full error:', error);
  } finally {
    await sequelize.close();
  }
}

fixColumnSize();
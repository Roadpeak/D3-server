// cleanup-constraints.js
const { Sequelize } = require('sequelize');
const config = require('./config/config.js');

const env = process.env.NODE_ENV || 'development';
const dbConfig = config[env];

const sequelize = new Sequelize(dbConfig.database, dbConfig.username, dbConfig.password, {
  host: dbConfig.host,
  dialect: dbConfig.dialect,
  logging: console.log
});

async function cleanupConstraints() {
  try {
    console.log('🧹 Cleaning up foreign key constraints...');
    
    // Find all foreign key constraints on staff table
    const [constraints] = await sequelize.query(`
      SELECT CONSTRAINT_NAME, COLUMN_NAME, REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME
      FROM information_schema.KEY_COLUMN_USAGE 
      WHERE TABLE_SCHEMA = '${dbConfig.database}'
      AND TABLE_NAME = 'staff' 
      AND REFERENCED_TABLE_NAME IS NOT NULL
    `);
    
    console.log('📋 Found constraints:', constraints);
    
    // Drop constraints related to branchId
    for (const constraint of constraints) {
      if (constraint.COLUMN_NAME === 'branchId') {
        console.log(`🗑️  Dropping constraint: ${constraint.CONSTRAINT_NAME}`);
        try {
          await sequelize.query(`
            ALTER TABLE staff 
            DROP FOREIGN KEY ${constraint.CONSTRAINT_NAME}
          `);
          console.log(`✅ Dropped: ${constraint.CONSTRAINT_NAME}`);
        } catch (dropError) {
          console.log(`⚠️  Could not drop ${constraint.CONSTRAINT_NAME}:`, dropError.message);
        }
      }
    }
    
    // Now modify the column to VARCHAR(255)
    console.log('🔧 Modifying branchId column...');
    await sequelize.query(`
      ALTER TABLE staff 
      MODIFY COLUMN branchId VARCHAR(255) NULL 
      COMMENT 'Reference to branch table'
    `);
    console.log('✅ Modified branchId column to VARCHAR(255)');
    
    // Verify the change
    const [results] = await sequelize.query(`SHOW COLUMNS FROM staff WHERE Field = 'branchId'`);
    console.log('📋 New branchId column info:', results[0]);
    
    console.log('🎉 Cleanup completed successfully!');
    
  } catch (error) {
    console.error('❌ Error during cleanup:', error.message);
    console.error('Full error:', error);
  } finally {
    await sequelize.close();
  }
}

cleanupConstraints();
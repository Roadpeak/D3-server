// mark-services-migration-complete.js
// Run this with: node mark-services-migration-complete.js

const { Sequelize } = require('sequelize');
const config = require('./config/config.js');

const env = process.env.NODE_ENV || 'development';
const dbConfig = config[env];

const sequelize = new Sequelize(dbConfig.database, dbConfig.username, dbConfig.password, {
  host: dbConfig.host,
  dialect: dbConfig.dialect,
  logging: console.log
});

async function markMigrationComplete() {
  try {
    console.log('🔧 Marking services migration as complete...');
    
    // Insert the migration name into SequelizeMeta table
    await sequelize.query(`
      INSERT IGNORE INTO SequelizeMeta (name) 
      VALUES ('20241127145918-add-type-to-services.js')
    `);
    
    console.log('✅ Services migration marked as complete');
    
    // Verify it was added
    const [results] = await sequelize.query(`
      SELECT name FROM SequelizeMeta 
      WHERE name = '20241127145918-add-type-to-services.js'
    `);
    
    if (results.length > 0) {
      console.log('✅ Verified: Migration is now in SequelizeMeta table');
    } else {
      console.log('❌ Migration was not added to SequelizeMeta table');
    }
    
    // Show current migration status
    console.log('\n📋 Current migrations in database:');
    const [allMigrations] = await sequelize.query(`
      SELECT name FROM SequelizeMeta ORDER BY name
    `);
    allMigrations.forEach(migration => {
      console.log(`  - ${migration.name}`);
    });
    
  } catch (error) {
    console.error('❌ Error marking migration as complete:', error.message);
  } finally {
    await sequelize.close();
  }
}

markMigrationComplete();
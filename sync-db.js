// sync-db.js - Force database synchronization
const { sequelize } = require('./models/index');

async function syncDatabase() {
  try {
    console.log('🔄 Starting database synchronization...');

    // Test connection first
    await sequelize.authenticate();
    console.log('✅ Database connection established');

    // Synchronize all models with the database
    await sequelize.sync({ force: false });
    console.log('✅ All models synchronized successfully');

    // List all tables
    const [tables] = await sequelize.query(`SHOW TABLES`);
    console.log('📋 Tables created:');
    tables.forEach(table => {
      console.log(`  - ${Object.values(table)[0]}`);
    });

    process.exit(0);
  } catch (error) {
    console.error('❌ Database synchronization failed:', error);
    process.exit(1);
  }
}

syncDatabase();

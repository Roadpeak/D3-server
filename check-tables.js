// check-tables.js - Run this to see current table structure
// Save this file in your project root and run: node check-tables.js
const { Sequelize } = require('sequelize');
const config = require('./config/config.js');

const env = process.env.NODE_ENV || 'development';
const dbConfig = config[env];

const sequelize = new Sequelize(dbConfig.database, dbConfig.username, dbConfig.password, {
  host: dbConfig.host,
  dialect: dbConfig.dialect
});

async function checkTables() {
  try {
    // Check staff table structure
    const staffColumns = await sequelize.getQueryInterface().describeTable('staff');
    console.log('Staff table columns:', Object.keys(staffColumns));
    
    // Check services table structure  
    const servicesColumns = await sequelize.getQueryInterface().describeTable('services');
    console.log('Services table columns:', Object.keys(servicesColumns));
    
    // Check if type column exists in services
    if (servicesColumns.type) {
      console.log('Type column already exists in services table');
    } else {
      console.log('Type column does NOT exist in services table');
    }
    
    // Check if branchId exists in staff
    if (staffColumns.branchId) {
      console.log('branchId column already exists in staff table');
    } else {
      console.log('branchId column does NOT exist in staff table');
    }
    
    // Check if role exists in staff
    if (staffColumns.role) {
      console.log('role column already exists in staff table');
    } else {
      console.log('role column does NOT exist in staff table');
    }
    
  } catch (error) {
    console.error('Error checking tables:', error.message);
  } finally {
    await sequelize.close();
  }
}

checkTables();
const { Sequelize, DataTypes } = require('sequelize');
require('dotenv').config();

// Initialize Sequelize instance
const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASSWORD,
  {
    host: process.env.DB_HOST,
    dialect: 'mysql',
    logging: false, // Disable logging for production
  }
);

// Import models
const User = require('./user')(sequelize, DataTypes);
const Merchant = require('./merchant')(sequelize, DataTypes);
const Store = require('./store')(sequelize, DataTypes);
const Service = require('./service')(sequelize, DataTypes);
const Staff = require('./staff')(sequelize, DataTypes);
const StaffService = require('./StaffService')(sequelize, DataTypes); // Import the junction table

// Define model relationships after all models are imported
Staff.belongsToMany(Service, {
  through: StaffService,
  foreignKey: 'staffId',
  otherKey: 'serviceId',
});

Service.belongsToMany(Staff, {
  through: StaffService,
  foreignKey: 'serviceId',
  otherKey: 'staffId',
});

// Associations for other models (if any)
Service.belongsTo(Store, {
  foreignKey: 'store_id',
  onDelete: 'CASCADE',
});

module.exports = { User, Merchant, Store, Service, Staff, StaffService, sequelize };

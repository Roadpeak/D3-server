const { Sequelize, DataTypes } = require('sequelize');
require('dotenv').config();

const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASSWORD,
  {
    host: process.env.DB_HOST,
    dialect: 'mysql',
    logging: false,
  }
);

const User = require('./user')(sequelize, DataTypes);
const Merchant = require('./merchant')(sequelize, DataTypes);
const Booking = require('./bookings')(sequelize, DataTypes);
const Store = require('./store')(sequelize, DataTypes);
const Service = require('./service')(sequelize, DataTypes);
const Staff = require('./staff')(sequelize, DataTypes);
const Offer = require('./offer')(sequelize, DataTypes);
const StaffService = require('./StaffService')(sequelize, DataTypes);

const ServiceForm = require('./serviceform')(sequelize, DataTypes);
const FormResponse = require('./formresponse')(sequelize, DataTypes);
const Quote = require('./quote')(sequelize, DataTypes);

// Many-to-Many relationship between Staff and Service
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

// Association between Service and Store
Service.belongsTo(Store, {
  foreignKey: 'store_id',
  onDelete: 'CASCADE',
});

// Association between Service and ServiceForm
ServiceForm.belongsTo(Service, {
  foreignKey: 'service_id',
  onDelete: 'CASCADE',
});

Service.hasMany(ServiceForm, {
  foreignKey: 'service_id',
});

// Association between FormResponse and ServiceForm
FormResponse.belongsTo(ServiceForm, {
  foreignKey: 'service_form_id',
  onDelete: 'CASCADE',
});

ServiceForm.hasMany(FormResponse, {
  foreignKey: 'service_form_id',
});

// Association between FormResponse and User
FormResponse.belongsTo(User, {
  foreignKey: 'user_id',
  onDelete: 'CASCADE',
});

// Association between Quote and FormResponse
Quote.belongsTo(FormResponse, {
  foreignKey: 'form_response_id',
  onDelete: 'CASCADE',
});

FormResponse.hasOne(Quote, {
  foreignKey: 'form_response_id',
});

// NEW ASSOCIATIONS

// Association between Booking and Offer
Booking.belongsTo(Offer, {
  foreignKey: 'offerId',
  onDelete: 'CASCADE', // Optional: you can adjust this behavior based on your use case
});

// Association between Offer and Service
Offer.belongsTo(Service, {
  foreignKey: 'service_id',
  onDelete: 'CASCADE',
});

// Association between Booking and Store (You might already have this, if not add it)
Booking.belongsTo(Store, {
  foreignKey: 'storeId',
  onDelete: 'CASCADE',
});

// Optionally, you might want to associate Offer with Store as well if necessary
Store.hasMany(Offer, {
  foreignKey: 'storeId',
  onDelete: 'CASCADE',
});

module.exports = {
  User,
  Merchant,
  Store,
  Service,
  Offer,
  Staff,
  StaffService,
  ServiceForm,
  FormResponse,
  Quote,
  Booking,
  sequelize,
};

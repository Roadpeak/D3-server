'use strict';

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
const Payment = require('./payment')(sequelize, DataTypes);
const StaffService = require('./StaffService')(sequelize, DataTypes);
const ServiceForm = require('./serviceform')(sequelize, DataTypes);
const FormResponse = require('./formresponse')(sequelize, DataTypes);
const Social = require('./social')(sequelize, DataTypes);
const Review = require('./review')(sequelize, DataTypes);
const Quote = require('./quote')(sequelize, DataTypes);

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

Service.belongsTo(Store, {
  foreignKey: 'store_id',
  onDelete: 'CASCADE',
});

Store.hasMany(Service, {
  foreignKey: 'store_id',
});

ServiceForm.belongsTo(Service, {
  foreignKey: 'service_id',
  onDelete: 'CASCADE',
});

Service.hasMany(ServiceForm, {
  foreignKey: 'service_id',
});

FormResponse.belongsTo(ServiceForm, {
  foreignKey: 'service_form_id',
  onDelete: 'CASCADE',
});

ServiceForm.hasMany(FormResponse, {
  foreignKey: 'service_form_id',
});

FormResponse.belongsTo(User, {
  foreignKey: 'user_id',
  onDelete: 'CASCADE',
});

User.hasMany(FormResponse, {
  foreignKey: 'user_id',
});

Quote.belongsTo(FormResponse, {
  foreignKey: 'form_response_id',
  onDelete: 'CASCADE',
});

FormResponse.hasOne(Quote, {
  foreignKey: 'form_response_id',
});

Booking.belongsTo(Offer, {
  foreignKey: 'offerId',
  onDelete: 'CASCADE',
});

Offer.hasMany(Booking, {
  foreignKey: 'offerId',
});

Offer.belongsTo(Service, {
  foreignKey: 'service_id',
  onDelete: 'CASCADE',
});

Service.hasMany(Offer, {
  foreignKey: 'service_id',
});

Booking.belongsTo(Store, {
  foreignKey: 'storeId',
  onDelete: 'CASCADE',
});

Store.hasMany(Booking, {
  foreignKey: 'storeId',
});

Booking.belongsTo(User, {
  foreignKey: 'userId',
  onDelete: 'CASCADE',
});

User.hasMany(Booking, {
  foreignKey: 'userId',
});

Offer.belongsTo(Store, {
  foreignKey: 'storeId',
  onDelete: 'CASCADE',
});

Store.hasMany(Offer, {
  foreignKey: 'storeId',
});

Review.belongsTo(Store, {
  foreignKey: 'store_id',
  onDelete: 'CASCADE',
});

Review.belongsTo(User, {
  foreignKey: 'user_id',
  onDelete: 'SET NULL',
});

Store.hasMany(Review, {
  foreignKey: 'store_id',
  onDelete: 'CASCADE',
});

User.hasMany(Review, {
  foreignKey: 'user_id',
  onDelete: 'SET NULL',
});

Merchant.hasMany(Store, { foreignKey: 'merchant_id', onDelete: 'CASCADE' });
Store.belongsTo(Merchant, { foreignKey: 'merchant_id', onDelete: 'CASCADE' });

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
  Payment,
  Social,
  Review,
  sequelize,
};

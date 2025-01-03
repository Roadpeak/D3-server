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
const Social = require('./social')(sequelize, DataTypes);
const Review = require('./review')(sequelize, DataTypes);
const Form = require('./form')(sequelize, DataTypes);
const FormField = require('./formfield')(sequelize, DataTypes);
const FormResponse = require('./formresponse')(sequelize, DataTypes);
const Quote = require('./quote')(sequelize, DataTypes);
const Invoice = require('./invoice')(sequelize, DataTypes);
const Follow = require('./follow')(sequelize, DataTypes);
const Category = require('./category')(sequelize, DataTypes);
const StoreSubscription = require('./storesubscription')(sequelize, DataTypes);

// Staff-Service Many-to-Many
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

// Service-Store One-to-Many
Service.belongsTo(Store, {
  foreignKey: 'store_id',
  onDelete: 'CASCADE',
});

Store.hasMany(Service, {
  foreignKey: 'store_id',
});

// ServiceForm-Service One-to-Many
ServiceForm.belongsTo(Service, {
  foreignKey: 'service_id',
  onDelete: 'CASCADE',
});

Service.hasMany(ServiceForm, {
  foreignKey: 'service_id',
});

// FormResponse-ServiceForm One-to-Many
FormResponse.belongsTo(ServiceForm, {
  foreignKey: 'service_form_id',
  onDelete: 'CASCADE',
});

ServiceForm.hasMany(FormResponse, {
  foreignKey: 'service_form_id',
});

// FormResponse-User One-to-Many
FormResponse.belongsTo(User, {
  foreignKey: 'user_id',
  onDelete: 'CASCADE',
});

User.hasMany(FormResponse, {
  foreignKey: 'user_id',
});

// Quote-FormResponse One-to-One
Quote.belongsTo(FormResponse, {
  foreignKey: 'form_response_id',
  onDelete: 'CASCADE',
});

FormResponse.hasOne(Quote, {
  foreignKey: 'form_response_id',
});

// Booking-Offer One-to-Many
Booking.belongsTo(Offer, {
  foreignKey: 'offerId',
  onDelete: 'CASCADE',
});

Offer.hasMany(Booking, {
  foreignKey: 'offerId',
});

// Offer-Service One-to-Many
Offer.belongsTo(Service, {
  foreignKey: 'service_id',
  onDelete: 'CASCADE',
});

Service.hasMany(Offer, {
  foreignKey: 'service_id',
});

// Booking-Store One-to-Many
Booking.belongsTo(Store, {
  foreignKey: 'storeId',
  onDelete: 'CASCADE',
});

Store.hasMany(Booking, {
  foreignKey: 'storeId',
});

// Booking-User One-to-Many
Booking.belongsTo(User, {
  foreignKey: 'userId',
  onDelete: 'CASCADE',
});

User.hasMany(Booking, {
  foreignKey: 'userId',
});

// Offer-Store One-to-Many
Offer.belongsTo(Store, {
  foreignKey: 'storeId',
  onDelete: 'CASCADE',
});

Store.hasMany(Offer, {
  foreignKey: 'storeId',
});

// Review-Store One-to-Many
Review.belongsTo(Store, {
  foreignKey: 'store_id',
  onDelete: 'CASCADE',
});

Store.hasMany(Review, {
  foreignKey: 'store_id',
  onDelete: 'CASCADE',
});

// Review-User One-to-Many
Review.belongsTo(User, {
  foreignKey: 'user_id',
  onDelete: 'SET NULL',
});

User.hasMany(Review, {
  foreignKey: 'user_id',
  onDelete: 'SET NULL',
});

// Merchant-Store One-to-Many
Merchant.hasMany(Store, { foreignKey: 'merchant_id', onDelete: 'CASCADE' });
Store.belongsTo(Merchant, { foreignKey: 'merchant_id', onDelete: 'CASCADE' });

// Form-FormField One-to-Many
Form.hasMany(FormField, {
  foreignKey: 'form_id',
  as: 'fields',
  onDelete: 'CASCADE',
});

FormField.belongsTo(Form, {
  foreignKey: 'form_id',
  as: 'form',
});

// Form-Service One-to-One
Form.belongsTo(Service, {
  foreignKey: 'service_id',
  as: 'service',
});

// **Invoice-Store One-to-Many**
Invoice.belongsTo(Store, {
  foreignKey: 'store_id',
  onDelete: 'CASCADE',
});

Store.hasMany(Invoice, {
  foreignKey: 'store_id',
});

// **StoreSubscription-Store One-to-One**
StoreSubscription.belongsTo(Store, {
  foreignKey: 'store_id',
  onDelete: 'CASCADE',
  as: 'store',
});

Store.hasOne(StoreSubscription, {
  foreignKey: 'store_id',
  as: 'subscription',
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
  FormField,
  Quote,
  Booking,
  Payment,
  Social,
  Review,
  Form,
  Invoice,
  StoreSubscription,
  Follow,
  Category,
  sequelize,
};

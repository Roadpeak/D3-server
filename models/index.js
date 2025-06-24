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
const StaffService = require('./StaffService')(sequelize, DataTypes);
const Staff = require('./staff')(sequelize, DataTypes);
const Offer = require('./offer')(sequelize, DataTypes);
const Payment = require('./payment')(sequelize, DataTypes);
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
const Chat = require('./chat')(sequelize, DataTypes);
const Message = require('./message')(sequelize, DataTypes);
const StoreSubscription = require('./storesubscription')(sequelize, DataTypes);

// Service-Store
Service.belongsTo(Store, { foreignKey: 'store_id', as: 'store', onDelete: 'CASCADE' });
Store.hasMany(Service, { foreignKey: 'store_id', as: 'services' });

// ServiceForm-Service
ServiceForm.belongsTo(Service, { foreignKey: 'service_id', as: 'service', onDelete: 'CASCADE' });
Service.hasMany(ServiceForm, { foreignKey: 'service_id', as: 'serviceForms' });

// FormResponse-ServiceForm
FormResponse.belongsTo(ServiceForm, { foreignKey: 'service_form_id', as: 'serviceForm', onDelete: 'CASCADE' });
ServiceForm.hasMany(FormResponse, { foreignKey: 'service_form_id', as: 'formResponses' });

// FormResponse-User
FormResponse.belongsTo(User, { foreignKey: 'user_id', as: 'formResponseUser', onDelete: 'CASCADE' });
User.hasMany(FormResponse, { foreignKey: 'user_id', as: 'formResponses' });

// Quote-FormResponse
Quote.belongsTo(FormResponse, { foreignKey: 'form_response_id', as: 'formResponse', onDelete: 'CASCADE' });
FormResponse.hasOne(Quote, { foreignKey: 'form_response_id', as: 'quote' });

// Booking-Offer
Booking.belongsTo(Offer, { foreignKey: 'offerId', as: 'offer', onDelete: 'CASCADE' });
Offer.hasMany(Booking, { foreignKey: 'offerId', as: 'bookings' });

// Offer-Service
Offer.belongsTo(Service, { foreignKey: 'service_id', as: 'service', onDelete: 'CASCADE' });
Service.hasMany(Offer, { foreignKey: 'service_id', as: 'offers' });

// Booking-Store
Booking.belongsTo(Store, { foreignKey: 'storeId', as: 'store', onDelete: 'CASCADE' });
Store.hasMany(Booking, { foreignKey: 'storeId', as: 'bookings' });

// Booking-User
Booking.belongsTo(User, { foreignKey: 'userId', as: 'bookingUser', onDelete: 'CASCADE' });
User.hasMany(Booking, { foreignKey: 'userId', as: 'bookings' });

// Offer-Store
Offer.belongsTo(Store, { foreignKey: 'storeId', as: 'store', onDelete: 'CASCADE' });
Store.hasMany(Offer, { foreignKey: 'storeId', as: 'offers' });

// Review-Store
Review.belongsTo(Store, { foreignKey: 'store_id', as: 'store', onDelete: 'CASCADE' });
Store.hasMany(Review, { foreignKey: 'store_id', as: 'reviews', onDelete: 'CASCADE' });

// Review-User
Review.belongsTo(User, { foreignKey: 'user_id', as: 'reviewUser', onDelete: 'SET NULL' });
User.hasMany(Review, { foreignKey: 'user_id', as: 'reviews', onDelete: 'SET NULL' });

// Merchant-Store
Merchant.hasMany(Store, { foreignKey: 'merchant_id', as: 'stores', onDelete: 'CASCADE' });
Store.belongsTo(Merchant, { foreignKey: 'merchant_id', as: 'merchant', onDelete: 'CASCADE' });

// Staff-Store
Staff.belongsTo(Store, { foreignKey: 'store_id', as: 'store', onDelete: 'CASCADE' });
Store.hasMany(Staff, { foreignKey: 'store_id', as: 'staff' });

// Staff-Service (Many-to-Many)
Staff.belongsToMany(Service, {
  through: StaffService,
  foreignKey: 'staffId',
  otherKey: 'serviceId',
  as: 'services',
});
Service.belongsToMany(Staff, {
  through: StaffService,
  foreignKey: 'serviceId',
  otherKey: 'staffId',
  as: 'staff',
});

// Form-FormField
Form.hasMany(FormField, { foreignKey: 'form_id', as: 'fields', onDelete: 'CASCADE' });
FormField.belongsTo(Form, { foreignKey: 'form_id', as: 'form' });

// Form-Service
Form.belongsTo(Service, { foreignKey: 'service_id', as: 'service' });
Service.hasOne(Form, { foreignKey: 'service_id', as: 'form' });

// Invoice-Store
Invoice.belongsTo(Store, { foreignKey: 'store_id', as: 'store', onDelete: 'CASCADE' });
Store.hasMany(Invoice, { foreignKey: 'store_id', as: 'invoices' });

// Payment-Booking
Payment.belongsTo(Booking, { foreignKey: 'booking_id', as: 'booking', onDelete: 'CASCADE' });
Booking.hasMany(Payment, { foreignKey: 'booking_id', as: 'payments' });

// Payment-User
Payment.belongsTo(User, { foreignKey: 'user_id', as: 'paymentUser', onDelete: 'CASCADE' });
User.hasMany(Payment, { foreignKey: 'user_id', as: 'paymentUsers' });

// StoreSubscription-Store
StoreSubscription.belongsTo(Store, { foreignKey: 'store_id', as: 'store', onDelete: 'CASCADE' });
Store.hasOne(StoreSubscription, { foreignKey: 'store_id', as: 'subscription' });

// User-Chat
User.hasMany(Chat, { foreignKey: 'userId', as: 'chatUsers' });
Chat.belongsTo(User, { foreignKey: 'userId', as: 'chatUser' });

// Chat-Store
Chat.belongsTo(Store, { foreignKey: 'storeId', as: 'store' });
Store.hasMany(Chat, { foreignKey: 'storeId', as: 'chats' });

// Chat-Message
Chat.hasMany(Message, { foreignKey: 'chat_id', as: 'messages', onDelete: 'CASCADE' });
Message.belongsTo(Chat, { foreignKey: 'chat_id', as: 'chat' });

// Message-User
Message.belongsTo(User, { foreignKey: 'sender_id', as: 'sender', onDelete: 'CASCADE' });
User.hasMany(Message, { foreignKey: 'sender_id', as: 'sentMessages' });

// Follow-User
Follow.belongsTo(User, { foreignKey: 'follower_id', as: 'follower', onDelete: 'CASCADE' });
Follow.belongsTo(User, { foreignKey: 'following_id', as: 'following', onDelete: 'CASCADE' });

User.hasMany(Follow, { foreignKey: 'follower_id', as: 'following' });
User.hasMany(Follow, { foreignKey: 'following_id', as: 'followers' });

// Category-Service
Category.hasMany(Service, {
  foreignKey: 'category_id',
  as: 'services',
});

Service.belongsTo(Category, {
  foreignKey: 'category_id',
  as: 'serviceCategory',
});


// Social-Store
Social.belongsTo(Store, { foreignKey: 'store_id', as: 'store', onDelete: 'CASCADE' });
Store.hasMany(Social, { foreignKey: 'store_id', as: 'socialLinks' });

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
  Chat,
  Message,
  sequelize,
};

// models/index.js - UPDATED WITH REEL MODELS

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

// Import existing models
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
const Social = require('./Social')(sequelize, DataTypes);
const Review = require('./review')(sequelize, DataTypes);
const Form = require('./form')(sequelize, DataTypes);
const FormField = require('./formField')(sequelize, DataTypes);
const FormResponse = require('./formresponse')(sequelize, DataTypes);
const Quote = require('./quote')(sequelize, DataTypes);
const Invoice = require('./invoice')(sequelize, DataTypes);
const Follow = require('./follow')(sequelize, DataTypes);
const Category = require('./category')(sequelize, DataTypes);
const Chat = require('./chat')(sequelize, DataTypes);
const Message = require('./message')(sequelize, DataTypes);
const Favorite = require('./Favorite')(sequelize, DataTypes);
const StoreSubscription = require('./StoreSubscription')(sequelize, DataTypes);
const Branch = require('./Branch')(sequelize, DataTypes);

// SERVICE MARKETPLACE MODELS
const ServiceRequest = require('./ServiceRequest')(sequelize, DataTypes);
const ServiceOffer = require('./ServiceOffer')(sequelize, DataTypes);
const Notification = require('./notification')(sequelize, DataTypes);

// WEB PUSH MODEL
const PushSubscription = require('./PushSubscription')(sequelize, DataTypes);

// REELS MODELS (NEW)
const Reel = require('./reel')(sequelize, DataTypes);
const ReelLike = require('./reelLike')(sequelize, DataTypes);
const ReelView = require('./reelView')(sequelize, DataTypes);

// ==========================================
// MODEL ASSOCIATIONS
// ==========================================

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

Service.hasMany(Booking, { foreignKey: 'serviceId', as: 'bookings' });
Booking.belongsTo(Service, { foreignKey: 'serviceId', as: 'service' });

// Offer-Service
Offer.belongsTo(Service, { foreignKey: 'service_id', as: 'service', onDelete: 'CASCADE' });
Service.hasMany(Offer, { foreignKey: 'service_id', as: 'offers' });

// Booking-Store
Booking.belongsTo(Store, { foreignKey: 'storeId', as: 'store', onDelete: 'CASCADE' });
Store.hasMany(Booking, { foreignKey: 'storeId', as: 'bookings' });

// Booking-User
Booking.belongsTo(User, { foreignKey: 'userId', as: 'bookingUser', onDelete: 'CASCADE' });
User.hasMany(Booking, { foreignKey: 'userId', as: 'bookings' });

Booking.belongsTo(Payment, { foreignKey: 'paymentId', as: 'payment' });

// Booking-Staff association
Booking.belongsTo(Staff, {
  foreignKey: 'staffId',
  as: 'staff',
  onDelete: 'SET NULL'
});
Staff.hasMany(Booking, {
  foreignKey: 'staffId',
  as: 'bookings'
});

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
Staff.belongsTo(Store, { foreignKey: 'storeId', as: 'store', onDelete: 'CASCADE' });
Store.hasMany(Staff, { foreignKey: 'storeId', as: 'staff' });

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

// Message replies
Message.belongsTo(Message, { foreignKey: 'replyTo', as: 'replyToMessage' });
Message.hasMany(Message, { foreignKey: 'replyTo', as: 'replies' });

// Follow-User
Follow.belongsTo(User, {
  foreignKey: 'user_id',
  as: 'user',
  onDelete: 'CASCADE'
});
User.hasMany(Follow, {
  foreignKey: 'user_id',
  as: 'follows'
});

// Follow-Store
Follow.belongsTo(Store, {
  foreignKey: 'store_id',
  as: 'store',
  onDelete: 'CASCADE'
});
Store.hasMany(Follow, {
  foreignKey: 'store_id',
  as: 'followers'
});

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

// ==========================================
// FAVORITES ASSOCIATIONS
// ==========================================

// Favorite-User
Favorite.belongsTo(User, {
  foreignKey: 'user_id',
  as: 'user',
  onDelete: 'CASCADE',
  onUpdate: 'CASCADE'
});
User.hasMany(Favorite, {
  foreignKey: 'user_id',
  as: 'favorites'
});

// Favorite-Offer
Favorite.belongsTo(Offer, {
  foreignKey: 'offer_id',
  as: 'offer',
  onDelete: 'CASCADE',
  onUpdate: 'CASCADE'
});
Offer.hasMany(Favorite, {
  foreignKey: 'offer_id',
  as: 'favorites'
});

// ==========================================
// BRANCH ASSOCIATIONS
// ==========================================

// Branch-Store
Branch.belongsTo(Store, {
  foreignKey: 'storeId',
  as: 'Store',
  onDelete: 'CASCADE'
});
Store.hasMany(Branch, {
  foreignKey: 'storeId',
  as: 'Branches'
});

// Branch-Merchant  
Branch.belongsTo(Merchant, {
  foreignKey: 'merchantId',
  as: 'Merchant',
  onDelete: 'CASCADE'
});
Merchant.hasMany(Branch, {
  foreignKey: 'merchantId',
  as: 'Branches'
});

// Staff-Branch association
Staff.belongsTo(Branch, {
  foreignKey: 'branchId',
  as: 'branch',
  onDelete: 'SET NULL'
});
Branch.hasMany(Staff, {
  foreignKey: 'branchId',
  as: 'staff'
});

// Service-Branch association
Service.belongsTo(Branch, {
  foreignKey: 'branch_id',
  as: 'branch',
  onDelete: 'SET NULL'
});
Branch.hasMany(Service, {
  foreignKey: 'branch_id',
  as: 'services'
});

// ==========================================
// SERVICE MARKETPLACE ASSOCIATIONS
// ==========================================

// ServiceRequest-User
ServiceRequest.belongsTo(User, {
  foreignKey: 'postedBy',
  as: 'postedByUser',
  onDelete: 'CASCADE'
});
User.hasMany(ServiceRequest, {
  foreignKey: 'postedBy',
  as: 'serviceRequests'
});

// ServiceOffer-ServiceRequest
ServiceOffer.belongsTo(ServiceRequest, {
  foreignKey: 'requestId',
  as: 'request',
  onDelete: 'CASCADE'
});
ServiceRequest.hasMany(ServiceOffer, {
  foreignKey: 'requestId',
  as: 'offers'
});

// ServiceOffer-User (provider)
ServiceOffer.belongsTo(User, {
  foreignKey: 'providerId',
  as: 'provider',
  onDelete: 'CASCADE'
});
User.hasMany(ServiceOffer, {
  foreignKey: 'providerId',
  as: 'sentOffers'
});

// ServiceOffer-Store
ServiceOffer.belongsTo(Store, {
  foreignKey: 'storeId',
  as: 'store',
  onDelete: 'CASCADE'
});
Store.hasMany(ServiceOffer, {
  foreignKey: 'storeId',
  as: 'serviceOffers'
});

// Handle acceptedOffer relationship
ServiceRequest.belongsTo(ServiceOffer, {
  foreignKey: 'acceptedOfferId',
  as: 'acceptedOffer',
  constraints: false
});
ServiceOffer.hasOne(ServiceRequest, {
  foreignKey: 'acceptedOfferId',
  as: 'acceptedRequest',
  constraints: false
});

// ServiceOffer self-reference for revisions
ServiceOffer.belongsTo(ServiceOffer, {
  foreignKey: 'originalOfferId',
  as: 'originalOffer',
  constraints: false
});
ServiceOffer.hasMany(ServiceOffer, {
  foreignKey: 'originalOfferId',
  as: 'revisions',
  constraints: false
});

// ==========================================
// NOTIFICATION ASSOCIATIONS
// ==========================================

// Notification-User (recipient)
Notification.belongsTo(User, {
  foreignKey: 'userId',
  as: 'recipient',
  onDelete: 'CASCADE'
});
User.hasMany(Notification, {
  foreignKey: 'userId',
  as: 'notifications'
});

// Notification-User (sender)
Notification.belongsTo(User, {
  foreignKey: 'senderId',
  as: 'sender',
  onDelete: 'SET NULL'
});
User.hasMany(Notification, {
  foreignKey: 'senderId',
  as: 'sentNotifications'
});

// Notification-Store
Notification.belongsTo(Store, {
  foreignKey: 'storeId',
  as: 'store',
  onDelete: 'CASCADE'
});
Store.hasMany(Notification, {
  foreignKey: 'storeId',
  as: 'notifications'
});

// ==========================================
// REELS ASSOCIATIONS (NEW)
// ==========================================

// Reel-Merchant
Reel.belongsTo(Merchant, {
  foreignKey: 'merchant_id',
  as: 'merchant',
  onDelete: 'CASCADE'
});
Merchant.hasMany(Reel, {
  foreignKey: 'merchant_id',
  as: 'reels'
});

// Reel-Store
Reel.belongsTo(Store, {
  foreignKey: 'store_id',
  as: 'store',
  onDelete: 'CASCADE'
});
Store.hasMany(Reel, {
  foreignKey: 'store_id',
  as: 'reels'
});

// Reel-Service
Reel.belongsTo(Service, {
  foreignKey: 'service_id',
  as: 'service',
  onDelete: 'CASCADE'
});
Service.hasMany(Reel, {
  foreignKey: 'service_id',
  as: 'reels'
});

// ReelLike-Reel
ReelLike.belongsTo(Reel, {
  foreignKey: 'reel_id',
  as: 'reel',
  onDelete: 'CASCADE'
});
Reel.hasMany(ReelLike, {
  foreignKey: 'reel_id',
  as: 'reelLikes'
});

// ReelLike-User
ReelLike.belongsTo(User, {
  foreignKey: 'user_id',
  as: 'user',
  onDelete: 'CASCADE'
});
User.hasMany(ReelLike, {
  foreignKey: 'user_id',
  as: 'likedReels'
});

// ReelView-Reel
ReelView.belongsTo(Reel, {
  foreignKey: 'reel_id',
  as: 'reel',
  onDelete: 'CASCADE'
});
Reel.hasMany(ReelView, {
  foreignKey: 'reel_id',
  as: 'reelViews'
});

// ReelView-User
ReelView.belongsTo(User, {
  foreignKey: 'user_id',
  as: 'user',
  onDelete: 'SET NULL'
});
User.hasMany(ReelView, {
  foreignKey: 'user_id',
  as: 'viewedReels'
});

// ==========================================
// EXPORTS
// ==========================================

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
  Favorite,
  Branch,
  ServiceRequest,
  ServiceOffer,
  Notification,
  PushSubscription,
  Reel,
  ReelLike,
  ReelView,
  sequelize,
};
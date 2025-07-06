const mongoose = require('mongoose');

// Merchant Schema
const merchantSchema = new mongoose.Schema({
    storeName: {
        type: String,
        required: true,
        trim: true
    },
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true
    },
    phone: {
        type: String,
        trim: true
    },
    subscription: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Subscription'
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

// Subscription Schema
const subscriptionSchema = new mongoose.Schema({
    merchantId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Merchant',
        required: true
    },
    plan: {
        type: String,
        enum: ['basic', 'premium', 'enterprise'],
        required: true
    },
    status: {
        type: String,
        enum: ['active', 'inactive', 'cancelled', 'expired'],
        default: 'active'
    },
    maxEmailsPerMonth: {
        type: Number,
        default: 1000
    },
    emailsSentThisMonth: {
        type: Number,
        default: 0
    },
    startDate: {
        type: Date,
        default: Date.now
    },
    expiresAt: {
        type: Date,
        required: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

// Follower Schema
const followerSchema = new mongoose.Schema({
    merchantId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Merchant',
        required: true
    },
    name: {
        type: String,
        required: true,
        trim: true
    },
    email: {
        type: String,
        required: true,
        lowercase: true,
        trim: true
    },
    phone: {
        type: String,
        trim: true
    },
    avatar: {
        type: String,
        default: null
    },
    isVip: {
        type: Boolean,
        default: false
    },
    followedSince: {
        type: Date,
        default: Date.now
    },
    lastActive: {
        type: Date,
        default: Date.now
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

// Customer Schema
const customerSchema = new mongoose.Schema({
    merchantId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Merchant',
        required: true
    },
    name: {
        type: String,
        required: true,
        trim: true
    },
    email: {
        type: String,
        required: true,
        lowercase: true,
        trim: true
    },
    phone: {
        type: String,
        trim: true
    },
    avatar: {
        type: String,
        default: null
    },
    isVip: {
        type: Boolean,
        default: false
    },
    bookingType: {
        type: String,
        enum: ['service', 'offer'],
        required: true
    },
    bookingDetails: {
        type: String,
        trim: true
    },
    lastBookingDate: {
        type: Date,
        required: true
    },
    totalBookings: {
        type: Number,
        default: 1
    },
    totalSpent: {
        type: String,
        default: '$0.00'
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

// Bulk Email Log Schema
const bulkEmailLogSchema = new mongoose.Schema({
    merchantId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Merchant',
        required: true
    },
    recipientType: {
        type: String,
        enum: ['followers', 'customers'],
        required: true
    },
    recipientCount: {
        type: Number,
        required: true
    },
    subject: {
        type: String,
        required: true,
        trim: true
    },
    message: {
        type: String,
        required: true
    },
    sentAt: {
        type: Date,
        default: Date.now
    }
});

// Indexes for better performance
followerSchema.index({ merchantId: 1, email: 1 }, { unique: true });
customerSchema.index({ merchantId: 1, email: 1 });
subscriptionSchema.index({ merchantId: 1 });
bulkEmailLogSchema.index({ merchantId: 1, sentAt: -1 });

// Auto-update the updatedAt field
merchantSchema.pre('save', function(next) {
    this.updatedAt = Date.now();
    next();
});

subscriptionSchema.pre('save', function(next) {
    this.updatedAt = Date.now();
    next();
});

followerSchema.pre('save', function(next) {
    this.updatedAt = Date.now();
    next();
});

customerSchema.pre('save', function(next) {
    this.updatedAt = Date.now();
    next();
});

// Create models
const Merchant = mongoose.model('Merchant', merchantSchema);
const Subscription = mongoose.model('Subscription', subscriptionSchema);
const Follower = mongoose.model('Follower', followerSchema);
const Customer = mongoose.model('Customer', customerSchema);
const BulkEmailLog = mongoose.model('BulkEmailLog', bulkEmailLogSchema);

module.exports = {
    Merchant,
    Subscription,
    Follower,
    Customer,
    BulkEmailLog
};
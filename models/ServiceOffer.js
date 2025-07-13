// /models/serviceOffer.js
const mongoose = require('mongoose');

const serviceOfferSchema = new mongoose.Schema({
  requestId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ServiceRequest',
    required: [true, 'Service request is required']
  },
  providerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Provider is required']
  },
  storeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Store',
    required: [true, 'Store is required']
  },
  quotedPrice: {
    type: Number,
    required: [true, 'Quoted price is required'],
    min: [0, 'Price cannot be negative']
  },
  message: {
    type: String,
    required: [true, 'Offer message is required'],
    trim: true,
    maxlength: [1000, 'Message cannot exceed 1000 characters']
  },
  availability: {
    type: String,
    required: [true, 'Availability is required'],
    trim: true,
    maxlength: [200, 'Availability cannot exceed 200 characters']
  },
  estimatedDuration: {
    type: String,
    trim: true
  },
  includesSupplies: {
    type: Boolean,
    default: false
  },
  warranty: {
    offered: { type: Boolean, default: false },
    duration: String, // e.g., "30 days", "1 year"
    terms: String
  },
  status: {
    type: String,
    enum: ['pending', 'accepted', 'rejected', 'withdrawn', 'expired'],
    default: 'pending'
  },
  statusReason: {
    type: String,
    trim: true
  },
  acceptedAt: Date,
  rejectedAt: Date,
  withdrawnAt: Date,
  expiresAt: {
    type: Date,
    default: function() {
      // Offers expire after 7 days
      return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    }
  },
  responseTime: {
    type: Number, // Hours between request creation and offer submission
    default: 0
  },
  revisionCount: {
    type: Number,
    default: 0
  },
  originalOffer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ServiceOffer'
  },
  negotiationHistory: [{
    type: { type: String, enum: ['price_change', 'timeline_change', 'scope_change'] },
    oldValue: mongoose.Schema.Types.Mixed,
    newValue: mongoose.Schema.Types.Mixed,
    reason: String,
    changedAt: { type: Date, default: Date.now },
    changedBy: { type: String, enum: ['provider', 'customer'] }
  }],
  attachments: [{
    url: String,
    filename: String,
    fileType: String,
    description: String
  }]
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
serviceOfferSchema.index({ requestId: 1 });
serviceOfferSchema.index({ providerId: 1 });
serviceOfferSchema.index({ storeId: 1 });
serviceOfferSchema.index({ status: 1 });
serviceOfferSchema.index({ createdAt: -1 });
serviceOfferSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
serviceOfferSchema.index({ quotedPrice: 1 });

// Compound indexes for common queries
serviceOfferSchema.index({ requestId: 1, status: 1 });
serviceOfferSchema.index({ providerId: 1, status: 1 });
serviceOfferSchema.index({ storeId: 1, status: 1 });

// Virtual for competitive positioning
serviceOfferSchema.virtual('isCompetitive').get(function() {
  // This would be calculated based on other offers for the same request
  return true; // Placeholder
});

// Middleware to calculate response time
serviceOfferSchema.pre('save', async function(next) {
  if (this.isNew && this.requestId) {
    try {
      const ServiceRequest = mongoose.model('ServiceRequest');
      const request = await ServiceRequest.findById(this.requestId);
      if (request) {
        const diffInMs = this.createdAt - request.createdAt;
        this.responseTime = diffInMs / (1000 * 60 * 60); // Convert to hours
      }
    } catch (error) {
      console.error('Error calculating response time:', error);
    }
  }
  next();
});

module.exports = mongoose.model('ServiceOffer', serviceOfferSchema);
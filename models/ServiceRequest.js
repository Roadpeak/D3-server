// /models/serviceRequest.js
const mongoose = require('mongoose');

const serviceRequestSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Service title is required'],
    trim: true,
    maxlength: [200, 'Title cannot exceed 200 characters']
  },
  description: {
    type: String,
    required: [true, 'Service description is required'],
    trim: true,
    maxlength: [2000, 'Description cannot exceed 2000 characters']
  },
  category: {
    type: String,
    required: [true, 'Service category is required'],
    enum: [
      'Home Services',
      'Auto Services', 
      'Beauty & Wellness',
      'Tech Support',
      'Event Services',
      'Tutoring',
      'Fitness',
      'Photography',
      'Food & Catering',
      'Legal Services',
      'Financial Services',
      'Healthcare',
      'Pet Services',
      'Moving & Storage',
      'Landscaping',
      'Other'
    ]
  },
  budgetMin: {
    type: Number,
    required: [true, 'Minimum budget is required'],
    min: [0, 'Budget cannot be negative']
  },
  budgetMax: {
    type: Number,
    required: [true, 'Maximum budget is required'],
    min: [0, 'Budget cannot be negative']
  },
  timeline: {
    type: String,
    required: [true, 'Timeline is required'],
    enum: ['urgent', 'thisweek', 'nextweek', 'thismonth', 'flexible']
  },
  location: {
    type: String,
    required: [true, 'Location is required'],
    trim: true
  },
  coordinates: {
    lat: Number,
    lng: Number
  },
  requirements: [{
    type: String,
    enum: ['Licensed', 'Insurance', 'References', 'Portfolio', 'Background Check', 'Certification']
  }],
  priority: {
    type: String,
    enum: ['low', 'normal', 'high', 'urgent'],
    default: 'normal'
  },
  postedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Posted by user is required']
  },
  status: {
    type: String,
    enum: ['open', 'in_progress', 'completed', 'cancelled', 'disputed'],
    default: 'open'
  },
  acceptedOffer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ServiceOffer',
    default: null
  },
  completedAt: Date,
  cancelledAt: Date,
  cancellationReason: String,
  finalRating: {
    type: Number,
    min: 1,
    max: 5
  },
  finalReview: {
    type: String,
    maxlength: [1000, 'Review cannot exceed 1000 characters']
  },
  images: [{
    url: String,
    caption: String
  }],
  attachments: [{
    url: String,
    filename: String,
    fileType: String,
    fileSize: Number
  }],
  urgentUntil: Date, // For urgent requests
  expiresAt: {
    type: Date,
    default: function() {
      // Requests expire after 30 days
      return new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    }
  },
  viewCount: {
    type: Number,
    default: 0
  },
  bookmarkCount: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
serviceRequestSchema.index({ postedBy: 1 });
serviceRequestSchema.index({ category: 1 });
serviceRequestSchema.index({ status: 1 });
serviceRequestSchema.index({ timeline: 1 });
serviceRequestSchema.index({ priority: 1 });
serviceRequestSchema.index({ coordinates: '2dsphere' });
serviceRequestSchema.index({ createdAt: -1 });
serviceRequestSchema.index({ budgetMin: 1, budgetMax: 1 });
serviceRequestSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
serviceRequestSchema.index({ title: 'text', description: 'text' });

// Virtual for budget display
serviceRequestSchema.virtual('budgetDisplay').get(function() {
  if (this.budgetMin === this.budgetMax) {
    return `$${this.budgetMin}`;
  }
  return `$${this.budgetMin} - $${this.budgetMax}`;
});

// Virtual for offer count (populated separately)
serviceRequestSchema.virtual('offerCount', {
  ref: 'ServiceOffer',
  localField: '_id',
  foreignField: 'requestId',
  count: true
});

// Middleware to validate budget
serviceRequestSchema.pre('save', function(next) {
  if (this.budgetMin > this.budgetMax) {
    next(new Error('Minimum budget cannot exceed maximum budget'));
  }
  next();
});

module.exports = mongoose.model('ServiceRequest', serviceRequestSchema);
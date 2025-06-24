// models/Conversation.js
const mongoose = require('mongoose');

const conversationSchema = new mongoose.Schema({
  storeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Store',
    required: true,
    index: true
  },
  participants: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }],
  participantTypes: [{
    type: String,
    enum: ['customer', 'merchant'],
    required: true
  }],
  lastMessage: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message'
  },
  lastMessageTime: {
    type: Date,
    default: Date.now
  },
  // Map to store unread count for each participant
  unreadCount: {
    type: Map,
    of: Number,
    default: new Map()
  },
  status: {
    type: String,
    enum: ['active', 'archived', 'blocked', 'closed'],
    default: 'active',
    index: true
  },
  // Conversation tags for organization
  tags: [{
    type: String,
    trim: true,
    maxlength: 50
  }],
  priority: {
    type: String,
    enum: ['low', 'normal', 'high', 'urgent'],
    default: 'normal',
    index: true
  },
  // Customer service related fields
  assignedAgent: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User' // Merchant/agent assigned to handle this conversation
  },
  customerNotes: {
    type: String,
    maxlength: 1000 // Internal notes about the customer
  },
  // Conversation settings
  settings: {
    muteNotifications: {
      type: Boolean,
      default: false
    },
    autoReply: {
      enabled: {
        type: Boolean,
        default: false
      },
      message: {
        type: String,
        maxlength: 500
      }
    }
  },
  // Analytics data
  analytics: {
    totalMessages: {
      type: Number,
      default: 0
    },
    averageResponseTime: {
      type: Number, // in minutes
      default: 0
    },
    lastActiveTime: {
      type: Date,
      default: Date.now
    },
    customerSatisfactionRating: {
      type: Number,
      min: 1,
      max: 5
    }
  },
  // Soft delete
  isDeleted: {
    type: Boolean,
    default: false
  },
  deletedAt: Date
}, {
  timestamps: true // Adds createdAt and updatedAt
});

// Compound indexes for efficient queries
conversationSchema.index({ storeId: 1, updatedAt: -1 });
conversationSchema.index({ participants: 1, updatedAt: -1 });
conversationSchema.index({ storeId: 1, status: 1, priority: -1 });
conversationSchema.index({ participants: 1, status: 1 });
conversationSchema.index({ lastMessageTime: -1 });

// Virtual for checking if conversation has unread messages
conversationSchema.virtual('hasUnreadMessages').get(function() {
  if (!this.unreadCount) return false;
  
  for (let count of this.unreadCount.values()) {
    if (count > 0) return true;
  }
  return false;
});

// Virtual for getting total unread count
conversationSchema.virtual('totalUnreadCount').get(function() {
  if (!this.unreadCount) return 0;
  
  let total = 0;
  for (let count of this.unreadCount.values()) {
    total += count;
  }
  return total;
});

// Instance method to add participant
conversationSchema.methods.addParticipant = function(userId, userType) {
  if (!this.participants.includes(userId)) {
    this.participants.push(userId);
    this.participantTypes.push(userType);
    this.unreadCount.set(userId.toString(), 0);
  }
  return this.save();
};

// Instance method to remove participant
conversationSchema.methods.removeParticipant = function(userId) {
  const index = this.participants.findIndex(p => p.equals(userId));
  if (index > -1) {
    this.participants.splice(index, 1);
    this.participantTypes.splice(index, 1);
    this.unreadCount.delete(userId.toString());
  }
  return this.save();
};

// Instance method to increment unread count for specific user
conversationSchema.methods.incrementUnreadCount = function(userId) {
  const currentCount = this.unreadCount.get(userId.toString()) || 0;
  this.unreadCount.set(userId.toString(), currentCount + 1);
  return this.save();
};

// Instance method to reset unread count for specific user
conversationSchema.methods.resetUnreadCount = function(userId) {
  this.unreadCount.set(userId.toString(), 0);
  return this.save();
};

// Instance method to update last message
conversationSchema.methods.updateLastMessage = function(messageId, timestamp = new Date()) {
  this.lastMessage = messageId;
  this.lastMessageTime = timestamp;
  this.analytics.lastActiveTime = timestamp;
  this.analytics.totalMessages += 1;
  return this.save();
};

// Instance method to assign agent
conversationSchema.methods.assignToAgent = function(agentId) {
  this.assignedAgent = agentId;
  return this.save();
};

// Instance method to add tag
conversationSchema.methods.addTag = function(tag) {
  if (!this.tags.includes(tag)) {
    this.tags.push(tag);
  }
  return this.save();
};

// Instance method to remove tag
conversationSchema.methods.removeTag = function(tag) {
  this.tags = this.tags.filter(t => t !== tag);
  return this.save();
};

// Instance method to archive conversation
conversationSchema.methods.archive = function() {
  this.status = 'archived';
  return this.save();
};

// Instance method to block conversation
conversationSchema.methods.block = function() {
  this.status = 'blocked';
  return this.save();
};

// Instance method to reactivate conversation
conversationSchema.methods.reactivate = function() {
  this.status = 'active';
  return this.save();
};

// Instance method to soft delete
conversationSchema.methods.softDelete = function() {
  this.isDeleted = true;
  this.deletedAt = new Date();
  return this.save();
};

// Static method to find conversations for a user
conversationSchema.statics.findForUser = function(userId, options = {}) {
  const {
    status = 'active',
    page = 1,
    limit = 20,
    sortBy = 'updatedAt',
    sortOrder = -1
  } = options;

  return this.find({
    participants: userId,
    status,
    isDeleted: { $ne: true }
  })
  .populate('participants', 'name avatar email')
  .populate('storeId', 'name avatar category online')
  .populate('lastMessage', 'content timestamp sender status')
  .populate('assignedAgent', 'name avatar')
  .sort({ [sortBy]: sortOrder })
  .limit(limit * 1)
  .skip((page - 1) * limit);
};

// Static method to find conversations for a store
conversationSchema.statics.findForStore = function(storeId, options = {}) {
  const {
    status = 'active',
    priority,
    assignedAgent,
    page = 1,
    limit = 20,
    sortBy = 'updatedAt',
    sortOrder = -1
  } = options;

  let query = {
    storeId,
    status,
    isDeleted: { $ne: true }
  };

  if (priority) query.priority = priority;
  if (assignedAgent) query.assignedAgent = assignedAgent;

  return this.find(query)
  .populate('participants', 'name avatar email createdAt')
  .populate('lastMessage', 'content timestamp sender status')
  .populate('assignedAgent', 'name avatar')
  .sort({ [sortBy]: sortOrder })
  .limit(limit * 1)
  .skip((page - 1) * limit);
};

// Static method to get conversation analytics for store
conversationSchema.statics.getStoreAnalytics = function(storeId, startDate, endDate) {
  return this.aggregate([
    {
      $match: {
        storeId: new mongoose.Types.ObjectId(storeId),
        createdAt: { $gte: startDate, $lte: endDate },
        isDeleted: { $ne: true }
      }
    },
    {
      $group: {
        _id: null,
        totalConversations: { $sum: 1 },
        averageResponseTime: { $avg: '$analytics.averageResponseTime' },
        totalMessages: { $sum: '$analytics.totalMessages' },
        averageRating: { $avg: '$analytics.customerSatisfactionRating' }
      }
    }
  ]);
};

// Pre-save middleware to update analytics
conversationSchema.pre('save', function(next) {
  if (this.isModified('lastMessageTime')) {
    this.analytics.lastActiveTime = this.lastMessageTime;
  }
  next();
});

// Pre-find middleware to exclude deleted conversations by default
conversationSchema.pre(/^find/, function() {
  if (!this.getQuery().isDeleted) {
    this.where({ isDeleted: { $ne: true } });
  }
});

module.exports = mongoose.model('Conversation', conversationSchema);
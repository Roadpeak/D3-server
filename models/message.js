// models/Message.js
const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  conversationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Conversation',
    required: true,
    index: true
  },
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  senderType: {
    type: String,
    enum: ['customer', 'merchant'],
    required: true
  },
  content: {
    type: String,
    required: true,
    trim: true,
    maxlength: 5000 // Limit message length
  },
  messageType: {
    type: String,
    enum: ['text', 'image', 'file', 'order', 'product', 'system'],
    default: 'text'
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  },
  status: {
    type: String,
    enum: ['sent', 'delivered', 'read', 'failed'],
    default: 'sent'
  },
  // Additional metadata for different message types
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
    // For images: { fileName, fileSize, mimeType, url }
    // For files: { fileName, fileSize, mimeType, url }
    // For orders: { orderId, orderNumber, status }
    // For products: { productId, name, price, image }
  },
  // Message reactions/emoji responses
  reactions: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    reaction: String, // emoji
    timestamp: {
      type: Date,
      default: Date.now
    }
  }],
  // For reply/thread functionality
  replyTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message'
  },
  // Message editing history
  editHistory: [{
    content: String,
    editedAt: {
      type: Date,
      default: Date.now
    }
  }],
  // Soft delete flag
  isDeleted: {
    type: Boolean,
    default: false
  },
  deletedAt: Date,
  deletedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true // Adds createdAt and updatedAt
});

// Compound indexes for efficient queries
messageSchema.index({ conversationId: 1, timestamp: -1 });
messageSchema.index({ sender: 1, timestamp: -1 });
messageSchema.index({ conversationId: 1, status: 1 });
messageSchema.index({ conversationId: 1, messageType: 1 });

// Virtual for checking if message is edited
messageSchema.virtual('isEdited').get(function() {
  return this.editHistory && this.editHistory.length > 0;
});

// Instance method to mark message as read
messageSchema.methods.markAsRead = function() {
  this.status = 'read';
  return this.save();
};

// Instance method to mark message as delivered
messageSchema.methods.markAsDelivered = function() {
  this.status = 'delivered';
  return this.save();
};

// Instance method to add reaction
messageSchema.methods.addReaction = function(userId, reaction) {
  // Remove existing reaction from this user
  this.reactions = this.reactions.filter(r => !r.userId.equals(userId));
  
  // Add new reaction
  this.reactions.push({ userId, reaction });
  return this.save();
};

// Instance method to remove reaction
messageSchema.methods.removeReaction = function(userId) {
  this.reactions = this.reactions.filter(r => !r.userId.equals(userId));
  return this.save();
};

// Instance method to soft delete message
messageSchema.methods.softDelete = function(deletedBy) {
  this.isDeleted = true;
  this.deletedAt = new Date();
  this.deletedBy = deletedBy;
  return this.save();
};

// Static method to get unread messages count for a conversation
messageSchema.statics.getUnreadCount = function(conversationId, userId) {
  return this.countDocuments({
    conversationId,
    sender: { $ne: userId },
    status: { $ne: 'read' },
    isDeleted: false
  });
};

// Static method to get messages with pagination
messageSchema.statics.getConversationMessages = function(conversationId, page = 1, limit = 50) {
  return this.find({ 
    conversationId,
    isDeleted: false 
  })
  .populate('sender', 'name avatar')
  .populate('replyTo', 'content sender')
  .sort({ timestamp: -1 })
  .limit(limit * 1)
  .skip((page - 1) * limit);
};

// Pre-save middleware to validate message content based on type
messageSchema.pre('save', function(next) {
  if (this.messageType === 'image' || this.messageType === 'file') {
    if (!this.metadata || !this.metadata.url) {
      return next(new Error('File URL is required for image/file messages'));
    }
  }
  
  if (this.messageType === 'order') {
    if (!this.metadata || !this.metadata.orderId) {
      return next(new Error('Order ID is required for order messages'));
    }
  }
  
  if (this.messageType === 'product') {
    if (!this.metadata || !this.metadata.productId) {
      return next(new Error('Product ID is required for product messages'));
    }
  }
  
  next();
});

// Pre-find middleware to exclude deleted messages by default
messageSchema.pre(/^find/, function() {
  if (!this.getQuery().isDeleted) {
    this.where({ isDeleted: { $ne: true } });
  }
});

module.exports = mongoose.model('Message', messageSchema);
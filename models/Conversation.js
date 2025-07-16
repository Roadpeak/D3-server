// models/Conversation.js
const mongoose = require('mongoose');

const conversationSchema = new mongoose.Schema({
  storeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Store',
    required: true
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
  unreadCount: {
    type: Map,
    of: Number,
    default: {}
  },
  isActive: {
    type: Boolean,
    default: true
  },
  metadata: {
    customerPriority: {
      type: String,
      enum: ['regular', 'vip'],
      default: 'regular'
    },
    tags: [String],
    notes: String
  }
}, {
  timestamps: true
});

// Indexes for better performance
conversationSchema.index({ storeId: 1, updatedAt: -1 });
conversationSchema.index({ participants: 1, updatedAt: -1 });
conversationSchema.index({ 'participants': 1, 'storeId': 1 });

module.exports = mongoose.model('Conversation', conversationSchema);

// models/Message.js
const messageSchema = new mongoose.Schema({
  conversationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Conversation',
    required: true
  },
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  senderType: {
    type: String,
    enum: ['customer', 'merchant', 'system'],
    required: true
  },
  content: {
    type: String,
    required: true,
    maxlength: 2000
  },
  messageType: {
    type: String,
    enum: ['text', 'image', 'file', 'system'],
    default: 'text'
  },
  status: {
    type: String,
    enum: ['sent', 'delivered', 'read'],
    default: 'sent'
  },
  attachments: [{
    type: String,
    url: String,
    filename: String,
    filesize: Number
  }],
  metadata: {
    editedAt: Date,
    deletedAt: Date,
    replyTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Message'
    }
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Indexes
messageSchema.index({ conversationId: 1, timestamp: -1 });
messageSchema.index({ sender: 1, timestamp: -1 });
messageSchema.index({ status: 1, conversationId: 1 });

module.exports = mongoose.model('Message', messageSchema);

// models/Store.js (if not already exists)
const storeSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: String,
  category: {
    type: String,
    required: true
  },
  avatar: {
    type: String,
    default: null
  },
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  contact: {
    email: String,
    phone: String,
    address: {
      street: String,
      city: String,
      state: String,
      zipCode: String,
      country: String
    }
  },
  settings: {
    chatEnabled: {
      type: Boolean,
      default: true
    },
    autoReply: {
      enabled: {
        type: Boolean,
        default: false
      },
      message: String
    },
    businessHours: {
      monday: { open: String, close: String },
      tuesday: { open: String, close: String },
      wednesday: { open: String, close: String },
      thursday: { open: String, close: String },
      friday: { open: String, close: String },
      saturday: { open: String, close: String },
      sunday: { open: String, close: String }
    }
  },
  isActive: {
    type: Boolean,
    default: true
  },
  isOnline: {
    type: Boolean,
    default: false
  },
  lastSeen: Date
}, {
  timestamps: true
});

module.exports = mongoose.model('Store', storeSchema);

// Update to User model (add chat-related fields)
// Add these fields to your existing User model:
/*
const userSchema = new mongoose.Schema({
  // ... existing fields
  
  // Chat-related fields
  isOnline: {
    type: Boolean,
    default: false
  },
  lastSeen: Date,
  chatSettings: {
    notifications: {
      type: Boolean,
      default: true
    },
    soundEnabled: {
      type: Boolean,
      default: true
    },
    emailNotifications: {
      type: Boolean,
      default: true
    }
  },
  blockedUsers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }]
}, {
  timestamps: true
});
*/
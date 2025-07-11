'use strict';
const bcrypt = require('bcryptjs');

module.exports = (sequelize, DataTypes) => {
  const User = sequelize.define('User', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    firstName: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        len: [1, 50],
        notEmpty: true
      }
    },
    lastName: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        len: [1, 50],
        notEmpty: true
      }
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      validate: {
        isEmail: true,
        len: [5, 100]
      },
    },
    phoneNumber: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        len: [10, 15],
        isNumeric: false // Allow for formatting characters like +, -, ()
      }
    },
    password: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        len: [6, 255]
      }
    },
    avatar: {
      type: DataTypes.STRING,
      allowNull: true,
      validate: {
        isUrl: true
      }
    },
    userType: {
      type: DataTypes.ENUM('customer', 'merchant', 'admin'),
      defaultValue: 'customer',
      allowNull: false
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    },
    lastLoginAt: {
      type: DataTypes.DATE,
      allowNull: true
    },
    emailVerifiedAt: {
      type: DataTypes.DATE,
      allowNull: true
    },
    phoneVerifiedAt: {
      type: DataTypes.DATE,
      allowNull: true
    }
  }, {
    tableName: 'users',
    timestamps: true,
    indexes: [
      {
        unique: true,
        fields: ['email']
      },
      {
        fields: ['phoneNumber']
      },
      {
        fields: ['userType']
      },
      {
        fields: ['isActive']
      }
    ],
    defaultScope: {
      attributes: {
        exclude: ['password'] // Exclude password by default
      }
    },
    scopes: {
      withPassword: {
        attributes: {} // Include all attributes including password
      }
    }
  });

  // Hash password before creating user
  User.beforeCreate(async (user) => {
    if (user.password) {
      const hashedPassword = await bcrypt.hash(user.password, 10);
      user.password = hashedPassword;
    }
  });

  // Hash password before updating if password is changed
  User.beforeUpdate(async (user) => {
    if (user.changed('password')) {
      const hashedPassword = await bcrypt.hash(user.password, 10);
      user.password = hashedPassword;
    }
  });

  // Instance methods
  User.prototype.validPassword = async function (password) {
    return await bcrypt.compare(password, this.password);
  };

  User.prototype.getFullName = function() {
    return `${this.firstName} ${this.lastName}`;
  };

  User.prototype.isEmailVerified = function() {
    return this.emailVerifiedAt !== null;
  };

  User.prototype.isPhoneVerified = function() {
    return this.phoneVerifiedAt !== null;
  };

  User.prototype.updateLastLogin = function() {
    this.lastLoginAt = new Date();
    return this.save();
  };

  User.prototype.verifyEmail = function() {
    this.emailVerifiedAt = new Date();
    return this.save();
  };

  User.prototype.verifyPhone = function() {
    this.phoneVerifiedAt = new Date();
    return this.save();
  };

  // Class methods
  User.findByEmail = function(email) {
    return this.scope('withPassword').findOne({
      where: { email: email.toLowerCase() }
    });
  };

  User.findByPhone = function(phoneNumber) {
    return this.findOne({
      where: { phoneNumber }
    });
  };

  // Virtual attributes
  User.prototype.getIsVerified = function() {
    return this.isEmailVerified() && this.isPhoneVerified();
  };

  // Associations
  User.associate = function(models) {
    // User has many chats
    User.hasMany(models.Chat, {
      foreignKey: 'userId',
      as: 'chats',
      onDelete: 'CASCADE'
    });

    // User has many sent messages
    User.hasMany(models.Message, {
      foreignKey: 'sender_id',
      as: 'sentMessages',
      onDelete: 'CASCADE'
    });

    // User has many deleted messages (messages they deleted)
    User.hasMany(models.Message, {
      foreignKey: 'deletedBy',
      as: 'deletedMessages',
      onDelete: 'SET NULL'
    });

    // If you have other models, add them here:
    
    // User has many orders (if you have an Order model)
    // User.hasMany(models.Order, {
    //   foreignKey: 'userId',
    //   as: 'orders',
    //   onDelete: 'CASCADE'
    // });

    // User has many stores (if merchants can have stores)
    // User.hasMany(models.Store, {
    //   foreignKey: 'ownerId',
    //   as: 'stores',
    //   onDelete: 'CASCADE'
    // });

    // User has many reviews (if you have a Review model)
    // User.hasMany(models.Review, {
    //   foreignKey: 'userId',
    //   as: 'reviews',
    //   onDelete: 'CASCADE'
    // });
  };

  // Hook to normalize email before saving
  User.beforeSave(async (user) => {
    if (user.email) {
      user.email = user.email.toLowerCase().trim();
    }
    if (user.firstName) {
      user.firstName = user.firstName.trim();
    }
    if (user.lastName) {
      user.lastName = user.lastName.trim();
    }
  });

  return User;
};
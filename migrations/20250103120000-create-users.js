'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('users', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true
      },
      firstName: {
        type: Sequelize.STRING,
        allowNull: false
      },
      lastName: {
        type: Sequelize.STRING,
        allowNull: false
      },
      email: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true
      },
      phoneNumber: {
        type: Sequelize.STRING,
        allowNull: false
      },
      password: {
        type: Sequelize.STRING,
        allowNull: true
      },
      avatar: {
        type: Sequelize.STRING,
        allowNull: true
      },
      userType: {
        type: Sequelize.ENUM('customer', 'merchant', 'admin'),
        defaultValue: 'customer',
        allowNull: false
      },
      isActive: {
        type: Sequelize.BOOLEAN,
        defaultValue: true
      },
      lastLoginAt: {
        type: Sequelize.DATE,
        allowNull: true
      },
      emailVerifiedAt: {
        type: Sequelize.DATE,
        allowNull: true
      },
      phoneVerifiedAt: {
        type: Sequelize.DATE,
        allowNull: true
      },
      isOnline: {
        type: Sequelize.BOOLEAN,
        defaultValue: false
      },
      lastSeenAt: {
        type: Sequelize.DATE,
        allowNull: true
      },
      chatNotifications: {
        type: Sequelize.BOOLEAN,
        defaultValue: true
      },
      emailNotifications: {
        type: Sequelize.BOOLEAN,
        defaultValue: true
      },
      smsNotifications: {
        type: Sequelize.BOOLEAN,
        defaultValue: true
      },
      pushNotifications: {
        type: Sequelize.BOOLEAN,
        defaultValue: true
      },
      marketingEmails: {
        type: Sequelize.BOOLEAN,
        defaultValue: false
      },
      dateOfBirth: {
        type: Sequelize.DATE,
        allowNull: true
      },
      gender: {
        type: Sequelize.ENUM('male', 'female', 'other', 'prefer_not_to_say'),
        allowNull: true
      },
      address: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      city: {
        type: Sequelize.STRING,
        allowNull: true
      },
      country: {
        type: Sequelize.STRING,
        allowNull: true,
        defaultValue: 'Kenya'
      },
      postalCode: {
        type: Sequelize.STRING,
        allowNull: true
      },
      googleId: {
        type: Sequelize.STRING(100),
        allowNull: true,
        unique: true
      },
      authProvider: {
        type: Sequelize.ENUM('email', 'google', 'facebook', 'apple'),
        defaultValue: 'email',
        allowNull: false
      },
      googleLinkedAt: {
        type: Sequelize.DATE,
        allowNull: true
      },
      profileVisibility: {
        type: Sequelize.ENUM('public', 'private', 'friends_only'),
        defaultValue: 'public'
      },
      referralSlug: {
        type: Sequelize.STRING(50),
        allowNull: true,
        unique: true
      },
      referralLink: {
        type: Sequelize.STRING(255),
        allowNull: true
      },
      referredBy: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'users',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      referredAt: {
        type: Sequelize.DATE,
        allowNull: true
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP')
      }
    });

    // MINIMAL INDEXES - Only the most essential ones
    // Total: 2 manual indexes + 3 unique (email, googleId, referralSlug) + 1 primary = 6 total
    
    await queryInterface.addIndex('users', ['userType', 'isActive'], {
      name: 'idx_user_type_active'
    });

    await queryInterface.addIndex('users', ['referredBy'], {
      name: 'idx_referred_by'
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('users');
  }
};
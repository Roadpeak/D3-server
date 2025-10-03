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
        defaultValue: false,
        comment: 'Real-time online status for chat system'
      },
      lastSeenAt: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: 'Last seen timestamp for chat system'
      },
      chatNotifications: {
        type: Sequelize.BOOLEAN,
        defaultValue: true,
        comment: 'Whether to receive chat notifications'
      },
      emailNotifications: {
        type: Sequelize.BOOLEAN,
        defaultValue: true,
        comment: 'Whether to receive email notifications'
      },
      smsNotifications: {
        type: Sequelize.BOOLEAN,
        defaultValue: true,
        comment: 'Whether to receive SMS notifications'
      },
      pushNotifications: {
        type: Sequelize.BOOLEAN,
        defaultValue: true,
        comment: 'Whether to receive push notifications'
      },
      marketingEmails: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
        comment: 'Whether to receive marketing emails'
      },
      dateOfBirth: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: 'Customer date of birth'
      },
      gender: {
        type: Sequelize.ENUM('male', 'female', 'other', 'prefer_not_to_say'),
        allowNull: true,
        comment: 'Customer gender'
      },
      address: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'Customer address'
      },
      city: {
        type: Sequelize.STRING,
        allowNull: true,
        comment: 'Customer city'
      },
      country: {
        type: Sequelize.STRING,
        allowNull: true,
        defaultValue: 'Kenya',
        comment: 'Customer country'
      },
      postalCode: {
        type: Sequelize.STRING,
        allowNull: true,
        comment: 'Customer postal code'
      },
      googleId: {
        type: Sequelize.STRING(100),
        allowNull: true,
        unique: true,
        comment: 'Google OAuth ID for this user'
      },
      authProvider: {
        type: Sequelize.ENUM('email', 'google', 'facebook', 'apple'),
        defaultValue: 'email',
        allowNull: false,
        comment: 'Primary authentication provider used to create account'
      },
      googleLinkedAt: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: 'When Google account was first linked'
      },
      profileVisibility: {
        type: Sequelize.ENUM('public', 'private', 'friends_only'),
        defaultValue: 'public',
        comment: 'Profile visibility setting'
      },
      referralSlug: {
        type: Sequelize.STRING(50),
        allowNull: true,
        unique: true,
        comment: 'Unique referral slug for this user (user-friendly)'
      },
      referralLink: {
        type: Sequelize.STRING(255),
        allowNull: true,
        comment: 'Full referral link for this user'
      },
      referredBy: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'users',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
        comment: 'ID of user who referred this user'
      },
      referredAt: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: 'When this user was referred'
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

    // Add indexes
    await queryInterface.addIndex('users', ['phoneNumber'], {
      name: 'idx_phone_number'
    });

    await queryInterface.addIndex('users', ['userType', 'isActive'], {
      name: 'idx_user_type_active'
    });

    await queryInterface.addIndex('users', ['userType', 'isOnline'], {
      name: 'idx_user_type_online'
    });

    await queryInterface.addIndex('users', ['userType', 'createdAt'], {
      name: 'idx_user_type_created'
    });

    await queryInterface.addIndex('users', ['country', 'city'], {
      name: 'idx_location'
    });

    await queryInterface.addIndex('users', ['referredBy'], {
      name: 'idx_referred_by'
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('users');
  }
};
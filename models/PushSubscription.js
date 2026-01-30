// models/PushSubscription.js - FIXED FOR MULTI-USER-TYPE SUPPORT
'use strict';

module.exports = (sequelize, DataTypes) => {
    const PushSubscription = sequelize.define('PushSubscription', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
            allowNull: false
        },
        userId: {
            type: DataTypes.CHAR(36), // UUID
            allowNull: false,
            field: 'user_id',
            comment: 'References User.id OR Merchant.id (UUID) - depends on userType'
        },
        userType: {
            type: DataTypes.ENUM('user', 'merchant', 'admin'),
            allowNull: false,
            defaultValue: 'user',
            field: 'user_type',
            comment: 'Type of user (user/merchant/admin)'
        },
        endpoint: {
            type: DataTypes.STRING(1000),
            allowNull: false,
            comment: 'Push subscription endpoint URL (unique index defined in indexes)'
        },
        p256dhKey: {
            type: DataTypes.TEXT,
            allowNull: false,
            field: 'p256dh_key',
            comment: 'P256DH encryption key for push notifications'
        },
        authKey: {
            type: DataTypes.TEXT,
            allowNull: false,
            field: 'auth_key',
            comment: 'Authentication secret for push notifications'
        },
        userAgent: {
            type: DataTypes.TEXT,
            allowNull: true,
            field: 'user_agent',
            comment: 'Browser/device user agent string'
        },
        lastUsedAt: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW,
            field: 'last_used_at',
            comment: 'Last time this subscription was used'
        }
    }, {
        tableName: 'push_subscriptions',
        timestamps: true,
        underscored: true,
        indexes: [
            {
                name: 'idx_push_user_id',
                fields: ['user_id']
            },
            {
                name: 'idx_push_user_type',
                fields: ['user_type']
            },
            {
                name: 'idx_push_user_composite',
                fields: ['user_id', 'user_type']
            },
            {
                unique: true,
                name: 'idx_push_endpoint',
                fields: ['endpoint']
            },
            {
                name: 'idx_push_last_used',
                fields: ['last_used_at']
            }
        ]
    });

    // ❌ REMOVED: No belongsTo association because we support multiple user types
    // The userId can reference either User or Merchant based on userType
    // We handle this manually in the controller/queries

    PushSubscription.associate = (models) => {
        // No associations defined here
        // We use polymorphic relationship pattern instead
        // userId + userType together determine which table to reference
    };

    return PushSubscription;
};
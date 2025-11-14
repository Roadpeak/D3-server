// models/PushSubscription.js
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
            type: DataTypes.INTEGER,
            allowNull: false,
            field: 'user_id',
            comment: 'References User.id - the user who subscribed'
        },
        userType: {
            type: DataTypes.ENUM('user', 'merchant', 'admin'),
            allowNull: false,
            defaultValue: 'user',
            field: 'user_type',
            comment: 'Type of user (user/merchant/admin)'
        },
        endpoint: {
            type: DataTypes.TEXT,
            allowNull: false,
            unique: true,
            comment: 'Push subscription endpoint URL'
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
                unique: true,
                name: 'idx_push_endpoint',
                fields: ['endpoint(255)'] // Index only first 255 chars of TEXT field
            },
            {
                name: 'idx_push_last_used',
                fields: ['last_used_at']
            }
        ]
    });

    // Define associations
    PushSubscription.associate = (models) => {
        // Association with User model
        PushSubscription.belongsTo(models.User, {
            foreignKey: 'userId',
            as: 'user',
            onDelete: 'CASCADE'
        });
    };

    return PushSubscription;
};
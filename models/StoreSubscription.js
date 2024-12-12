// models/StoreSubscription.js
'use strict';

module.exports = (sequelize, DataTypes) => {
    const StoreSubscription = sequelize.define(
        'StoreSubscription',
        {
            id: {
                type: DataTypes.UUID,
                defaultValue: DataTypes.UUIDV4,
                primaryKey: true,
            },
            store_id: {
                type: DataTypes.UUID,
                allowNull: false,
                references: {
                    model: 'Stores',
                    key: 'id',
                },
            },
            start_date: {
                type: DataTypes.DATE,
                allowNull: false,
            },
            end_date: {
                type: DataTypes.DATE,
                allowNull: false,
            },
            next_billing_date: {
                type: DataTypes.DATE,
                allowNull: false,
            },
            is_trial: {
                type: DataTypes.BOOLEAN,
                defaultValue: true,
            },
            is_active: {
                type: DataTypes.BOOLEAN,
                defaultValue: true,
            },
            status: {
                type: DataTypes.ENUM('active', 'inactive', 'canceled'),
                defaultValue: 'active',
            },
        },
        {
            timestamps: true,
            tableName: 'StoreSubscriptions',
        }
    );

    StoreSubscription.associate = (models) => {
        StoreSubscription.belongsTo(models.Store, {
            foreignKey: 'store_id',
            as: 'store',
            onDelete: 'CASCADE',
        });
    };

    return StoreSubscription;
};

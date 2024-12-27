'use strict';

module.exports = (sequelize, DataTypes) => {
    const ServiceLike = sequelize.define(
        'ServiceLike',
        {
            id: {
                type: DataTypes.UUID,
                defaultValue: DataTypes.UUIDV4,
                primaryKey: true,
            },
            user_id: {
                type: DataTypes.UUID,
                allowNull: false,
                references: {
                    model: 'Users',
                    key: 'id',
                },
            },
            service_id: {
                type: DataTypes.UUID,
                allowNull: false,
                references: {
                    model: 'Services',
                    key: 'id',
                },
            },
        },
        {
            timestamps: true,
            tableName: 'ServiceLikes',
        }
    );

    ServiceLike.associate = (models) => {
        ServiceLike.belongsTo(models.User, { foreignKey: 'user_id', as: 'user' });
        ServiceLike.belongsTo(models.Service, { foreignKey: 'service_id', as: 'service' });
    };

    return ServiceLike;
};

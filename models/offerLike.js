'use strict';

module.exports = (sequelize, DataTypes) => {
    const OfferLike = sequelize.define(
        'OfferLike',
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
            offer_id: {
                type: DataTypes.UUID,
                allowNull: false,
                references: {
                    model: 'Offers',
                    key: 'id',
                },
            },
        },
        {
            timestamps: true,
            tableName: 'OfferLikes',
        }
    );

    OfferLike.associate = (models) => {
        OfferLike.belongsTo(models.User, { foreignKey: 'user_id', as: 'user' });
        OfferLike.belongsTo(models.Offer, { foreignKey: 'offer_id', as: 'offer' });
    };

    return OfferLike;
};

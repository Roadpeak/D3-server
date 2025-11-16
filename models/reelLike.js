// models/reelLike.js - ReelLike Sequelize Model
const { v4: uuidv4 } = require('uuid');

module.exports = (sequelize, DataTypes) => {
    const ReelLike = sequelize.define(
        'ReelLike',
        {
            id: {
                type: DataTypes.CHAR(36),
                primaryKey: true,
                defaultValue: () => uuidv4(),
            },
            reel_id: {
                type: DataTypes.CHAR(36),
                allowNull: false,
                references: {
                    model: 'reels',
                    key: 'id',
                },
                onDelete: 'CASCADE',
            },
            user_id: {
                type: DataTypes.CHAR(36),
                allowNull: false,
                references: {
                    model: 'users',
                    key: 'id',
                },
                onDelete: 'CASCADE',
            },
        },
        {
            tableName: 'reel_likes',
            timestamps: true,
            underscored: true,
            createdAt: 'created_at',
            updatedAt: false,
            indexes: [
                { fields: ['reel_id'] },
                { fields: ['user_id'] },
                { fields: ['created_at'] },
                {
                    unique: true,
                    fields: ['reel_id', 'user_id'],
                    name: 'unique_reel_user_like',
                },
            ],
        }
    );

    // Define associations
    ReelLike.associate = (models) => {
        ReelLike.belongsTo(models.Reel, {
            foreignKey: 'reel_id',
            as: 'reel',
        });

        ReelLike.belongsTo(models.User, {
            foreignKey: 'user_id',
            as: 'user',
        });
    };

    return ReelLike;
};
// models/reelView.js - ReelView Sequelize Model
module.exports = (sequelize, DataTypes) => {
    const ReelView = sequelize.define(
        'ReelView',
        {
            id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true,
            },
            reel_id: {
                type: DataTypes.INTEGER,
                allowNull: false,
                references: {
                    model: 'reels',
                    key: 'id',
                },
                onDelete: 'CASCADE',
            },
            user_id: {
                type: DataTypes.INTEGER,
                allowNull: true,
                references: {
                    model: 'users',
                    key: 'id',
                },
                onDelete: 'SET NULL',
                comment: 'NULL for anonymous views',
            },
            ip_address: {
                type: DataTypes.STRING(45),
                allowNull: true,
                comment: 'IPv4 or IPv6',
            },
            user_agent: {
                type: DataTypes.TEXT,
                allowNull: true,
            },
            view_duration: {
                type: DataTypes.INTEGER,
                defaultValue: 0,
                comment: 'How many seconds user watched',
            },
        },
        {
            tableName: 'reel_views',
            timestamps: true,
            underscored: true,
            createdAt: 'viewed_at',
            updatedAt: false,
            indexes: [
                { fields: ['reel_id'] },
                { fields: ['user_id'] },
                { fields: ['viewed_at'] },
                { fields: ['reel_id', 'viewed_at'] },
            ],
        }
    );

    return ReelView;
};
// models/reel.js - Reel Sequelize Model
module.exports = (sequelize, DataTypes) => {
    const Reel = sequelize.define(
        'Reel',
        {
            id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true,
            },
            merchant_id: {
                type: DataTypes.INTEGER,
                allowNull: false,
                references: {
                    model: 'merchants',
                    key: 'id',
                },
                onDelete: 'CASCADE',
            },
            store_id: {
                type: DataTypes.INTEGER,
                allowNull: false,
                references: {
                    model: 'stores',
                    key: 'id',
                },
                onDelete: 'CASCADE',
            },
            service_id: {
                type: DataTypes.INTEGER,
                allowNull: false,
                references: {
                    model: 'services',
                    key: 'id',
                },
                onDelete: 'CASCADE',
            },
            video_url: {
                type: DataTypes.STRING(500),
                allowNull: false,
            },
            thumbnail_url: {
                type: DataTypes.STRING(500),
                allowNull: true,
            },
            title: {
                type: DataTypes.STRING(100),
                allowNull: false,
            },
            description: {
                type: DataTypes.TEXT,
                allowNull: true,
            },
            duration: {
                type: DataTypes.INTEGER,
                allowNull: false,
                comment: 'Duration in seconds',
            },
            status: {
                type: DataTypes.ENUM('draft', 'pending', 'published', 'rejected'),
                defaultValue: 'draft',
            },
            views: {
                type: DataTypes.INTEGER,
                defaultValue: 0,
            },
            likes: {
                type: DataTypes.INTEGER,
                defaultValue: 0,
            },
            shares: {
                type: DataTypes.INTEGER,
                defaultValue: 0,
            },
            chats: {
                type: DataTypes.INTEGER,
                defaultValue: 0,
                comment: 'Number of chats initiated from this reel',
            },
            published_at: {
                type: DataTypes.DATE,
                allowNull: true,
            },
        },
        {
            tableName: 'reels',
            timestamps: true,
            underscored: true,
            createdAt: 'created_at',
            updatedAt: 'updated_at',
            indexes: [
                { fields: ['merchant_id'] },
                { fields: ['store_id'] },
                { fields: ['service_id'] },
                { fields: ['status'] },
                { fields: ['published_at'] },
                { fields: ['views'] },
                { fields: ['created_at'] },
            ],
        }
    );

    return Reel;
};
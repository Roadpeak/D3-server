module.exports = (sequelize, DataTypes) => {
    const Social = sequelize.define('Social', {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true,
        },
        store_id: {
            type: DataTypes.UUID,
            allowNull: false,
            references: {
                model: 'stores',
                key: 'id',
            },
            onDelete: 'CASCADE',
            onUpdate: 'CASCADE',
        },
        platform: {
            type: DataTypes.STRING,
            allowNull: false,
            validate: {
                isIn: [['facebook', 'instagram', 'twitter', 'linkedin', 'youtube', 'tiktok', 'pinterest', 'snapchat', 'whatsapp', 'discord', 'tumblr', 'reddit', 'vimeo', 'github', 'flickr']]
            }
        },
        link: {
            type: DataTypes.STRING,
            allowNull: false,
            validate: {
                isUrl: true
            }
        },
    }, {
        timestamps: true,
        createdAt: 'createdAt',
        updatedAt: 'updatedAt',
        tableName: 'socials',
        indexes: [
            {
                unique: true,
                fields: ['store_id', 'platform']
            }
        ]
    });

    Social.associate = (models) => {
        // Social belongs to Store
        Social.belongsTo(models.Store, {
            foreignKey: 'store_id',
            as: 'store',
            onDelete: 'CASCADE'
        });
    };

    return Social;
};